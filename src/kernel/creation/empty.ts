import { createObservable, type Observable } from '../observable.ts';

/**
 * Completes immediately on every subscription. The deprecated scheduler-based
 * `empty(scheduler)` overload is deferred to the remaining-scheduler-shapes
 * milestone (M18).
 */
export const EMPTY: Observable<never> = createObservable((subscriber) => {
  subscriber.complete();
});

/** Deprecated RxJS 7.8.2 parity name: always returns the shared `EMPTY`. */
export const empty = (): Observable<never> => EMPTY;
