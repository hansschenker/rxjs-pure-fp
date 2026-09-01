import { innerFrom, type ObservableInput } from '../interop.ts';
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
 * order; opening/closing completions are swallowed (`noop`). Since M16,
 * openings and selector results are any `ObservableInput`.
 */
export const bufferToggle = <T, O>(
  openings: ObservableInput<O>,
  closingSelector: (openValue: O) => ObservableInput<unknown>
): OperatorFunction<T, T[]> =>
  operate((source, destination) => {
    const buffers: T[][] = [];

    subscribeOperator(
      innerFrom(openings),
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
              innerFrom(closingSelector(openValue)),
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
