import type { OperatorFunction } from '../operator.ts';
import { map } from './map.ts';

export type TimestampProvider = {
  readonly now: () => number;
};

export type Timestamp<T> = {
  readonly value: T;
  readonly timestamp: number;
};

/** RxJS `dateTimestampProvider` without the test-scheduler delegate hook. */
const dateTimestampProvider: TimestampProvider = { now: () => Date.now() };

/** Pairs each value with the provider's current epoch time: projection only. */
export const timestamp = <T>(
  timestampProvider: TimestampProvider = dateTimestampProvider
): OperatorFunction<T, Timestamp<T>> =>
  map((value: T) => ({ value, timestamp: timestampProvider.now() }));
