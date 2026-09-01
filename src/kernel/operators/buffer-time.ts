import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';
import { asyncScheduler, isScheduler, type Scheduler } from '../scheduler.ts';
import { createSubscription, type Subscription } from '../subscription.ts';
import { executeRepeatingScheduledWork, executeScheduledWork } from './schedule-work.ts';

type BufferRecord<T> = {
  readonly buffer: T[];
  readonly subs: Subscription;
};

const removeRecord = <T>(records: Array<BufferRecord<T>>, record: BufferRecord<T>): void => {
  const at = records.indexOf(record);
  if (at >= 0) {
    records.splice(at, 1);
  }
};

/**
 * Emits buffered value arrays on a clock instead of a notifier. Without a
 * creation interval one buffer is always open and a new one starts as each
 * emits; with one, buffers open on their own repeating schedule and may
 * overlap. `maxBufferSize` emits a buffer early when it fills. Completion
 * flushes open buffers in opening order. A trailing scheduler selects the
 * execution policy (RxJS's `popScheduler` argument shape).
 */
export function bufferTime<T>(
  bufferTimeSpan: number,
  scheduler?: Scheduler
): OperatorFunction<T, T[]>;
export function bufferTime<T>(
  bufferTimeSpan: number,
  bufferCreationInterval: number | null | undefined,
  scheduler?: Scheduler
): OperatorFunction<T, T[]>;
export function bufferTime<T>(
  bufferTimeSpan: number,
  bufferCreationInterval: number | null | undefined,
  maxBufferSize: number,
  scheduler?: Scheduler
): OperatorFunction<T, T[]>;
export function bufferTime<T>(
  bufferTimeSpan: number,
  ...otherArgs: Array<Scheduler | number | null | undefined>
): OperatorFunction<T, T[]> {
  const scheduler = isScheduler(otherArgs[otherArgs.length - 1])
    ? (otherArgs.pop() as Scheduler)
    : asyncScheduler;
  const bufferCreationInterval = (otherArgs[0] as number | null | undefined) ?? null;
  const maxBufferSize = (otherArgs[1] as number | undefined) || Infinity;

  return operate((source, destination) => {
    let bufferRecords: Array<BufferRecord<T>> | null = [];
    let restartOnEmit = false;

    const emit = (record: BufferRecord<T>): void => {
      const { buffer, subs } = record;
      subs.unsubscribe();
      if (bufferRecords) {
        removeRecord(bufferRecords, record);
      }
      destination.next(buffer);
      if (restartOnEmit) {
        startBuffer();
      }
    };

    const startBuffer = (): void => {
      if (bufferRecords) {
        const subs = createSubscription();
        destination.add(subs);
        const record: BufferRecord<T> = { buffer: [], subs };
        bufferRecords.push(record);
        executeScheduledWork(subs, scheduler, () => emit(record), bufferTimeSpan);
      }
    };

    if (bufferCreationInterval !== null && bufferCreationInterval >= 0) {
      executeRepeatingScheduledWork(destination, scheduler, startBuffer, bufferCreationInterval);
    } else {
      restartOnEmit = true;
    }
    startBuffer();

    const bufferTimeSubscriber = createOperatorSubscriber<T, T[]>(
      destination,
      (value) => {
        for (const record of (bufferRecords ?? []).slice()) {
          record.buffer.push(value);
          if (maxBufferSize <= record.buffer.length) {
            emit(record);
          }
        }
      },
      () => {
        while (bufferRecords?.length) {
          destination.next((bufferRecords.shift() as BufferRecord<T>).buffer);
        }
        bufferTimeSubscriber.unsubscribe();
        destination.complete();
      },
      undefined,
      () => {
        bufferRecords = null;
      }
    );
    subscribeOperator(source, bufferTimeSubscriber);
    return undefined;
  });
}
