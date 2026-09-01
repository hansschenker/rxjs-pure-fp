import type { OperatorFunction } from '../operator.ts';
import { dateTimestampProvider, type TimestampProvider } from '../scheduler.ts';
import { map } from './map.ts';

export type { TimestampProvider } from '../scheduler.ts';

export type Timestamp<T> = {
  readonly value: T;
  readonly timestamp: number;
};

/** Pairs each value with the provider's current epoch time: projection only. */
export const timestamp = <T>(
  timestampProvider: TimestampProvider = dateTimestampProvider
): OperatorFunction<T, Timestamp<T>> =>
  map((value: T) => ({ value, timestamp: timestampProvider.now() }));
