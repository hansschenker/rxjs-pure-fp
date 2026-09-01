import type { Observable } from '../observable.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';
import { noop } from '../pipe.ts';
import { createSubject, type Subject } from '../subject.ts';

/**
 * The Subject-emitting sibling of `buffer` (M10 prerequisite): the current
 * window is a Subject the source feeds; each `windowBoundaries` emission
 * completes it and opens the next. The first window opens immediately on
 * subscription. Source errors reach both the open window and the result;
 * boundary completion is swallowed (`noop`). M15 scope: the boundary notifier
 * must be a functional Observable.
 */
export const window = <T>(
  windowBoundaries: Observable<unknown>
): OperatorFunction<T, Observable<T>> =>
  operate((source, destination) => {
    let windowSubject: Subject<T> | null = createSubject<T>();
    destination.next(windowSubject.asObservable());

    const errorHandler = (error: unknown): void => {
      windowSubject?.error(error);
      destination.error(error);
    };

    subscribeOperator(
      source,
      createOperatorSubscriber<T, Observable<T>>(
        destination,
        (value) => windowSubject?.next(value),
        () => {
          windowSubject?.complete();
          destination.complete();
        },
        errorHandler
      )
    );

    subscribeOperator(
      windowBoundaries,
      createOperatorSubscriber<unknown, Observable<T>>(
        destination,
        () => {
          windowSubject?.complete();
          windowSubject = createSubject<T>();
          destination.next(windowSubject.asObservable());
        },
        noop,
        errorHandler
      )
    );

    return () => {
      windowSubject?.unsubscribe();
      windowSubject = null;
    };
  });
