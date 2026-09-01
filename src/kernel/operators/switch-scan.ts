import type { ObservableInput } from '../interop.ts';
import { flattenWith, latestPolicy } from '../flattening.ts';
import { createObservable } from '../observable.ts';
import type { OperatorFunction } from '../operator.ts';

/**
 * Latest policy plus the machine's inner-value hook: only the surviving
 * (latest) inner updates the per-subscription accumulation state.
 */
export const switchScan = <T, R>(
  accumulator: (accumulated: R, value: T, index: number) => ObservableInput<R>,
  seed: R
): OperatorFunction<T, R> =>
  (source) =>
    createObservable((destination) => {
      let state = seed;
      return flattenWith<T, R>(
        latestPolicy,
        (value, index) => accumulator(state, value, index),
        {
          onInnerValue: (innerValue) => {
            state = innerValue;
          },
        }
      )(source)(destination);
    });
