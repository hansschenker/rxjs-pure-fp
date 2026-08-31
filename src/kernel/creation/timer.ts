import { createObservable, type Observable } from '../observable.ts';
import { asyncScheduler, isScheduler, type Scheduler } from '../scheduler.ts';

/** RxJS `isValidDate`: a real `Date` whose time value is not NaN. */
export const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !isNaN(+value);

/**
 * M14: the timer surface over the M13 action machine. Emits `0` after
 * `dueTime` (a delay or an absolute `Date`, clamped so past dates fire
 * immediately), then either completes or keeps counting every
 * `intervalDuration` through action rescheduling — one reschedulable action,
 * not one timer per emission. A scheduler in the second position selects the
 * execution policy instead (RxJS's polymorphic argument).
 */
export function timer(dueTime?: number | Date, scheduler?: Scheduler): Observable<number>;
export function timer(
  dueTime: number | Date,
  intervalDuration: number,
  scheduler?: Scheduler
): Observable<number>;
export function timer(
  dueTime: number | Date = 0,
  intervalOrScheduler?: number | Scheduler,
  scheduler: Scheduler = asyncScheduler
): Observable<number> {
  let intervalDuration = -1;
  let policy = scheduler;
  if (intervalOrScheduler != null) {
    if (isScheduler(intervalOrScheduler)) {
      policy = intervalOrScheduler;
    } else {
      intervalDuration = intervalOrScheduler;
    }
  }

  return createObservable((subscriber) => {
    const due = isValidDate(dueTime) ? +dueTime - policy.now() : dueTime;
    let n = 0;
    return policy.schedule<undefined>(
      (_state, action) => {
        if (!subscriber.closed) {
          subscriber.next(n);
          n += 1;
          if (0 <= intervalDuration) {
            action.schedule(undefined, intervalDuration);
          } else {
            subscriber.complete();
          }
        }
      },
      due < 0 ? 0 : due
    );
  });
}
