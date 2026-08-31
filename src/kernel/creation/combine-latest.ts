import { createObservable, type Observable } from '../observable.ts';
import { createOperatorSubscriber, subscribeOperator } from '../operator.ts';

/**
 * Emits a snapshot array of the latest values once every source has emitted
 * at least once, then on every subsequent source emission. Completes only
 * when all sources have completed; a source that completes without ever
 * emitting leaves the result silent but still pending the others, exactly as
 * in RxJS 7.8.2. Sources are subscribed eagerly in argument order.
 */
export const combineLatest = <T>(sources: ReadonlyArray<Observable<T>>): Observable<T[]> => {
  if (sources.length === 0) {
    return createObservable((destination) => {
      destination.complete();
    });
  }

  return createObservable((destination) => {
    const { length } = sources;
    const values = new Array<T>(length);
    let active = length;
    let remainingFirstValues = length;

    for (let index = 0; index < length; index += 1) {
      const sourceIndex = index;
      let hasFirstValue = false;
      subscribeOperator(
        sources[sourceIndex] as Observable<T>,
        createOperatorSubscriber<T, T[]>(
          destination,
          (value) => {
            values[sourceIndex] = value;
            if (!hasFirstValue) {
              hasFirstValue = true;
              remainingFirstValues -= 1;
            }
            if (remainingFirstValues === 0) {
              destination.next(values.slice());
            }
          },
          () => {
            active -= 1;
            if (active === 0) {
              destination.complete();
            }
          }
        )
      );
    }
    return undefined;
  });
};
