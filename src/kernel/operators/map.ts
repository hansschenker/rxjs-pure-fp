import type { OperatorFunction } from '../operator.ts';
import { emitOne, statefulOperator, type Step } from '../stateful-operator.ts';

export const mapStep = <T, R>(project: (value: T, index: number) => R): Step<null, T, R> =>
  (state, value, index) => [state, emitOne(project(value, index))];

/**
 * Pure kernel projection. The deprecated `thisArg` binding is compat surface
 * (`src/compat/map.ts`).
 */
export const map = <T, R>(project: (value: T, index: number) => R): OperatorFunction<T, R> =>
  statefulOperator(null, mapStep(project));
