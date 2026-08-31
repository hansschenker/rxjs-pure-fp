import type { OperatorFunction } from '../kernel/operator.ts';
import { map as mapKernel } from '../kernel/operators/map.ts';

/**
 * RxJS 7.8.2 parity surface: retains the deprecated `thisArg` binding by
 * wrapping the projection before delegating to the pure kernel operator.
 */
export const map = <T, R, A = undefined>(
  project: (this: A, value: T, index: number) => R,
  thisArg?: A
): OperatorFunction<T, R> =>
  mapKernel((value, index) => Reflect.apply(project, thisArg, [value, index]));
