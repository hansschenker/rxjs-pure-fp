import { zip } from '../creation/zip.ts';
import type { ObservableInput } from '../interop.ts';
import type { OperatorFunction } from '../operator.ts';

/** Operator algebra: `zip` over `[source, ...others]`. */
export const zipWith = <T, O>(...others: Array<ObservableInput<O>>): OperatorFunction<T, Array<T | O>> =>
  (source) => zip<T | O>([source, ...others]);
