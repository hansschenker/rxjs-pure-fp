import { createEmptyError, createNotFoundError, createSequenceError } from '../errors.ts';
import type { Observable } from '../observable.ts';
import type { MonoTypeOperatorFunction } from '../operator.ts';
import { emitNone, emitOne, statefulOperator, type Step } from '../stateful-operator.ts';

export type SingleState<T> =
  | { readonly seen: false; readonly has: false }
  | { readonly seen: true; readonly has: false }
  | { readonly seen: true; readonly has: true; readonly value: T };

/**
 * A second matching value throws `SequenceError` through the step error
 * channel; the flush decides between the single value, `NotFoundError`
 * (values arrived, none matched), and `EmptyError` (no values at all).
 */
export const singleStep = <T>(
  source: Observable<T>,
  predicate?: (value: T, index: number, source: Observable<T>) => boolean
): Step<SingleState<T>, T, T> =>
  (state, value, index) => {
    if (!predicate || predicate(value, index, source)) {
      if (state.has) {
        throw createSequenceError('Too many matching values');
      }
      return [{ seen: true, has: true, value }, emitNone];
    }
    return [state.has ? state : { seen: true, has: false }, emitNone];
  };

export const single = <T>(
  predicate?: (value: T, index: number, source: Observable<T>) => boolean
): MonoTypeOperatorFunction<T> =>
  (source) =>
    statefulOperator<SingleState<T>, T, T>(
      { seen: false, has: false },
      singleStep(source, predicate),
      (state) => {
        if (state.has) {
          return emitOne(state.value);
        }
        throw state.seen ? createNotFoundError('No matching values') : createEmptyError();
      }
    )(source);
