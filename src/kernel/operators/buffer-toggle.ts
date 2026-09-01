import type { Observable } from '../observable.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';
import { noop } from '../pipe.ts';
import { createSubscription } from '../subscription.ts';

const removeBuffer = <T>(buffers: T[][], buffer: T[]): void => {
  const at = buffers.indexOf(buffer);
  if (at >= 0) {
    buffers.splice(at, 1);
  }
};

/**
 * Each `openings` value starts a buffer; `closingSelector(openValue)` returns
 * the notifier whose first emission closes exactly that buffer, so buffers
 * overlap freely. Source completion flushes still-open buffers in opening
 * order; opening/closing completions are swallowed (`noop`). M15 scope:
 * openings and selector results must be functional Observables.
 */
export const bufferToggle = <T, O>(
  openings: Observable<O>,
  closingSelector: (openValue: O) => Observable<unknown>
): OperatorFunction<T, T[]> =>
  operate((source, destination) => {
    const buffers: T[][] = [];

    subscribeOperator(
      openings,
      createOperatorSubscriber<O, T[]>(
        destination,
        (openValue) => {
          const opened: T[] = [];
          buffers.push(opened);
          const closingSubscription = createSubscription();
          const emitBuffer = (): void => {
            removeBuffer(buffers, opened);
            destination.next(opened);
            closingSubscription.unsubscribe();
          };
          closingSubscription.add(
            subscribeOperator(
              closingSelector(openValue),
              createOperatorSubscriber<unknown, T[]>(destination, emitBuffer, noop)
            )
          );
        },
        noop
      )
    );

    subscribeOperator(
      source,
      createOperatorSubscriber<T, T[]>(
        destination,
        (value) => {
          for (const currentBuffer of buffers) {
            currentBuffer.push(value);
          }
        },
        () => {
          while (buffers.length > 0) {
            destination.next(buffers.shift() as T[]);
          }
          destination.complete();
        }
      )
    );

    return undefined;
  });
