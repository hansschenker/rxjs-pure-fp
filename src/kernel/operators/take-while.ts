import type { MonoTypeOperatorFunction, OperatorFunction } from '../operator.ts';
import { emitDone, emitLast, emitOne, statefulOperator, type Step } from '../stateful-operator.ts';

export const takeWhileStep = <T>(
  predicate: (value: T, index: number) => boolean,
  inclusive: boolean
): Step<null, T, T> =>
  (state, value, index) => {
    const passes = predicate(value, index);
    return [state, passes ? emitOne(value) : inclusive ? emitLast(value) : emitDone];
  };

export function takeWhile<T, S extends T>(
  predicate: (value: T, index: number) => value is S
): OperatorFunction<T, S>;
export function takeWhile<T>(
  predicate: (value: T, index: number) => boolean,
  inclusive?: boolean
): MonoTypeOperatorFunction<T>;
export function takeWhile<T>(
  predicate: (value: T, index: number) => boolean,
  inclusive = false
): MonoTypeOperatorFunction<T> {
  return statefulOperator(null, takeWhileStep(predicate, inclusive));
}
