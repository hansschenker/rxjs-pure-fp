import { innerFrom, type ObservableInput } from './interop.ts';
import { createObservable, executeSource, type Observable } from './observable.ts';
import { operate, type MonoTypeOperatorFunction, type OperatorFunction } from './operator.ts';
import { createSubscriber, type Subscriber } from './sink.ts';
import type { Subscription } from './subscription.ts';
import { createReplaySubject, createSubject, type Subject } from './subject.ts';

/**
 * M11 sharing topology: one shared connection to a source, multicast through
 * a connector Subject, with reset behavior as policy data. `shareReplay` is
 * algebra over `share` with a replay connector; `connectable`/`connect`
 * expose the connection explicitly instead of ref-counting it.
 *
 * Reset policies accept `true` (reset immediately), `false` (never), or a
 * notifier factory whose first emission triggers the reset; since M16 the
 * factory may return any `ObservableInput`.
 */
export type ShareConfig<T> = {
  readonly connector?: () => Subject<T>;
  readonly resetOnError?: boolean | ((error: unknown) => ObservableInput<unknown>);
  readonly resetOnComplete?: boolean | (() => ObservableInput<unknown>);
  readonly resetOnRefCountZero?: boolean | (() => ObservableInput<unknown>);
};

export const share = <T>(options: ShareConfig<T> = {}): MonoTypeOperatorFunction<T> => {
  const {
    connector = () => createSubject<T>(),
    resetOnError = true,
    resetOnComplete = true,
    resetOnRefCountZero = true,
  } = options;

  return (wrapperSource) => {
    let connection: Subscriber<T> | undefined;
    let resetConnection: Subscription | undefined;
    let subject: Subject<T> | undefined;
    let refCount = 0;
    let hasCompleted = false;
    let hasErrored = false;

    const cancelReset = (): void => {
      resetConnection?.unsubscribe();
      resetConnection = undefined;
    };
    const reset = (): void => {
      cancelReset();
      connection = subject = undefined;
      hasCompleted = hasErrored = false;
    };
    const resetAndUnsubscribe = (): void => {
      const priorConnection = connection;
      reset();
      priorConnection?.unsubscribe();
    };

    return operate<T, T>((source, destination) => {
      refCount += 1;
      if (!hasErrored && !hasCompleted) {
        cancelReset();
      }

      const dest = (subject = subject ?? connector());

      destination.add(() => {
        refCount -= 1;
        if (refCount === 0 && !hasErrored && !hasCompleted) {
          resetConnection = handleReset(resetAndUnsubscribe, resetOnRefCountZero);
        }
      });

      executeSource(dest, destination);

      if (!connection && refCount > 0) {
        connection = createSubscriber<T>({
          next: (value) => dest.next(value),
          error: (error) => {
            hasErrored = true;
            cancelReset();
            resetConnection = handleReset(reset, resetOnError, error);
            dest.error(error);
          },
          complete: () => {
            hasCompleted = true;
            cancelReset();
            resetConnection = handleReset(reset, resetOnComplete);
            dest.complete();
          },
        });
        executeSource(source, connection);
      }
      return undefined;
    })(wrapperSource);
  };
};

const handleReset = <A extends readonly unknown[]>(
  reset: () => void,
  on: boolean | ((...args: A) => ObservableInput<unknown>),
  ...args: A
): Subscription | undefined => {
  if (on === true) {
    reset();
    return undefined;
  }
  if (on === false) {
    return undefined;
  }
  let notifierSubscriber!: Subscriber<unknown>;
  notifierSubscriber = createSubscriber<unknown>({
    next: () => {
      notifierSubscriber.unsubscribe();
      reset();
    },
    error: () => undefined,
    complete: () => undefined,
  });
  executeSource(innerFrom(on(...args)), notifierSubscriber);
  return notifierSubscriber;
};

export type ShareReplayConfig = {
  readonly bufferSize?: number;
  readonly refCount?: boolean;
};

/**
 * Algebra over `share`: a replay connector, no reset on completion, and
 * ref-count-driven reset only when requested. The deprecated time window and
 * scheduler arguments are deferred until clocks land (M13/M14).
 */
export function shareReplay<T>(config: ShareReplayConfig): MonoTypeOperatorFunction<T>;
export function shareReplay<T>(bufferSize?: number): MonoTypeOperatorFunction<T>;
export function shareReplay<T>(
  configOrBufferSize?: ShareReplayConfig | number
): MonoTypeOperatorFunction<T> {
  const { bufferSize = Infinity, refCount = false } =
    typeof configOrBufferSize === 'object' && configOrBufferSize !== null
      ? configOrBufferSize
      : { bufferSize: configOrBufferSize };
  return share<T>({
    connector: () => createReplaySubject<T>(bufferSize),
    resetOnError: true,
    resetOnComplete: false,
    resetOnRefCountZero: refCount,
  });
}

export type Connectable<T> = Observable<T> & {
  readonly connect: () => Subscription;
};

export type ConnectableConfig<T> = {
  readonly connector?: () => Subject<T>;
  readonly resetOnDisconnect?: boolean;
};

/**
 * A multicast view of `source` whose connection is explicit: subscribers
 * attach to the connector Subject; `connect()` (idempotent while open) runs
 * the source into it. Disconnecting swaps in a fresh Subject by default.
 */
export const connectable = <T>(
  source: Observable<T>,
  config: ConnectableConfig<T> = {}
): Connectable<T> => {
  const { connector = () => createSubject<T>(), resetOnDisconnect = true } = config;
  let connection: Subscription | null = null;
  let subject = connector();

  const result = createObservable<T>((subscriber) => subject(subscriber)) as Observable<T> & {
    connect: () => Subscription;
  };
  result.connect = () => {
    if (!connection || connection.closed) {
      const connectionSubscriber = createSubscriber<T>(subject);
      executeSource(source, connectionSubscriber);
      connection = connectionSubscriber;
      if (resetOnDisconnect) {
        connection.add(() => {
          subject = connector();
        });
      }
    }
    return connection;
  };
  return result as Connectable<T>;
};

export type ConnectConfig<T> = {
  readonly connector?: () => Subject<T>;
};

/**
 * Multicasts the source through a connector Subject for the duration of one
 * subscription: the selector builds a pipeline over the shared view, then the
 * source is connected. Lets one subscription use the source several times.
 */
export const connect = <T, R>(
  selector: (shared: Observable<T>) => ObservableInput<R>,
  config: ConnectConfig<T> = {}
): OperatorFunction<T, R> =>
  operate((source, destination) => {
    const subject = (config.connector ?? (() => createSubject<T>()))();
    executeSource(innerFrom(selector(subject.asObservable())), destination);
    const connectionSubscriber = createSubscriber<T>(subject);
    executeSource(source, connectionSubscriber);
    destination.add(connectionSubscriber);
    return undefined;
  });
