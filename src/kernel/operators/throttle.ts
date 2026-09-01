import { innerFrom, type ObservableInput } from '../interop.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type MonoTypeOperatorFunction,
} from '../operator.ts';
import type { Subscriber } from '../sink.ts';

export type ThrottleConfig = {
  readonly leading?: boolean;
  readonly trailing?: boolean;
};

/**
 * Leading/trailing gating as policy data over one duration mechanism.
 * `leading` (default) sends the value that opens a throttling window;
 * `trailing` sends the latest pending value when the window's duration fires
 * — and a trailing send opens the next window itself. Completion with a
 * pending trailing value inside a live window is deferred to the window end,
 * RxJS's `isComplete` handshake. `throttled` is assigned from the subscribe
 * return exactly as in RxJS, so synchronously settling durations leave the
 * same closed-subscriber state behind.
 */
export const throttle = <T>(
  durationSelector: (value: T) => ObservableInput<unknown>,
  config?: ThrottleConfig
): MonoTypeOperatorFunction<T> =>
  operate((source, destination) => {
    const { leading = true, trailing = false } = config ?? {};
    let hasValue = false;
    let sendValue: T | null = null;
    let throttled: Subscriber<unknown> | null = null;
    let isComplete = false;

    const endThrottling = (): void => {
      throttled?.unsubscribe();
      throttled = null;
      if (trailing) {
        send();
        if (isComplete) {
          destination.complete();
        }
      }
    };

    const cleanupThrottling = (): void => {
      throttled = null;
      if (isComplete) {
        destination.complete();
      }
    };

    const startThrottle = (value: T): void => {
      throttled = subscribeOperator(
        innerFrom(durationSelector(value)),
        createOperatorSubscriber<unknown, T>(destination, endThrottling, cleanupThrottling)
      );
    };

    const send = (): void => {
      if (hasValue) {
        hasValue = false;
        const value = sendValue as T;
        sendValue = null;
        destination.next(value);
        if (!isComplete) {
          startThrottle(value);
        }
      }
    };

    return subscribeOperator(
      source,
      createOperatorSubscriber<T, T>(
        destination,
        (value) => {
          hasValue = true;
          sendValue = value;
          if (!(throttled && !throttled.closed)) {
            if (leading) {
              send();
            } else {
              startThrottle(value);
            }
          }
        },
        () => {
          isComplete = true;
          if (!(trailing && hasValue && throttled && !throttled.closed)) {
            destination.complete();
          }
        }
      )
    );
  });
