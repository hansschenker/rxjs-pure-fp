import { asyncScheduler, type Scheduler } from '../scheduler.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';

/** Structural stand-in for RxJS's `TimeInterval` class instances. */
export type TimeInterval<T> = {
  readonly value: T;
  readonly interval: number;
};

/**
 * Pairs each value with the milliseconds elapsed since the previous emission
 * (or since subscription for the first), measured on the given scheduler's
 * clock.
 */
export const timeInterval = <T>(scheduler: Scheduler = asyncScheduler): OperatorFunction<T, TimeInterval<T>> =>
  operate((source, destination) => {
    let last = scheduler.now();
    subscribeOperator(
      source,
      createOperatorSubscriber<T, TimeInterval<T>>(destination, (value) => {
        const now = scheduler.now();
        const interval = now - last;
        last = now;
        destination.next({ value, interval });
      })
    );
  });
