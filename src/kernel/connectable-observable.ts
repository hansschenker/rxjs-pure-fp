import type { ObservableInput } from './interop.ts';
import { createObservable, executeSource, isBrandedObservable, type Observable } from './observable.ts';
import {
  createOperatorSubscriber,
  operate,
  type MonoTypeOperatorFunction,
  type OperatorFunction,
} from './operator.ts';
import { connect } from './sharing.ts';
import { createSubscriberWithHooks } from './sink.ts';
import type { Subject } from './subject.ts';
import { EMPTY_SUBSCRIPTION, createSubscription, type Subscription } from './subscription.ts';

/**
 * M18: the deprecated multicast surface — RxJS's `ConnectableObservable`
 * class as a branded callable record. Subscribers attach to a Subject that
 * the factory (re)creates whenever the current one is missing or stopped;
 * `connect()` runs the source into it once, and the connection's terminal
 * or teardown resets the record (`_teardown`). `refCount` drives that
 * connection from subscriber counts through an internal protocol record
 * instead of RxJS's `_refCount`/`_connection` field access.
 */
export type ConnectableObservable<T> = Observable<T> & {
  readonly connect: () => Subscription;
  readonly refCount: () => Observable<T>;
};

type ConnectionProtocol = {
  readonly acquire: () => void;
  readonly release: () => number;
  readonly count: () => number;
  readonly connection: () => Subscription | null;
  readonly connect: () => Subscription;
};

const connectionSymbol = Symbol('rxjs-pure-fp.connectable-observable');

type ConnectionCarrier = { readonly [connectionSymbol]?: ConnectionProtocol };

export const createConnectableObservable = <T>(
  source: Observable<T>,
  subjectFactory: () => Subject<T>
): ConnectableObservable<T> => {
  let subject: Subject<T> | null = null;
  let refCountValue = 0;
  let connection: Subscription | null = null;

  const getSubject = (): Subject<T> => {
    if (!subject || subject.isStopped) {
      subject = subjectFactory();
    }
    return subject;
  };

  const teardown = (): void => {
    refCountValue = 0;
    const priorConnection = connection;
    subject = connection = null;
    priorConnection?.unsubscribe();
  };

  const connectSelf = (): Subscription => {
    let current = connection;
    if (!current) {
      current = connection = createSubscription();
      const target = getSubject();
      const connectionSubscriber = createSubscriberWithHooks<T>(
        {
          next: (value) => target.next(value),
          error: (error) => {
            teardown();
            target.error(error);
          },
          complete: () => {
            teardown();
            target.complete();
          },
        },
        { onFinalize: teardown }
      );
      executeSource(source, connectionSubscriber);
      current.add(connectionSubscriber);
      if (current.closed) {
        connection = null;
        current = EMPTY_SUBSCRIPTION;
      }
    }
    return current;
  };

  const result = createObservable<T>((subscriber) => getSubject()(subscriber)) as Observable<T> & {
    connect: () => Subscription;
    refCount: () => Observable<T>;
    [connectionSymbol]: ConnectionProtocol;
  };
  result.connect = connectSelf;
  result.refCount = () => refCount<T>()(result);
  result[connectionSymbol] = {
    acquire: () => {
      refCountValue += 1;
    },
    release: () => {
      refCountValue -= 1;
      return refCountValue;
    },
    count: () => refCountValue,
    connection: () => connection,
    connect: connectSelf,
  };
  return result as ConnectableObservable<T>;
};

/**
 * Connects the source when the first subscriber arrives and disconnects it
 * when the last leaves — RxJS's `refCount` handshake ported exactly: the
 * connection is only torn down by the subscriber that observed it being made
 * (or by one that never saw a connection at all).
 */
export const refCount = <T>(): MonoTypeOperatorFunction<T> =>
  operate((source, destination) => {
    const protocol = (source as ConnectionCarrier)[connectionSymbol];
    if (!protocol) {
      throw new TypeError('refCount() requires a ConnectableObservable source');
    }
    let connection: Subscription | null = null;
    protocol.acquire();
    const refCounter = createOperatorSubscriber<T, T>(destination, undefined, undefined, undefined, () => {
      if (protocol.count() <= 0 || 0 < protocol.release()) {
        connection = null;
        return;
      }
      const sharedConnection = protocol.connection();
      const conn = connection;
      connection = null;
      if (sharedConnection && (!conn || sharedConnection === conn)) {
        sharedConnection.unsubscribe();
      }
      destination.unsubscribe();
    });
    executeSource(source, refCounter);
    if (!refCounter.closed) {
      connection = protocol.connect();
    }
    return undefined;
  });

/**
 * Subjects are callable hub records in this representation, so a subject
 * argument is told apart from a factory by its observer shape rather than by
 * `typeof` (RxJS's `isFunction` check).
 */
const isSubjectRecord = <T>(value: unknown): value is Subject<T> =>
  isBrandedObservable(value) && typeof (value as Partial<Subject<T>>).next === 'function';

/**
 * Deprecated RxJS 7.8.2 multicast operator: with a selector it is `connect`
 * over the given connector; without one it produces a `ConnectableObservable`
 * whose subject comes from the factory (a subject instance is reused).
 */
export function multicast<T>(
  subject: Subject<T> | (() => Subject<T>)
): (source: Observable<T>) => ConnectableObservable<T>;
export function multicast<T, O>(
  subject: Subject<T> | (() => Subject<T>),
  selector: (shared: Observable<T>) => ObservableInput<O>
): OperatorFunction<T, O>;
export function multicast<T, O>(
  subjectOrSubjectFactory: Subject<T> | (() => Subject<T>),
  selector?: (shared: Observable<T>) => ObservableInput<O>
): OperatorFunction<T, O> | ((source: Observable<T>) => ConnectableObservable<T>) {
  const subjectFactory = isSubjectRecord<T>(subjectOrSubjectFactory)
    ? () => subjectOrSubjectFactory
    : subjectOrSubjectFactory;
  if (typeof selector === 'function') {
    return connect(selector, { connector: subjectFactory });
  }
  return (source) => createConnectableObservable(source, subjectFactory);
}
