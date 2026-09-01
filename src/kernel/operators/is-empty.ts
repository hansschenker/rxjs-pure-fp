import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';

/**
 * Answers on the first decisive event: any value emits `false`, completion
 * without values emits `true`; either way the result completes immediately.
 */
export const isEmpty = <T>(): OperatorFunction<T, boolean> =>
  operate((source, destination) => {
    subscribeOperator(
      source,
      createOperatorSubscriber<T, boolean>(
        destination,
        () => {
          destination.next(false);
          destination.complete();
        },
        () => {
          destination.next(true);
          destination.complete();
        }
      )
    );
  });
