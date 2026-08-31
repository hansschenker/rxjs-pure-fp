import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type MonoTypeOperatorFunction,
} from '../operator.ts';
import { identity } from '../pipe.ts';

/**
 * Fused by design (F3 doc): a ring buffer delays each value by `skipCount`
 * positions, so the final `skipCount` values are never emitted.
 */
export const skipLast = <T>(skipCount: number): MonoTypeOperatorFunction<T> =>
  skipCount <= 0
    ? identity
    : operate((source, destination) => {
        let ring: T[] = new Array<T>(skipCount);
        let seen = 0;

        const operatorSubscriber = createOperatorSubscriber<T, T>(destination, (value) => {
          const valueIndex = seen++;
          if (valueIndex < skipCount) {
            ring[valueIndex] = value;
          } else {
            const index = valueIndex % skipCount;
            const oldValue = ring[index] as T;
            ring[index] = value;
            destination.next(oldValue);
          }
        });

        subscribeOperator(source, operatorSubscriber);
        return () => {
          ring = [];
        };
      });
