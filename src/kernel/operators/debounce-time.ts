import { timer } from '../creation/timer.ts';
import type { MonoTypeOperatorFunction } from '../operator.ts';
import { asyncScheduler, type Scheduler } from '../scheduler.ts';
import { debounce } from './debounce.ts';

/**
 * Time-based debounce as `debounce` over a fresh `timer` per value. RxJS
 * 7.8.2 hand-specializes this with one rescheduling task; the observable
 * traces are identical, so the algebraic form is kept.
 */
export const debounceTime = <T>(
  dueTime: number,
  scheduler: Scheduler = asyncScheduler
): MonoTypeOperatorFunction<T> => debounce<T>(() => timer(dueTime, scheduler));
