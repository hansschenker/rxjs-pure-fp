import { innerFrom, type ObservableInput } from '../interop.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type MonoTypeOperatorFunction,
} from '../operator.ts';
import { noop } from '../pipe.ts';

/**
 * Values are suppressed until the notifier emits once; the notifier
 * subscription is dropped at that instant. Notifier completion without a
 * value leaves the gate closed forever; notifier errors flow downstream.
 *
 * Since M16 the notifier is any `ObservableInput`, converted on subscribe.
 */
export const skipUntil = <T>(notifier: ObservableInput<unknown>): MonoTypeOperatorFunction<T> =>
  operate((source, destination) => {
    let taking = false;

    const skipSubscriber = createOperatorSubscriber<unknown, T>(
      destination,
      () => {
        skipSubscriber.unsubscribe();
        taking = true;
      },
      noop
    );
    subscribeOperator(innerFrom(notifier), skipSubscriber);

    const operatorSubscriber = createOperatorSubscriber<T, T>(destination, (value) => {
      if (taking) {
        destination.next(value);
      }
    });
    return subscribeOperator(source, operatorSubscriber);
  });
