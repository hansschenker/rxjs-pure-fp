import { timer } from '../creation/timer.ts';
import type { Observable } from '../observable.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type MonoTypeOperatorFunction,
} from '../operator.ts';
import { identity } from '../pipe.ts';
import type { Subscriber } from '../sink.ts';

/**
 * `delay` is either a per-attempt notifier factory or (since M14) a number of
 * milliseconds, which is `timer(delay)` as in RxJS. A delay notifier that
 * completes without emitting completes the result.
 */
export type RetryConfig = {
  readonly count?: number;
  readonly delay?: number | ((error: unknown, retryCount: number) => Observable<unknown>);
  readonly resetOnSuccess?: boolean;
};

export function retry<T>(count?: number): MonoTypeOperatorFunction<T>;
export function retry<T>(config: RetryConfig): MonoTypeOperatorFunction<T>;
export function retry<T>(configOrCount: number | RetryConfig = Infinity): MonoTypeOperatorFunction<T> {
  const config: RetryConfig =
    typeof configOrCount === 'object' && configOrCount !== null
      ? configOrCount
      : { count: configOrCount };
  const { count = Infinity, delay, resetOnSuccess = false } = config;

  return count <= 0
    ? identity
    : operate((source, destination) => {
        let soFar = 0;
        let innerSubscriber: Subscriber<T> | null = null;

        const subscribeForRetry = (): void => {
          let syncUnsub = false;
          const attempt = createOperatorSubscriber<T, T>(
            destination,
            (value) => {
              if (resetOnSuccess) {
                soFar = 0;
              }
              destination.next(value);
            },
            undefined,
            (error) => {
              if (soFar < count) {
                soFar += 1;
                const resub = (): void => {
                  if (innerSubscriber) {
                    innerSubscriber.unsubscribe();
                    innerSubscriber = null;
                    subscribeForRetry();
                  } else {
                    syncUnsub = true;
                  }
                };
                if (delay != null) {
                  let notifierSubscriber!: Subscriber<unknown>;
                  notifierSubscriber = createOperatorSubscriber<unknown, T>(
                    destination,
                    () => {
                      notifierSubscriber.unsubscribe();
                      resub();
                    },
                    () => {
                      destination.complete();
                    }
                  );
                  const notifier = typeof delay === 'number' ? timer(delay) : delay(error, soFar);
                  subscribeOperator(notifier, notifierSubscriber);
                } else {
                  resub();
                }
              } else {
                destination.error(error);
              }
            }
          );
          subscribeOperator(source, attempt);
          innerSubscriber = attempt;
          if (syncUnsub) {
            innerSubscriber.unsubscribe();
            innerSubscriber = null;
            subscribeForRetry();
          }
        };
        subscribeForRetry();
        return undefined;
      });
}
