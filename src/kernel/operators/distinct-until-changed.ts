import type { MonoTypeOperatorFunction } from '../operator.ts';
import { emitNone, emitOne, statefulOperator, type Step } from '../stateful-operator.ts';

export type DistinctComparisonState<K> =
  | { readonly first: true }
  | { readonly first: false; readonly key: K };

/**
 * Suppressed values return the incoming state unchanged, so the remembered key
 * only advances on emission. The runner commits state before emitting, which
 * preserves RxJS reentrancy semantics structurally.
 */
export const distinctUntilChangedStep = <T, K>(
  comparator: (previous: K, current: K) => boolean,
  keySelector: (value: T) => K
): Step<DistinctComparisonState<K>, T, T> =>
  (state, value) => {
    const key = keySelector(value);
    return state.first || !comparator(state.key, key)
      ? [{ first: false, key }, emitOne(value)]
      : [state, emitNone];
  };

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
  return statefulOperator<DistinctComparisonState<K>, T, T>(
    { first: true },
    distinctUntilChangedStep(comparator ?? defaultCompare, keySelector)
  );
}

const identity = <T>(value: T): T => value;
const defaultCompare = <T>(previous: T, current: T): boolean => previous === current;
