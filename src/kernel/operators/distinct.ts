import { innerFrom, type ObservableInput } from '../interop.ts';
import { createOperatorSubscriber, operate, subscribeOperator, type MonoTypeOperatorFunction } from '../operator.ts';

/**
 * Emits values whose selected key has not been seen in the current subscription.
 *
 * Since M16 the flushes source is any `ObservableInput`, converted on
 * subscribe.
 */
export const distinct = <T, K = T>(
  keySelector?: (value: T) => K,
  flushes?: ObservableInput<unknown>
): MonoTypeOperatorFunction<T> =>
  operate((source, destination) => {
    const distinctKeys = new Set<unknown>();

    const sourceSubscriber = createOperatorSubscriber<T, T>(destination, (value) => {
      const key = keySelector ? keySelector(value) : value;
      if (!distinctKeys.has(key)) {
        distinctKeys.add(key);
        destination.next(value);
      }
    });

    subscribeOperator(source, sourceSubscriber);

    if (flushes) {
      const flushSubscriber = createOperatorSubscriber<unknown, T>(
        destination,
        () => distinctKeys.clear(),
        () => undefined
      );
      subscribeOperator(innerFrom(flushes), flushSubscriber);
    }

    return undefined;
  });
