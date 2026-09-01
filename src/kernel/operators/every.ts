import type { Observable } from '../observable.ts';
import type { OperatorFunction } from '../operator.ts';
import { emitLast, emitNone, emitOne, statefulOperator } from '../stateful-operator.ts';

/**
 * Emits whether every source value satisfies the predicate: the first failing
 * value emits `false` and completes immediately; source completion (including
 * an empty source) emits `true`. The deprecated `thisArg` binding is compat
 * surface (`src/compat/collection.ts`).
 */
export const every = <T>(
  predicate: (value: T, index: number, source: Observable<T>) => boolean
): OperatorFunction<T, boolean> =>
  (source) =>
    statefulOperator<null, T, boolean>(
      null,
      (state, value, index) => [state, predicate(value, index, source) ? emitNone : emitLast(false)],
      () => emitOne(true)
    )(source);
