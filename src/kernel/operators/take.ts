import { EMPTY } from '../creation/empty.ts';
import type { MonoTypeOperatorFunction } from '../operator.ts';
import { emitLast, emitNone, emitOne, statefulOperator, type Step } from '../stateful-operator.ts';

export const takeStep = <T>(count: number): Step<number, T, T> =>
  (seen, value) => {
    const total = seen + 1;
    // Terminal `last` emits the final value and completes after it, matching
    // RxJS's next-then-complete ordering; extra reentrant values fall through
    // to `none` under the committed count.
    return total < count ? [total, emitOne(value)] : total === count ? [total, emitLast(value)] : [seen, emitNone];
  };

export const take = <T>(count: number): MonoTypeOperatorFunction<T> =>
  count <= 0 ? () => EMPTY : statefulOperator(0, takeStep(count));
