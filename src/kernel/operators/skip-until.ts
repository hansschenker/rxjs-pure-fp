import type { Observable } from '../observable.ts';
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
 * M06 scope: the notifier must be a functional Observable. `ObservableInput`
 * conversion is deferred to the interoperability surface.
 */
export const skipUntil = <T>(notifier: Observable<unknown>): MonoTypeOperatorFunction<T> =>
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
    subscribeOperator(notifier, skipSubscriber);

    const operatorSubscriber = createOperatorSubscriber<T, T>(destination, (value) => {
      if (taking) {
        destination.next(value);
      }
    });
    return subscribeOperator(source, operatorSubscriber);
  });
