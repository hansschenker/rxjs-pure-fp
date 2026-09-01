import type { Observable } from '../observable.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';
import { createSubject, type Subject } from '../subject.ts';

/**
 * Emits Subject-backed windows of `windowSize` values. A `startWindowEvery`
 * greater than zero opens a new window every that many values, so windows may
 * overlap (or skip values when it exceeds `windowSize`). The first window
 * opens immediately; termination is fanned out to every open window before
 * the result.
 */
export const windowCount = <T>(
  windowSize: number,
  startWindowEvery = 0
): OperatorFunction<T, Observable<T>> => {
  const startEvery = startWindowEvery > 0 ? startWindowEvery : windowSize;
  return operate((source, destination) => {
    let windows: Array<Subject<T>> | null = [createSubject<T>()];
    let count = 0;
    destination.next((windows[0] as Subject<T>).asObservable());

    subscribeOperator(
      source,
      createOperatorSubscriber<T, Observable<T>>(
        destination,
        (value) => {
          for (const currentWindow of windows ?? []) {
            currentWindow.next(value);
          }
          const closingIndex = count - windowSize + 1;
          if (closingIndex >= 0 && closingIndex % startEvery === 0) {
            windows?.shift()?.complete();
          }
          if (++count % startEvery === 0 && windows) {
            const opened = createSubject<T>();
            windows.push(opened);
            destination.next(opened.asObservable());
          }
        },
        () => {
          while (windows?.length) {
            (windows.shift() as Subject<T>).complete();
          }
          destination.complete();
        },
        (error) => {
          while (windows?.length) {
            (windows.shift() as Subject<T>).error(error);
          }
          destination.error(error);
        },
        () => {
          windows = null;
        }
      )
    );

    return undefined;
  });
};
