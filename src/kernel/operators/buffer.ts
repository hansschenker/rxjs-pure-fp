import { innerFrom, type ObservableInput } from '../interop.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';
import { noop } from '../pipe.ts';

/**
 * Collects source values until `closingNotifier` fires, then emits the
 * collected array and starts a fresh one. Source completion emits the current
 * (possibly empty) buffer before completing; notifier completion is swallowed
 * (`noop`). Since M16 the notifier is any `ObservableInput`, converted on
 * subscribe.
 */
export const buffer = <T>(closingNotifier: ObservableInput<unknown>): OperatorFunction<T, T[]> =>
  operate((source, destination) => {
    let currentBuffer: T[] | null = [];

    subscribeOperator(
      source,
      createOperatorSubscriber<T, T[]>(
        destination,
        (value) => currentBuffer?.push(value),
        () => {
          destination.next(currentBuffer ?? []);
          destination.complete();
        }
      )
    );

    subscribeOperator(
      innerFrom(closingNotifier),
      createOperatorSubscriber<unknown, T[]>(
        destination,
        () => {
          const emitted = currentBuffer ?? [];
          currentBuffer = [];
          destination.next(emitted);
        },
        noop
      )
    );

    return () => {
      currentBuffer = null;
    };
  });
