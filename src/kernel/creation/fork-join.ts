import { createObservable, type Observable } from '../observable.ts';
import { createOperatorSubscriber, subscribeOperator } from '../operator.ts';

/**
 * Emits one index-aligned array of final values when every source has
 * completed after emitting at least once. A source that completes without a
 * value completes the result immediately with no emission — the settle check
 * runs in each source's finalize hook, exactly as in RxJS 7.8.2.
 */
export const forkJoin = <T>(sources: ReadonlyArray<Observable<T>>): Observable<T[]> =>
  createObservable((destination) => {
    const { length } = sources;
    if (length === 0) {
      destination.complete();
      return undefined;
    }

    const values = new Array<T>(length);
    let remainingCompletions = length;
    let remainingEmissions = length;

    for (let index = 0; index < length; index += 1) {
      const sourceIndex = index;
      let hasValue = false;
      subscribeOperator(
        sources[sourceIndex] as Observable<T>,
        createOperatorSubscriber<T, T[]>(
          destination,
          (value) => {
            if (!hasValue) {
              hasValue = true;
              remainingEmissions -= 1;
            }
            values[sourceIndex] = value;
          },
          () => {
            remainingCompletions -= 1;
          },
          undefined,
          () => {
            if (remainingCompletions === 0 || !hasValue) {
              if (remainingEmissions === 0) {
                destination.next(values);
              }
              destination.complete();
            }
          }
        )
      );
    }
    return undefined;
  });
