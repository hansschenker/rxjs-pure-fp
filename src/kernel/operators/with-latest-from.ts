import { innerFrom, type ObservableInput } from '../interop.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';
import { noop } from '../pipe.ts';

/**
 * Source values are gated until every companion has emitted at least once,
 * then each source value is combined with the companions' latest values.
 * Companion completions are deliberately ignored (`noop`); companion errors
 * are errors of the result. Companions are subscribed before the source.
 */
export const withLatestFrom = <T, O, R>(
  sources: ReadonlyArray<ObservableInput<O>>,
  project?: (...values: [T, ...O[]]) => R
): OperatorFunction<T, R> =>
  operate((source, destination) => {
    const { length } = sources;
    const otherValues = new Array<O>(length);
    let hasValue: boolean[] | null = sources.map(() => false);
    let ready = false;

    for (let index = 0; index < length; index += 1) {
      const otherIndex = index;
      subscribeOperator(
        innerFrom(sources[otherIndex] as ObservableInput<O>),
        createOperatorSubscriber<O, R>(
          destination,
          (value) => {
            otherValues[otherIndex] = value;
            if (!ready && hasValue !== null && !hasValue[otherIndex]) {
              hasValue[otherIndex] = true;
              ready = hasValue.every((flag) => flag);
              if (ready) {
                hasValue = null;
              }
            }
          },
          noop
        )
      );
    }

    const operatorSubscriber = createOperatorSubscriber<T, R>(destination, (value) => {
      if (ready) {
        const values = [value, ...otherValues] as [T, ...O[]];
        destination.next(project ? project(...values) : (values as unknown as R));
      }
    });
    return subscribeOperator(source, operatorSubscriber);
  });
