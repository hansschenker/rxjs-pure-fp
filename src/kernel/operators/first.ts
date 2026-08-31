import { createEmptyError } from '../errors.ts';
import type { Observable } from '../observable.ts';
import type { MonoTypeOperatorFunction, OperatorFunction } from '../operator.ts';
import { identity, pipeValue } from '../pipe.ts';
import { filter } from './filter.ts';
import { defaultIfEmpty, throwIfEmpty } from './presence.ts';
import { take } from './take.ts';

/**
 * Pure operator algebra, exactly as in RxJS: optional predicate gate, then
 * `take(1)`, then the empty policy (default value or `EmptyError`).
 */
export function first<T, D>(
  predicate?: ((value: T, index: number, source: Observable<T>) => boolean) | null,
  defaultValue?: D
): OperatorFunction<T, T | D> {
  const hasDefaultValue = arguments.length >= 2;
  return (source) =>
    pipeValue(
      source,
      predicate
        ? filter((value, index) => predicate(value, index, source))
        : (identity as MonoTypeOperatorFunction<T>),
      take(1),
      (hasDefaultValue
        ? defaultIfEmpty(defaultValue as D)
        : throwIfEmpty(createEmptyError)) as OperatorFunction<T, T | D>
    );
}
