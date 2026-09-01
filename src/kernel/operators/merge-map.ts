import { flattenWith, overlapPolicy } from '../flattening.ts';
import type { ObservableInput } from '../interop.ts';
import type { OperatorFunction } from '../operator.ts';

/**
 * Overlap policy over the M07 machine. The deprecated `resultSelector`
 * overload is compat surface (`src/compat/flattening.ts`).
 */
export const mergeMap = <T, R>(
  project: (value: T, index: number) => ObservableInput<R>,
  concurrent = Infinity
): OperatorFunction<T, R> => flattenWith(overlapPolicy(concurrent), project);
