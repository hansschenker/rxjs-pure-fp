import { innerFrom, type ObservableInput } from '../interop.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type MonoTypeOperatorFunction,
} from '../operator.ts';
import { noop } from '../pipe.ts';

/**
 * Emits the latest source value each time the notifier fires, at most once
 * per value. The source is subscribed before the notifier (RxJS ordering);
 * source completion completes the result immediately, while notifier
 * completion is swallowed (`noop`) — only notifier values and errors matter.
 */
export const sample = <T>(notifier: ObservableInput<unknown>): MonoTypeOperatorFunction<T> =>
  operate((source, destination) => {
    let hasValue = false;
    let lastValue: T | null = null;

    subscribeOperator(
      source,
      createOperatorSubscriber<T, T>(destination, (value) => {
        hasValue = true;
        lastValue = value;
      })
    );

    subscribeOperator(
      innerFrom(notifier),
      createOperatorSubscriber<unknown, T>(
        destination,
        () => {
          if (hasValue) {
            hasValue = false;
            const value = lastValue as T;
            lastValue = null;
            destination.next(value);
          }
        },
        noop
      )
    );
    return undefined;
  });
