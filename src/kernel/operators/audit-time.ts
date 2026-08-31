import { timer } from '../creation/timer.ts';
import type { MonoTypeOperatorFunction } from '../operator.ts';
import { asyncScheduler, type Scheduler } from '../scheduler.ts';
import { audit } from './audit.ts';

/** Time-window audit as `audit` over `timer` — RxJS 7.8.2's own construction. */
export const auditTime = <T>(
  duration: number,
  scheduler: Scheduler = asyncScheduler
): MonoTypeOperatorFunction<T> => audit<T>(() => timer(duration, scheduler));
