import type { Observable } from '../observable.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';
import { asyncScheduler, isScheduler, type Scheduler } from '../scheduler.ts';
import { createSubject, type Subject } from '../subject.ts';
import { createSubscription, type Subscription } from '../subscription.ts';
import { executeRepeatingScheduledWork, executeScheduledWork } from './schedule-work.ts';

type WindowRecord<T> = {
  readonly window: Subject<T>;
  readonly subs: Subscription;
  seen: number;
};

/** A consumer a terminal signal fans out to: open windows first, then the result. */
type Terminal = {
  readonly complete: () => void;
  readonly error: (error: unknown) => void;
};

const removeRecord = <T>(records: Array<WindowRecord<T>>, record: WindowRecord<T>): void => {
  const at = records.indexOf(record);
  if (at >= 0) {
    records.splice(at, 1);
  }
};

/**
 * The Subject-emitting sibling of `bufferTime`: windows close on a clock.
 * Without a creation interval one window is always open and a new one starts
 * as each closes; with one, windows open on their own repeating schedule and
 * may overlap. `maxWindowSize` closes a window early once it has seen that
 * many values. A trailing scheduler selects the execution policy (RxJS's
 * `popScheduler` argument shape).
 */
export function windowTime<T>(
  windowTimeSpan: number,
  scheduler?: Scheduler
): OperatorFunction<T, Observable<T>>;
export function windowTime<T>(
  windowTimeSpan: number,
  windowCreationInterval: number | null | undefined,
  scheduler?: Scheduler
): OperatorFunction<T, Observable<T>>;
export function windowTime<T>(
  windowTimeSpan: number,
  windowCreationInterval: number | null | undefined,
  maxWindowSize: number,
  scheduler?: Scheduler
): OperatorFunction<T, Observable<T>>;
export function windowTime<T>(
  windowTimeSpan: number,
  ...otherArgs: Array<Scheduler | number | null | undefined>
): OperatorFunction<T, Observable<T>> {
  const scheduler = isScheduler(otherArgs[otherArgs.length - 1])
    ? (otherArgs.pop() as Scheduler)
    : asyncScheduler;
  const windowCreationInterval = (otherArgs[0] as number | null | undefined) ?? null;
  const maxWindowSize = (otherArgs[1] as number | undefined) || Infinity;

  return operate((source, destination) => {
    let windowRecords: Array<WindowRecord<T>> | null = [];
    let restartOnClose = false;

    const closeWindow = (record: WindowRecord<T>): void => {
      record.window.complete();
      record.subs.unsubscribe();
      if (windowRecords) {
        removeRecord(windowRecords, record);
      }
      if (restartOnClose) {
        startWindow();
      }
    };

    const startWindow = (): void => {
      if (windowRecords) {
        const subs = createSubscription();
        destination.add(subs);
        const record: WindowRecord<T> = { window: createSubject<T>(), subs, seen: 0 };
        windowRecords.push(record);
        destination.next(record.window.asObservable());
        executeScheduledWork(subs, scheduler, () => closeWindow(record), windowTimeSpan);
      }
    };

    if (windowCreationInterval !== null && windowCreationInterval >= 0) {
      executeRepeatingScheduledWork(destination, scheduler, startWindow, windowCreationInterval);
    } else {
      restartOnClose = true;
    }
    startWindow();

    const terminate = (signal: (consumer: Terminal) => void): void => {
      for (const record of (windowRecords ?? []).slice()) {
        signal(record.window);
      }
      signal(destination);
    };

    subscribeOperator(
      source,
      createOperatorSubscriber<T, Observable<T>>(
        destination,
        (value) => {
          for (const record of (windowRecords ?? []).slice()) {
            record.window.next(value);
            record.seen += 1;
            if (maxWindowSize <= record.seen) {
              closeWindow(record);
            }
          }
        },
        () => terminate((consumer) => consumer.complete()),
        (error) => terminate((consumer) => consumer.error(error))
      )
    );

    return () => {
      windowRecords = null;
    };
  });
}
