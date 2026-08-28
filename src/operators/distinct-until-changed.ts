import { createOperatorSubscriber, operate, subscribeOperator, type MonoTypeOperatorFunction } from '../core/operator.ts';

export function distinctUntilChanged<T>(
  comparator?: ((previous: T, current: T) => boolean) | null
): MonoTypeOperatorFunction<T>;
export function distinctUntilChanged<T, K>(
  comparator: ((previous: K, current: K) => boolean) | null | undefined,
  keySelector: (value: T) => K
): MonoTypeOperatorFunction<T>;
export function distinctUntilChanged<T, K>(
  comparator?: ((previous: K, current: K) => boolean) | null,
  keySelector: (value: T) => K = identity as (value: T) => K
): MonoTypeOperatorFunction<T> {
  const compare = comparator ?? defaultCompare;

  return operate((source, destination) => {
    let previousKey!: K;
    let first = true;

    const operatorSubscriber = createOperatorSubscriber<T, T>(destination, (value) => {
      const currentKey = keySelector(value);
      if (first || !compare(previousKey, currentKey)) {
        // State is updated before emission because downstream code can re-enter.
        first = false;
        previousKey = currentKey;
        destination.next(value);
      }
    });

    return subscribeOperator(source, operatorSubscriber);
  });
}

const identity = <T>(value: T): T => value;
const defaultCompare = <T>(previous: T, current: T): boolean => previous === current;
