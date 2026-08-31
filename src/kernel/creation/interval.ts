import type { Observable } from '../observable.ts';
import { asyncScheduler, type Scheduler } from '../scheduler.ts';
import { timer } from './timer.ts';

/**
 * Periodic counter as timer algebra: `interval(p)` is `timer(p, p)`, with a
 * negative period clamped to zero exactly as in RxJS 7.8.2.
 */
export const interval = (period = 0, scheduler: Scheduler = asyncScheduler): Observable<number> => {
  const clamped = period < 0 ? 0 : period;
  return timer(clamped, clamped, scheduler);
};
