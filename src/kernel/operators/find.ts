import type { Observable } from '../observable.ts';
import type { OperatorFunction } from '../operator.ts';
import { emitLast, emitNone, emitOne, statefulOperator, type Emit } from '../stateful-operator.ts';

/**
 * Shared find machinery (RxJS `createFind`): the first matching value emits
 * the value (`find`) or its index (`findIndex`) and completes; completion
 * without a match emits the miss sentinel (`undefined` / `-1`). The
 * deprecated `thisArg` binding is compat surface (`src/compat/collection.ts`).
 */
const findWith = <T, R>(
  predicate: (value: T, index: number, source: Observable<T>) => boolean,
  hit: (value: T, index: number) => Emit<R>,
  miss: Emit<R>
): OperatorFunction<T, R> =>
  (source) =>
    statefulOperator<null, T, R>(
      null,
      (state, value, index) => [state, predicate(value, index, source) ? hit(value, index) : emitNone],
      () => miss
    )(source);

export function find<T, S extends T>(
  predicate: (value: T, index: number, source: Observable<T>) => value is S
): OperatorFunction<T, S | undefined>;
export function find<T>(
  predicate: (value: T, index: number, source: Observable<T>) => boolean
): OperatorFunction<T, T | undefined>;
export function find<T>(
  predicate: (value: T, index: number, source: Observable<T>) => boolean
): OperatorFunction<T, T | undefined> {
  return findWith(predicate, (value) => emitLast(value), emitOne<T | undefined>(undefined));
}

export const findIndex = <T>(
  predicate: (value: T, index: number, source: Observable<T>) => boolean
): OperatorFunction<T, number> =>
  findWith(predicate, (_value, index) => emitLast(index), emitOne(-1));
