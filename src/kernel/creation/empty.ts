import { createObservable, type Observable } from '../observable.ts';
import type { Scheduler } from '../scheduler.ts';

/** Completes immediately on every subscription. */
export const EMPTY: Observable<never> = createObservable((subscriber) => {
  subscriber.complete();
});

/**
 * Deprecated RxJS 7.8.2 parity name: the shared `EMPTY`, or (M18) a
 * completion scheduled on the given scheduler.
 */
export const empty = (scheduler?: Scheduler): Observable<never> =>
  scheduler
    ? createObservable((subscriber) => scheduler.schedule(() => subscriber.complete()))
    : EMPTY;
