import type { Observable } from '../observable.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type MonoTypeOperatorFunction,
} from '../operator.ts';
import type { Subscriber } from '../sink.ts';

/**
 * The dual of debounce: the FIRST value in a quiet window opens one duration,
 * values arriving while it runs only overwrite the pending latest, and the
 * duration's first emission flushes that latest and closes the window.
 * Completion while a duration is pending is deferred until the duration
 * settles — RxJS's `isComplete` handshake between the source and duration
 * subscribers, kept exactly.
 */
export const audit = <T>(
  durationSelector: (value: T) => Observable<unknown>
): MonoTypeOperatorFunction<T> =>
  operate((source, destination) => {
    let hasValue = false;
    let lastValue: T | null = null;
    let durationSubscriber: Subscriber<unknown> | null = null;
    let isComplete = false;

    const endDuration = (): void => {
      durationSubscriber?.unsubscribe();
      durationSubscriber = null;
      if (hasValue) {
        hasValue = false;
        const value = lastValue as T;
        lastValue = null;
        destination.next(value);
      }
      if (isComplete) {
        destination.complete();
      }
    };

    const cleanupDuration = (): void => {
      durationSubscriber = null;
      if (isComplete) {
        destination.complete();
      }
    };

    return subscribeOperator(
      source,
      createOperatorSubscriber<T, T>(
        destination,
        (value) => {
          hasValue = true;
          lastValue = value;
          if (!durationSubscriber) {
            durationSubscriber = createOperatorSubscriber<unknown, T>(
              destination,
              endDuration,
              cleanupDuration
            );
            subscribeOperator(durationSelector(value), durationSubscriber);
          }
        },
        () => {
          isComplete = true;
          if (!hasValue || !durationSubscriber || durationSubscriber.closed) {
            destination.complete();
          }
        }
      )
    );
  });
