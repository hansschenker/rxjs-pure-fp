import type { OperatorFunction } from '../operator.ts';
import { emitNone, emitOne, statefulOperator, type Step } from '../stateful-operator.ts';

export type PairwiseState<T> =
  | { readonly has: false }
  | { readonly has: true; readonly previous: T };

export const pairwiseStep = <T>(): Step<PairwiseState<T>, T, [T, T]> =>
  (state, value) => [
    { has: true, previous: value },
    state.has ? emitOne<[T, T]>([state.previous, value]) : emitNone,
  ];

export const pairwise = <T>(): OperatorFunction<T, [T, T]> =>
  statefulOperator<PairwiseState<T>, T, [T, T]>({ has: false }, pairwiseStep<T>());
