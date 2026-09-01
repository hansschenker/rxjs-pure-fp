import type { Observable } from '../observable.ts';
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
 * (`noop`). M15 scope: the notifier must be a functional Observable —
 * `ObservableInput` conversion is deferred to the interoperability surface.
 */
export const buffer = <T>(closingNotifier: Observable<unknown>): OperatorFunction<T, T[]> =>
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
      closingNotifier,
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
