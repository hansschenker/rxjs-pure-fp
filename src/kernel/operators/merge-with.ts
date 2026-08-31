import { merge } from '../creation/merge.ts';
import type { Observable } from '../observable.ts';
import type { MonoTypeOperatorFunction } from '../operator.ts';

/** Operator algebra: merging with companions is `merge` over `[source, ...others]`. */
export const mergeWith = <T>(...others: Array<Observable<T>>): MonoTypeOperatorFunction<T> =>
  (source) => merge([source, ...others]);
