import { innerFrom, type ObservableInput } from '../interop.ts';
import { createObservable, type Observable } from '../observable.ts';
import { createOperatorSubscriber, subscribeOperator } from '../operator.ts';
import { executeScheduledWork } from '../operators/schedule-work.ts';
import { scheduled } from '../scheduled.ts';
import type { Scheduler } from '../scheduler.ts';
import type { Subscription } from '../subscription.ts';

/** RxJS `maybeSchedule`: run now, or as one owned scheduled unit. */
const maybeSchedule = (
  scheduler: Scheduler | undefined,
  parent: Subscription,
  execute: () => void
): void => {
  if (scheduler) {
    executeScheduledWork(parent, scheduler, execute);
  } else {
    execute();
  }
};

/**
 * Emits a snapshot array of the latest values once every source has emitted
 * at least once, then on every subsequent source emission. Completes only
 * when all sources have completed; a source that completes without ever
 * emitting leaves the result silent but still pending the others, exactly as
 * in RxJS 7.8.2. Sources are subscribed eagerly in argument order. With the
 * deprecated scheduler argument (M18) the setup, each source subscription,
 * and each source's emissions are scheduled units (RxJS `combineLatestInit`).
 */
export const combineLatest = <T>(
  sources: ReadonlyArray<ObservableInput<T>>,
  scheduler?: Scheduler
): Observable<T[]> => {
  if (sources.length === 0) {
    return scheduler
      ? scheduled<T[]>([], scheduler)
      : createObservable((destination) => {
          destination.complete();
        });
  }

  return createObservable((destination) => {
    maybeSchedule(scheduler, destination, () => {
      const { length } = sources;
      const values = new Array<T>(length);
      let active = length;
      let remainingFirstValues = length;

      for (let index = 0; index < length; index += 1) {
        const sourceIndex = index;
        maybeSchedule(scheduler, destination, () => {
          const input = sources[sourceIndex] as ObservableInput<T>;
          const source = scheduler ? scheduled(input, scheduler) : innerFrom(input);
          let hasFirstValue = false;
          subscribeOperator(
            source,
            createOperatorSubscriber<T, T[]>(
              destination,
              (value) => {
                values[sourceIndex] = value;
                if (!hasFirstValue) {
                  hasFirstValue = true;
                  remainingFirstValues -= 1;
                }
                if (remainingFirstValues === 0) {
                  destination.next(values.slice());
                }
              },
              () => {
                active -= 1;
                if (active === 0) {
                  destination.complete();
                }
              }
            )
          );
        });
      }
    });
    return undefined;
  });
};
