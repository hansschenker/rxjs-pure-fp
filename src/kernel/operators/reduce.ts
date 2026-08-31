import type { OperatorFunction } from '../operator.ts';
import { emitNone, emitOne, statefulOperator } from '../stateful-operator.ts';
import { accumulationStep, type AccumulationState } from './accumulation.ts';

export function reduce<V, A = V>(
  accumulator: (accumulator: A | V, value: V, index: number) => A
): OperatorFunction<V, V | A>;
export function reduce<V, A>(
  accumulator: (accumulator: A, value: V, index: number) => A,
  seed: A
): OperatorFunction<V, A>;
export function reduce<V, A, S = A>(
  accumulator: (accumulator: A | S, value: V, index: number) => A,
  seed: S
): OperatorFunction<V, A>;
export function reduce<V, A, S>(
  accumulator: (accumulated: V | A | S, value: V, index: number) => A,
  seed?: S
): OperatorFunction<V, V | A> {
  type C = V | A | S;
  const initial: AccumulationState<C> =
    arguments.length >= 2 ? { has: true, accumulated: seed as S } : { has: false };
  return statefulOperator(
    initial,
    accumulationStep<C, V>(accumulator, false),
    (state) => (state.has ? emitOne(state.accumulated) : emitNone)
  ) as OperatorFunction<V, V | A>;
}
