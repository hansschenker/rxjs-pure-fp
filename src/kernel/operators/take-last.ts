import { EMPTY } from '../creation/empty.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type MonoTypeOperatorFunction,
} from '../operator.ts';

/**
 * Fused by design (F3 doc): the sliding tail buffer is per-subscription
 * mutable state, released on finalize.
 */
export const takeLast = <T>(count: number): MonoTypeOperatorFunction<T> =>
  count <= 0
    ? () => EMPTY
    : operate((source, destination) => {
        let buffer: T[] = [];
        const operatorSubscriber = createOperatorSubscriber<T, T>(
          destination,
          (value) => {
            buffer.push(value);
            if (count < buffer.length) {
              buffer.shift();
            }
          },
          () => {
            for (const value of buffer) {
              destination.next(value);
            }
            destination.complete();
          },
          undefined,
          () => {
            buffer = [];
          }
        );

        return subscribeOperator(source, operatorSubscriber);
      });
