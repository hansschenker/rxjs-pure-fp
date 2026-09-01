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

/**
 * RxJS `mapOneOrManyArgs`: spreads array values into the projection and
 * passes scalars directly — the shared result-selector shape of `fromEvent`,
 * `fromEventPattern`, and the callback-binding surfaces (M16).
 */
export const mapOneOrManyArgs = <T, R>(
  fn: (...values: T[]) => R
): OperatorFunction<T | T[], R> =>
  map((args: T | T[]) => (Array.isArray(args) ? fn(...args) : fn(args)));
