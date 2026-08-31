import { createArgumentOutOfRangeError } from '../errors.ts';
import type { OperatorFunction } from '../operator.ts';
import { pipeValue } from '../pipe.ts';
import { filter } from './filter.ts';
import { defaultIfEmpty, throwIfEmpty } from './presence.ts';
import { take } from './take.ts';

/**
 * Pure operator algebra, exactly as in RxJS: index gate, then `take(1)`, then
 * the out-of-range policy (default value or `ArgumentOutOfRangeError`). A
 * negative index throws synchronously at call time.
 */
export function elementAt<T, D = T>(index: number, defaultValue?: D): OperatorFunction<T, T | D> {
  if (index < 0) {
    throw createArgumentOutOfRangeError();
  }
  const hasDefaultValue = arguments.length >= 2;
  return (source) =>
    pipeValue(
      source,
      filter((_value, i) => i === index),
      take(1),
      (hasDefaultValue
        ? defaultIfEmpty(defaultValue as D)
        : throwIfEmpty(createArgumentOutOfRangeError)) as OperatorFunction<T, T | D>
    );
}
