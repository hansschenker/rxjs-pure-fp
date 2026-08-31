import { createObservable, type Observable } from '../observable.ts';

/**
 * Completes immediately on every subscription. The deprecated scheduler-based
 * `empty(scheduler)` overload is out of scope until the scheduler kernel
 * (M13) lands.
 */
export const EMPTY: Observable<never> = createObservable((subscriber) => {
  subscriber.complete();
});
