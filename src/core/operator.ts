import { createObservable, type Observable } from './observable.ts';
import { createSubscriber, type Observer, type Subscriber } from './sink.ts';
import type { TeardownLogic } from './subscription.ts';

export type OperatorFunction<T, R> = (source: Observable<T>) => Observable<R>;
export type MonoTypeOperatorFunction<T> = OperatorFunction<T, T>;

/**
 * Functional replacement for RxJS's `operate`/`lift` plumbing.
 *
 * Operator construction remains lazy: `init` is called only when the resulting
 * Observable is subscribed to.
 */
export const operate = <T, R>(
  init: (source: Observable<T>, destination: Subscriber<R>) => TeardownLogic
): OperatorFunction<T, R> =>
  (source) =>
    createObservable((destination) => init(source, destination));

/**
 * Creates an upstream Subscriber that is immediately owned by the downstream
 * Subscriber and intercepts source `next` notifications.
 *
 * Attaching the child before source execution is essential for synchronous
 * cancellation: downstream unsubscription inside a `next` handler must close
 * the upstream Subscriber before a synchronous source emits again.
 */
export const createOperatorSubscriber = <T, R>(
  destination: Subscriber<R>,
  onNext: (value: T) => void
): Subscriber<T> => {
  const observer: Observer<T> = {
    next(value) {
      try {
        onNext(value);
      } catch (error) {
        destination.error(error);
      }
    },
    error(error) {
      destination.error(error);
    },
    complete() {
      destination.complete();
    },
  };

  const operatorSubscriber = createSubscriber(observer);
  destination.add(operatorSubscriber);
  return operatorSubscriber;
};
