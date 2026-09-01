import {
  createConnectableObservable,
  multicast,
  type ConnectableObservable as ConnectableObservableRecord,
} from '../kernel/connectable-observable.ts';
import type { ObservableInput } from '../kernel/interop.ts';
import type { Observable } from '../kernel/observable.ts';
import type { OperatorFunction } from '../kernel/operator.ts';
import type { TimestampProvider } from '../kernel/scheduler.ts';
import { connect } from '../kernel/sharing.ts';
import {
  createAsyncSubject,
  createBehaviorSubject,
  createReplaySubject,
  createSubject,
  type Subject,
} from '../kernel/subject.ts';

/**
 * RxJS 7.8.2 root-parity names for the deprecated multicast surface.
 * `ConnectableObservable` is, like the other class-named parity exports, a
 * non-constructible functional factory over the kernel record; the `publish`
 * family is RxJS's own algebra over `multicast` and the subject factories.
 */

export type ConnectableObservable<T> = ConnectableObservableRecord<T>;

export const ConnectableObservable = <T>(
  source: Observable<T>,
  subjectFactory: () => Subject<T>
): ConnectableObservableRecord<T> => createConnectableObservable(source, subjectFactory);

/** With a selector: `connect(selector)`; without: `multicast` over one fresh Subject. */
export function publish<T>(): (source: Observable<T>) => ConnectableObservableRecord<T>;
export function publish<T, O>(
  selector: (shared: Observable<T>) => ObservableInput<O>
): OperatorFunction<T, O>;
export function publish<T, O>(
  selector?: (shared: Observable<T>) => ObservableInput<O>
): OperatorFunction<T, O> | ((source: Observable<T>) => ConnectableObservableRecord<T>) {
  return selector
    ? (source: Observable<T>) => connect(selector)(source)
    : (source: Observable<T>) => multicast(createSubject<T>())(source);
}

/** One BehaviorSubject per source application, reused across reconnects. */
export const publishBehavior =
  <T>(initialValue: T) =>
  (source: Observable<T>): ConnectableObservableRecord<T> => {
    const subject = createBehaviorSubject(initialValue);
    return createConnectableObservable(source, () => subject);
  };

/** One AsyncSubject per source application, reused across reconnects. */
export const publishLast =
  <T>() =>
  (source: Observable<T>): ConnectableObservableRecord<T> => {
    const subject = createAsyncSubject<T>();
    return createConnectableObservable(source, () => subject);
  };

/**
 * One ReplaySubject per source application. The third argument is either the
 * selector or (deprecated) the replay window's clock; a selector makes this
 * `connect` algebra, otherwise a `ConnectableObservable`.
 */
export function publishReplay<T>(
  bufferSize?: number,
  windowTime?: number,
  timestampProvider?: TimestampProvider
): (source: Observable<T>) => ConnectableObservableRecord<T>;
export function publishReplay<T, O>(
  bufferSize: number | undefined,
  windowTime: number | undefined,
  selector: (shared: Observable<T>) => ObservableInput<O>,
  timestampProvider?: TimestampProvider
): OperatorFunction<T, O>;
export function publishReplay<T, O>(
  bufferSize?: number,
  windowTime?: number,
  selectorOrScheduler?: ((shared: Observable<T>) => ObservableInput<O>) | TimestampProvider,
  timestampProvider?: TimestampProvider
): OperatorFunction<T, O> | ((source: Observable<T>) => ConnectableObservableRecord<T>) {
  if (selectorOrScheduler && typeof selectorOrScheduler !== 'function') {
    timestampProvider = selectorOrScheduler;
  }
  const selector = typeof selectorOrScheduler === 'function' ? selectorOrScheduler : undefined;
  const subjectFor = (): Subject<T> => createReplaySubject<T>(bufferSize, windowTime, timestampProvider);
  if (selector) {
    return (source: Observable<T>) => multicast(subjectFor(), selector)(source);
  }
  return (source: Observable<T>) => multicast(subjectFor())(source);
}
