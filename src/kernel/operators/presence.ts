import { createEmptyError } from '../errors.ts';
import type { MonoTypeOperatorFunction, OperatorFunction } from '../operator.ts';
import { emitNone, emitOne, statefulOperator, type Step } from '../stateful-operator.ts';

export type PresenceState = { readonly has: boolean };

/** Passes values through while remembering that at least one arrived. */
export const presenceStep = <T>(): Step<PresenceState, T, T> =>
  (state, value) => [state.has ? state : { has: true }, emitOne(value)];

/** Emits `defaultValue` before completion when the source was empty. */
export const defaultIfEmpty = <T, R>(defaultValue: R): OperatorFunction<T, T | R> =>
  statefulOperator<PresenceState, T, T | R>({ has: false }, presenceStep(), (state) =>
    state.has ? emitNone : emitOne(defaultValue)
  );

/**
 * Errors instead of completing when the source was empty. The flush throw is
 * the step-function error channel: the runner routes it downstream.
 */
export const throwIfEmpty = <T>(errorFactory: () => unknown = createEmptyError): MonoTypeOperatorFunction<T> =>
  statefulOperator<PresenceState, T, T>({ has: false }, presenceStep(), (state) => {
    if (!state.has) {
      throw errorFactory();
    }
    return emitNone;
  });
