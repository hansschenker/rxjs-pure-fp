import type { OperatorFunction } from '../operator.ts';
import { emitNone, emitOne, statefulOperator } from '../stateful-operator.ts';

/**
 * Collection as a pure accumulation step: each value extends a fresh array,
 * so the shared `null` seed never leaks state between subscriptions (RxJS
 * builds a per-subscription `reduce` seed for the same reason). Completion
 * always emits — an empty source yields `[]`.
 */
export const toArray = <T>(): OperatorFunction<T, T[]> =>
  statefulOperator<ReadonlyArray<T> | null, T, T[]>(
    null,
    (state, value) => [state === null ? [value] : [...state, value], emitNone],
    (state) => emitOne(state === null ? [] : (state as T[]))
  );
