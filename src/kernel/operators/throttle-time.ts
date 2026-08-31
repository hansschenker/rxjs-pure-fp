import { timer } from '../creation/timer.ts';
import type { MonoTypeOperatorFunction } from '../operator.ts';
import { asyncScheduler, type Scheduler } from '../scheduler.ts';
import { throttle, type ThrottleConfig } from './throttle.ts';

/**
 * Time-window throttle sharing ONE cold `timer` across windows (RxJS reuses
 * `duration$` the same way — each window is a fresh subscription to it).
 */
export const throttleTime = <T>(
  duration: number,
  scheduler: Scheduler = asyncScheduler,
  config?: ThrottleConfig
): MonoTypeOperatorFunction<T> => {
  const durationObservable = timer(duration, scheduler);
  return throttle<T>(() => durationObservable, config);
};
