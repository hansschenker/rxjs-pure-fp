import { interval } from '../creation/interval.ts';
import type { MonoTypeOperatorFunction } from '../operator.ts';
import { asyncScheduler, type Scheduler } from '../scheduler.ts';
import { sample } from './sample.ts';

/** Periodic sampling as `sample` over `interval` — RxJS 7.8.2's own construction. */
export const sampleTime = <T>(
  period: number,
  scheduler: Scheduler = asyncScheduler
): MonoTypeOperatorFunction<T> => sample<T>(interval(period, scheduler));
