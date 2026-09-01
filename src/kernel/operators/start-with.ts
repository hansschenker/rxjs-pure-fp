import { concat } from '../creation/concat.ts';
import type { Observable } from '../observable.ts';
import type { OperatorFunction } from '../operator.ts';

/**
 * Operator algebra: prefixing values is `concat` over `[values, source]` —
 * the values array is itself an `ObservableInput`, exactly as RxJS passes it.
 * The deprecated trailing-scheduler form rides `scheduled` and is deferred to
 * M18 with the other scheduler shapes.
 */
export const startWith = <T, D = T>(...values: D[]): OperatorFunction<T, T | D> =>
  (source) => concat([values, source as Observable<T | D>]);
