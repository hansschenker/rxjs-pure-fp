import { merge } from '../creation/merge.ts';
import type { ObservableInput } from '../interop.ts';
import type { MonoTypeOperatorFunction } from '../operator.ts';

/** Operator algebra: merging with companions is `merge` over `[source, ...others]`. */
export const mergeWith = <T>(...others: Array<ObservableInput<T>>): MonoTypeOperatorFunction<T> =>
  (source) => merge([source, ...others]);
