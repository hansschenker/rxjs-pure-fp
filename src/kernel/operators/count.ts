import type { OperatorFunction } from '../operator.ts';
import { reduce } from './reduce.ts';

/** Counts (optionally predicate-matching) source values as `reduce` over a running total — RxJS 7.8.2's own construction. */
export const count = <T>(
  predicate?: (value: T, index: number) => boolean
): OperatorFunction<T, number> =>
  reduce<T, number>(
    (total, value, index) => (!predicate || predicate(value, index) ? total + 1 : total),
    0
  );
