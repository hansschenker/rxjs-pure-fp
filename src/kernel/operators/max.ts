import type { MonoTypeOperatorFunction } from '../operator.ts';
import { reduce } from './reduce.ts';

/**
 * Largest source value as seedless `reduce` — RxJS 7.8.2's own construction:
 * a positive `comparer(x, y)` keeps `x`; without a comparer the native `>`
 * ordering decides. An empty source completes without emitting.
 */
export const max = <T>(comparer?: (x: T, y: T) => number): MonoTypeOperatorFunction<T> =>
  reduce<T, T>(
    typeof comparer === 'function'
      ? (x, y) => (comparer(x, y) > 0 ? x : y)
      : (x, y) => (x > y ? x : y)
  );
