import { EMPTY } from '../creation/empty.ts';
import { timer } from '../creation/timer.ts';
import { type Observable } from '../observable.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type MonoTypeOperatorFunction,
} from '../operator.ts';
import type { Subscriber } from '../sink.ts';

/**
 * `delay` is either a per-repeat notifier factory or (since M14) a number of
 * milliseconds, which is `timer(delay)` as in RxJS. A delay notifier that
 * completes without emitting completes the result.
 */
export type RepeatConfig = {
  readonly count?: number;
  readonly delay?: number | ((repeatCount: number) => Observable<unknown>);
};

export function repeat<T>(count?: number): MonoTypeOperatorFunction<T>;
export function repeat<T>(config: RepeatConfig): MonoTypeOperatorFunction<T>;
export function repeat<T>(countOrConfig: number | RepeatConfig = Infinity): MonoTypeOperatorFunction<T> {
  const { count = Infinity, delay } =
    typeof countOrConfig === 'object' && countOrConfig !== null
      ? countOrConfig
      : { count: countOrConfig };

  return count <= 0
    ? () => EMPTY
    : operate((source, destination) => {
        let soFar = 0;
        let sourceSubscriber: Subscriber<T> | null = null;

        const resubscribe = (): void => {
          sourceSubscriber?.unsubscribe();
          sourceSubscriber = null;
          if (delay != null) {
            let notifierSubscriber!: Subscriber<unknown>;
            notifierSubscriber = createOperatorSubscriber<unknown, T>(
              destination,
              () => {
                notifierSubscriber.unsubscribe();
                subscribeToSource();
              },
              () => {
                destination.complete();
              }
            );
            const notifier = typeof delay === 'number' ? timer(delay) : delay(soFar);
            subscribeOperator(notifier, notifierSubscriber);
          } else {
            subscribeToSource();
          }
        };

        const subscribeToSource = (): void => {
          let syncUnsub = false;
          const attempt = createOperatorSubscriber<T, T>(destination, undefined, () => {
            soFar += 1;
            if (soFar < count) {
              if (sourceSubscriber) {
                resubscribe();
              } else {
                syncUnsub = true;
              }
            } else {
              destination.complete();
            }
          });
          subscribeOperator(source, attempt);
          sourceSubscriber = attempt;
          if (syncUnsub) {
            resubscribe();
          }
        };
        subscribeToSource();
        return undefined;
      });
}
