import { createOperatorSubscriber, subscribeOperator, type OperatorFunction } from '../core/operator.ts';
import type { Observable } from '../core/observable.ts';

export const scanInternals = <V, A, S>(
  accumulator: (accumulator: V | A | S, value: V, index: number) => A,
  seed: S,
  hasSeed: boolean,
  emitOnNext: boolean,
  emitBeforeComplete: boolean
): OperatorFunction<V, V | A | S> =>
  (source: Observable<V>) =>
    (destination) => {
      let hasState = hasSeed;
      let state: V | A | S = seed;
      let index = 0;

      const operatorSubscriber = createOperatorSubscriber<V, V | A | S>(
        destination,
        (value) => {
          const currentIndex = index++;
          state = hasState
            ? accumulator(state, value, currentIndex)
            : ((hasState = true), value);

          if (emitOnNext) {
            destination.next(state);
          }
        },
        emitBeforeComplete
          ? () => {
              if (hasState) {
                destination.next(state);
              }
              destination.complete();
            }
          : undefined
      );

      return subscribeOperator(source, operatorSubscriber);
    };
