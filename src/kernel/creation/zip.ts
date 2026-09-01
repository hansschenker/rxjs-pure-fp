import { EMPTY } from './empty.ts';
import { innerFrom, type ObservableInput } from '../interop.ts';
import { createObservable, type Observable } from '../observable.ts';
import { createOperatorSubscriber, subscribeOperator } from '../operator.ts';

/**
 * Buffers every source and emits an index-aligned tuple whenever all buffers
 * are non-empty. Completes as soon as any completed source's buffer is empty
 * — either at its completion or when a later emission drains it.
 */
export const zip = <T>(sources: ReadonlyArray<ObservableInput<T>>): Observable<T[]> => {
  if (sources.length === 0) {
    return EMPTY;
  }

  return createObservable((destination) => {
    let buffers: T[][] = sources.map(() => []);
    let completed: boolean[] = sources.map(() => false);

    for (let index = 0; index < sources.length && !destination.closed; index += 1) {
      const sourceIndex = index;
      subscribeOperator(
        innerFrom(sources[sourceIndex] as ObservableInput<T>),
        createOperatorSubscriber<T, T[]>(
          destination,
          (value) => {
            (buffers[sourceIndex] as T[]).push(value);
            if (buffers.every((buffer) => buffer.length > 0)) {
              const result = buffers.map((buffer) => buffer.shift() as T);
              destination.next(result);
              if (buffers.some((buffer, i) => buffer.length === 0 && completed[i])) {
                destination.complete();
              }
            }
          },
          () => {
            completed[sourceIndex] = true;
            if ((buffers[sourceIndex] as T[]).length === 0) {
              destination.complete();
            }
          }
        )
      );
    }

    return () => {
      buffers = [];
      completed = [];
    };
  });
};
