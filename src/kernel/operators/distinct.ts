import type { Observable } from '../observable.ts';
import { createOperatorSubscriber, operate, subscribeOperator, type MonoTypeOperatorFunction } from '../operator.ts';

/**
 * Emits values whose selected key has not been seen in the current subscription.
 *
 * M05 supports functional Observable flushes. Full RxJS `ObservableInput`
 * conversion for the flushes parameter is deferred until the creation/input
 * interoperability surface is implemented.
 */
export const distinct = <T, K = T>(
  keySelector?: (value: T) => K,
  flushes?: Observable<unknown>
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
      subscribeOperator(flushes, flushSubscriber);
    }

    return undefined;
  });
