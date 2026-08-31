import { flattenWith, overlapPolicy } from '../flattening.ts';
import { createObservable, type Observable } from '../observable.ts';
import type { OperatorFunction } from '../operator.ts';

/**
 * Overlap policy plus the machine's inner-value hook: the accumulation state
 * is per subscription, threaded through every inner, and updated before each
 * downstream emission.
 */
export const mergeScan = <T, R>(
  accumulator: (accumulated: R, value: T, index: number) => Observable<R>,
  seed: R,
  concurrent = Infinity
): OperatorFunction<T, R> =>
  (source) =>
    createObservable((destination) => {
      let state = seed;
      return flattenWith<T, R>(
        overlapPolicy(concurrent),
        (value, index) => accumulator(state, value, index),
        {
          onInnerValue: (innerValue) => {
            state = innerValue;
          },
        }
      )(source)(destination);
    });
