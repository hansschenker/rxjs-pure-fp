import { concat } from '../creation/concat.ts';
import type { ObservableInput } from '../interop.ts';
import type { MonoTypeOperatorFunction } from '../operator.ts';

/** Operator algebra: concatenating companions is `concat` over `[source, ...others]`. */
export const concatWith = <T>(...others: Array<ObservableInput<T>>): MonoTypeOperatorFunction<T> =>
  (source) => concat([source, ...others]);
