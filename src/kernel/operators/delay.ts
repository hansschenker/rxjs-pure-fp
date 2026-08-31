import { timer } from '../creation/timer.ts';
import type { MonoTypeOperatorFunction } from '../operator.ts';
import { asyncScheduler, type Scheduler } from '../scheduler.ts';
import { delayWhen } from './delay-when.ts';

/**
 * Uniform time shift as `delayWhen` over one shared cold `timer` — RxJS
 * 7.8.2's own implementation. `due` may be an absolute `Date`; errors are not
 * delayed (they bypass pending inner timers under merge semantics).
 */
export const delay = <T>(
  due: number | Date,
  scheduler: Scheduler = asyncScheduler
): MonoTypeOperatorFunction<T> => {
  const duration = timer(due, scheduler);
  return delayWhen<T>(() => duration);
};
