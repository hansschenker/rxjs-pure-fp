import { combineLatest } from '../creation/combine-latest.ts';
import type { Observable } from '../observable.ts';
import type { OperatorFunction } from '../operator.ts';

/** Operator algebra: `combineLatest` over `[source, ...others]`. */
export const combineLatestWith = <T, O>(
  ...others: Array<Observable<O>>
): OperatorFunction<T, Array<T | O>> =>
  (source) => combineLatest<T | O>([source, ...others]);
