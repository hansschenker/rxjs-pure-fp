import { createObservable, type Observable } from '../observable.ts';
import { EMPTY } from './empty.ts';

/**
 * Emits `count` sequential integers starting at `start`, synchronously.
 * `range(n)` counts from 0 to n-1 (RxJS argument shuffle), and a non-positive
 * count returns the shared `EMPTY`. The deprecated scheduler argument is
 * deferred to the remaining-scheduler-shapes milestone (M18).
 */
export const range = (start: number, count?: number): Observable<number> => {
  if (count == null) {
    count = start;
    start = 0;
  }

  if (count <= 0) {
    return EMPTY;
  }

  const end = count + start;
  return createObservable((subscriber) => {
    let n = start;
    while (n < end && !subscriber.closed) {
      subscriber.next(n);
      n += 1;
    }
    subscriber.complete();
  });
};
