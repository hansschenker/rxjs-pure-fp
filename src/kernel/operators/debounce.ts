import type { Observable } from '../observable.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type MonoTypeOperatorFunction,
} from '../operator.ts';
import { noop } from '../pipe.ts';
import type { Subscriber } from '../sink.ts';

/**
 * Emits the latest value once its duration notifier fires — every new source
 * value cancels the previous duration and starts a fresh one, so only a value
 * whose duration outlives the quiet period gets out. Source completion
 * flushes a pending value first; duration completion without a value is
 * swallowed (`noop`). Per-subscription state is released through the operator
 * finalize hook, as in RxJS.
 */
export const debounce = <T>(
  durationSelector: (value: T) => Observable<unknown>
): MonoTypeOperatorFunction<T> =>
  operate((source, destination) => {
    let hasValue = false;
    let lastValue: T | null = null;
    let durationSubscriber: Subscriber<unknown> | null = null;

    const emit = (): void => {
      durationSubscriber?.unsubscribe();
      durationSubscriber = null;
      if (hasValue) {
        hasValue = false;
        const value = lastValue as T;
        lastValue = null;
        destination.next(value);
      }
    };

    return subscribeOperator(
      source,
      createOperatorSubscriber<T, T>(
        destination,
        (value) => {
          durationSubscriber?.unsubscribe();
          hasValue = true;
          lastValue = value;
          durationSubscriber = createOperatorSubscriber<unknown, T>(destination, emit, noop);
          subscribeOperator(durationSelector(value), durationSubscriber);
        },
        () => {
          emit();
          destination.complete();
        },
        undefined,
        () => {
          lastValue = null;
          durationSubscriber = null;
        }
      )
    );
  });
