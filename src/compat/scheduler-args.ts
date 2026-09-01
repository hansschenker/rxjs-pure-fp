import { concat } from '../kernel/creation/concat.ts';
import { of as ofKernel } from '../kernel/creation/of.ts';
import type { Observable } from '../kernel/observable.ts';
import type { OperatorFunction } from '../kernel/operator.ts';
import { scheduled } from '../kernel/scheduled.ts';
import { isScheduler, type Scheduler } from '../kernel/scheduler.ts';

/**
 * RxJS 7.8.2's deprecated trailing-scheduler argument surface (M18): the
 * rest-argument forms whose last argument may be a scheduler. RxJS pops it
 * with `popScheduler` and routes the values through `scheduled`; the kernel
 * functions stay variadic-value-only.
 */

/** RxJS `popScheduler`: removes and returns a trailing scheduler, if any. */
export const popScheduler = (args: unknown[]): Scheduler | undefined =>
  isScheduler(args[args.length - 1]) ? (args.pop() as Scheduler) : undefined;

type ValueFromArray<A extends readonly unknown[]> = A[number];

export function of<A extends readonly unknown[]>(...values: A): Observable<ValueFromArray<A>>;
export function of<A extends readonly unknown[]>(
  ...valuesAndScheduler: [...A, Scheduler]
): Observable<ValueFromArray<A>>;
export function of(...args: unknown[]): Observable<unknown> {
  const scheduler = popScheduler(args);
  return scheduler ? scheduled(args, scheduler) : ofKernel(...args);
}

/** `concat([values, source], scheduler?)` — RxJS's own construction. */
export function startWith<T, D = T>(...values: D[]): OperatorFunction<T, T | D>;
export function startWith<T, D = T>(...valuesAndScheduler: [...D[], Scheduler]): OperatorFunction<T, T | D>;
export function startWith<T, D = T>(...args: unknown[]): OperatorFunction<T, T | D> {
  const scheduler = popScheduler(args);
  return ((source: Observable<T | D>) =>
    concat<T | D>([args as D[], source], scheduler)) as OperatorFunction<T, T | D>;
}

/** `concat([source, of(...values)])` — `of` pops the trailing scheduler, as in RxJS. */
export function endWith<T, D = T>(...values: D[]): OperatorFunction<T, T | D>;
export function endWith<T, D = T>(...valuesAndScheduler: [...D[], Scheduler]): OperatorFunction<T, T | D>;
export function endWith<T, D = T>(...args: unknown[]): OperatorFunction<T, T | D> {
  return ((source: Observable<T | D>) =>
    concat<T | D>([source, of(...args) as Observable<D>])) as OperatorFunction<T, T | D>;
}
