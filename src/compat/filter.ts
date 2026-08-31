import type { MonoTypeOperatorFunction, OperatorFunction } from '../kernel/operator.ts';
import { filter as filterKernel } from '../kernel/operators/filter.ts';

/**
 * RxJS 7.8.2 parity surface: retains the deprecated `thisArg` binding by
 * wrapping the predicate before delegating to the pure kernel operator.
 */
export function filter<T, S extends T>(
  predicate: (value: T, index: number) => value is S
): OperatorFunction<T, S>;
export function filter<T, A = undefined>(
  predicate: (this: A, value: T, index: number) => boolean,
  thisArg?: A
): MonoTypeOperatorFunction<T>;
export function filter<T, A = undefined>(
  predicate: (this: A, value: T, index: number) => boolean,
  thisArg?: A
): MonoTypeOperatorFunction<T> {
  return filterKernel<T>((value, index) => Reflect.apply(predicate, thisArg, [value, index]));
}
