import { innerFrom, type ObservableInput } from '../interop.ts';
import type { Observable } from '../observable.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';
import { noop } from '../pipe.ts';
import { createSubject, type Subject } from '../subject.ts';
import { createSubscription } from '../subscription.ts';

const removeWindow = <T>(windows: Array<Subject<T>>, target: Subject<T>): void => {
  const at = windows.indexOf(target);
  if (at >= 0) {
    windows.splice(at, 1);
  }
};

/**
 * The Subject-emitting sibling of `bufferToggle`: each `openings` value opens
 * a window, and the first emission of that value's `closingSelector` notifier
 * closes exactly that window, so windows overlap freely. A throwing selector
 * errors every open window before the result; unsubscription tears open
 * windows down without terminal signals. Since M16, openings and selector
 * results are any `ObservableInput`.
 */
export const windowToggle = <T, O>(
  openings: ObservableInput<O>,
  closingSelector: (openValue: O) => ObservableInput<unknown>
): OperatorFunction<T, Observable<T>> =>
  operate((source, destination) => {
    const windows: Array<Subject<T>> = [];

    const handleError = (error: unknown): void => {
      while (windows.length > 0) {
        (windows.shift() as Subject<T>).error(error);
      }
      destination.error(error);
    };

    subscribeOperator(
      innerFrom(openings),
      createOperatorSubscriber<O, Observable<T>>(
        destination,
        (openValue) => {
          const opened = createSubject<T>();
          windows.push(opened);
          const closingSubscription = createSubscription();
          const closeWindow = (): void => {
            removeWindow(windows, opened);
            opened.complete();
            closingSubscription.unsubscribe();
          };

          let closingNotifier: Observable<unknown>;
          try {
            closingNotifier = innerFrom(closingSelector(openValue));
          } catch (error) {
            handleError(error);
            return;
          }

          destination.next(opened.asObservable());
          closingSubscription.add(
            subscribeOperator(
              closingNotifier,
              createOperatorSubscriber<unknown, Observable<T>>(
                destination,
                closeWindow,
                noop,
                handleError
              )
            )
          );
        },
        noop
      )
    );

    subscribeOperator(
      source,
      createOperatorSubscriber<T, Observable<T>>(
        destination,
        (value) => {
          for (const currentWindow of windows.slice()) {
            currentWindow.next(value);
          }
        },
        () => {
          while (windows.length > 0) {
            (windows.shift() as Subject<T>).complete();
          }
          destination.complete();
        },
        handleError,
        () => {
          while (windows.length > 0) {
            (windows.shift() as Subject<T>).unsubscribe();
          }
        }
      )
    );

    return undefined;
  });
