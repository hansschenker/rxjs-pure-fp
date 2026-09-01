import { innerFrom, type ObservableInput } from '../interop.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';
import type { Subscriber } from '../sink.ts';

type SequenceState<T> = {
  buffer: T[];
  complete: boolean;
};

const createState = <T>(): SequenceState<T> => ({ buffer: [], complete: false });

/**
 * Races both sequences with symmetric buffering: each side compares against
 * the other's buffered backlog, emits `false` on the first mismatch (or on a
 * value after the other side completed with an empty backlog), and emits the
 * final verdict when both complete. Closure-owned mutable buffers, per the
 * documented shared-state policy.
 */
export const sequenceEqual = <T>(
  compareTo: ObservableInput<T>,
  comparator: (a: T, b: T) => boolean = (a, b) => a === b
): OperatorFunction<T, boolean> =>
  operate((source, destination) => {
    const aState = createState<T>();
    const bState = createState<T>();

    const emit = (isEqual: boolean): void => {
      destination.next(isEqual);
      destination.complete();
    };

    const createSideSubscriber = (
      selfState: SequenceState<T>,
      otherState: SequenceState<T>
    ): Subscriber<T> => {
      const sideSubscriber: Subscriber<T> = createOperatorSubscriber<T, boolean>(
        destination,
        (value) => {
          const { buffer, complete } = otherState;
          if (buffer.length === 0) {
            if (complete) {
              emit(false);
            } else {
              selfState.buffer.push(value);
            }
          } else if (!comparator(value, buffer.shift() as T)) {
            emit(false);
          }
        },
        () => {
          selfState.complete = true;
          const { complete, buffer } = otherState;
          if (complete) {
            emit(buffer.length === 0);
          }
          sideSubscriber.unsubscribe();
        }
      );
      return sideSubscriber;
    };

    subscribeOperator(source, createSideSubscriber(aState, bState));
    subscribeOperator(innerFrom(compareTo), createSideSubscriber(bState, aState));
  });
