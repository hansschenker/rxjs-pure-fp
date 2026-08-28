import { createObservable, subscribe, type Observable } from './observable.ts';
import { createSubscriber, type Observer, type Subscriber } from './sink.ts';
import type { TeardownLogic } from './subscription.ts';

export type OperatorFunction<T, R> = (source: Observable<T>) => Observable<R>;
export type MonoTypeOperatorFunction<T> = OperatorFunction<T, T>;

/** Functional replacement for RxJS `operate`/`lift` plumbing. */
export const operate = <T, R>(
  init: (source: Observable<T>, destination: Subscriber<R>) => TeardownLogic
): OperatorFunction<T, R> =>
  (source) =>
    createObservable((destination) => init(source, destination));

/**
 * Creates an upstream Subscriber owned by `destination` before source execution.
 * Optional handlers model OperatorSubscriber policies without inheritance.
 */
export const createOperatorSubscriber = <T, R>(
  destination: Subscriber<R>,
  onNext?: (value: T) => void,
  onComplete?: () => void,
  onError?: (error: unknown) => void
): Subscriber<T> => {
  const observer: Observer<T> = {
    next(value) {
      if (onNext) {
        try {
          onNext(value);
        } catch (error) {
          destination.error(error);
        }
      } else {
        (destination as unknown as Subscriber<T>).next(value);
      }
    },
    error(error) {
      if (onError) {
        try {
          onError(error);
        } catch (handlerError) {
          destination.error(handlerError);
        }
      } else {
        destination.error(error);
      }
    },
    complete() {
      if (onComplete) {
        try {
          onComplete();
        } catch (error) {
          destination.error(error);
        }
      } else {
        destination.complete();
      }
    },
  };

  const operatorSubscriber = createSubscriber(observer);
  destination.add(operatorSubscriber);
  return operatorSubscriber;
};

/**
 * Starts source execution with an already-owned operator Subscriber and, when
 * supplied, registers finalization after the source teardown has been attached.
 *
 * If the source terminates synchronously, adding to the already-closed child
 * executes finalization immediately — still after source teardown.
 */
export const subscribeOperator = <T>(
  source: Observable<T>,
  operatorSubscriber: Subscriber<T>,
  onFinalize?: () => void
): Subscriber<T> => {
  subscribe(operatorSubscriber)(source);
  if (onFinalize) {
    operatorSubscriber.add(onFinalize);
  }
  return operatorSubscriber;
};
