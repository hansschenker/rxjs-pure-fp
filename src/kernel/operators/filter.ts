import type { MonoTypeOperatorFunction, OperatorFunction } from '../operator.ts';
import { emitNone, emitOne, statefulOperator, type Step } from '../stateful-operator.ts';

export const filterStep = <T>(predicate: (value: T, index: number) => boolean): Step<null, T, T> =>
  (state, value, index) => [state, predicate(value, index) ? emitOne(value) : emitNone];

/**
 * Pure kernel gate. The deprecated `thisArg` binding is compat surface
 * (`src/compat/filter.ts`).
 */
export function filter<T, S extends T>(
  predicate: (value: T, index: number) => value is S
): OperatorFunction<T, S>;
export function filter<T>(predicate: (value: T, index: number) => boolean): MonoTypeOperatorFunction<T>;
export function filter<T>(predicate: (value: T, index: number) => boolean): MonoTypeOperatorFunction<T> {
  return statefulOperator(null, filterStep(predicate));
}
