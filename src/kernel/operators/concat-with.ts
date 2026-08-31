import { concat } from '../creation/concat.ts';
import type { Observable } from '../observable.ts';
import type { MonoTypeOperatorFunction } from '../operator.ts';

/** Operator algebra: concatenating companions is `concat` over `[source, ...others]`. */
export const concatWith = <T>(...others: Array<Observable<T>>): MonoTypeOperatorFunction<T> =>
  (source) => concat([source, ...others]);
