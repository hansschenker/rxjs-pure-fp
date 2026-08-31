import { isValidDate } from '../kernel/creation/timer.ts';
import type { Observable } from '../kernel/observable.ts';
import type { OperatorFunction } from '../kernel/operator.ts';
import { asyncScheduler, type Scheduler } from '../kernel/scheduler.ts';
import { timeout } from '../kernel/operators/timeout.ts';

/**
 * Deprecated RxJS 7.8.2 surface: `timeoutWith` is exactly `timeout` with a
 * constant `with` factory — a `Date` due is a `first` deadline, a number an
 * `each` deadline. Argument validation (messages included) matches RxJS.
 */
export const timeoutWith = <T, R>(
  due: number | Date,
  withObservable: Observable<R>,
  scheduler?: Scheduler
): OperatorFunction<T, T | R> => {
  const first = isValidDate(due) ? due : undefined;
  const each = typeof due === 'number' ? due : undefined;
  if (!withObservable) {
    throw new TypeError('No observable provided to switch to');
  }
  if (first == null && each == null) {
    throw new TypeError('No timeout provided.');
  }
  return timeout<T, R, unknown>({
    first,
    each,
    scheduler: scheduler ?? asyncScheduler,
    with: () => withObservable,
  });
};
