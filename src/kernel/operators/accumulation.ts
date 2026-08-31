import { emitNone, emitOne, type Step } from '../stateful-operator.ts';

export type AccumulationState<C> =
  | { readonly has: false }
  | { readonly has: true; readonly accumulated: C };

/**
 * Shared accumulation step behind `scan` and `reduce`, successor of the
 * former `scanInternals`. The unseeded first value becomes the state without
 * calling the accumulator; `emitOnNext` is the scan/reduce policy flag.
 */
export const accumulationStep = <C, V extends C>(
  accumulator: (accumulated: C, value: V, index: number) => C,
  emitOnNext: boolean
): Step<AccumulationState<C>, V, C> =>
  (state, value, index) => {
    const accumulated = state.has ? accumulator(state.accumulated, value, index) : value;
    return [{ has: true, accumulated }, emitOnNext ? emitOne(accumulated) : emitNone];
  };
