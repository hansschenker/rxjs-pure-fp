import type { MonoTypeOperatorFunction } from '../operator.ts';
import { emitNone, emitOne, statefulOperator, type Step } from '../stateful-operator.ts';

export type SkipWhileState = { readonly taking: boolean };

/**
 * The predicate is consulted only until it first fails; the failing value is
 * the first one taken, matching RxJS.
 */
export const skipWhileStep = <T>(predicate: (value: T, index: number) => boolean): Step<SkipWhileState, T, T> =>
  (state, value, index) =>
    state.taking
      ? [state, emitOne(value)]
      : predicate(value, index)
        ? [state, emitNone]
        : [{ taking: true }, emitOne(value)];

export const skipWhile = <T>(predicate: (value: T, index: number) => boolean): MonoTypeOperatorFunction<T> =>
  statefulOperator<SkipWhileState, T, T>({ taking: false }, skipWhileStep(predicate));
