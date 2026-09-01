import { createObservable, type Observable } from '../observable.ts';
import type { Scheduler } from '../scheduler.ts';
import { EMPTY } from './empty.ts';

/**
 * Emits `count` sequential integers starting at `start`, synchronously.
 * `range(n)` counts from 0 to n-1 (RxJS argument shuffle), and a non-positive
 * count returns the shared `EMPTY`. With the deprecated scheduler argument
 * (M18) one action walks the range, emitting one value per run.
 */
export const range = (start: number, count?: number, scheduler?: Scheduler): Observable<number> => {
  if (count == null) {
    count = start;
    start = 0;
  }

  if (count <= 0) {
    return EMPTY;
  }

  const end = count + start;
  return createObservable(
    scheduler
      ? (subscriber) => {
          let n = start;
          return scheduler.schedule<undefined>((_state, action) => {
            if (n < end) {
              subscriber.next(n);
              n += 1;
              action.schedule();
            } else {
              subscriber.complete();
            }
          });
        }
      : (subscriber) => {
          let n = start;
          while (n < end && !subscriber.closed) {
            subscriber.next(n);
            n += 1;
          }
          subscriber.complete();
        }
  );
};
