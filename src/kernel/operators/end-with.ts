import { concat } from '../creation/concat.ts';
import { of } from '../creation/of.ts';
import type { Observable } from '../observable.ts';
import type { OperatorFunction } from '../operator.ts';

/**
 * Operator algebra: suffixing values is `concat` over `[source, of(values)]`.
 * The deprecated scheduler-in-rest-arguments form is deferred to M18 with the
 * other scheduler shapes.
 */
export const endWith = <T, D = T>(...values: D[]): OperatorFunction<T, T | D> =>
  (source) => concat([source as Observable<T | D>, of(...values)]);
