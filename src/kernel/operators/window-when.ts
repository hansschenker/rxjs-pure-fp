import type { Observable } from '../observable.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';
import type { Subscriber } from '../sink.ts';
import { createSubject, type Subject } from '../subject.ts';

/**
 * The Subject-emitting sibling of `bufferWhen`: one window is open at a time,
 * and `closingSelector` is invoked per cycle for the notifier whose first
 * emission — or completion — closes it and opens the next. The first window
 * opens immediately on subscription. M15 scope: the selector must return a
 * functional Observable.
 */
export const windowWhen = <T>(
  closingSelector: () => Observable<unknown>
): OperatorFunction<T, Observable<T>> =>
  operate((source, destination) => {
    let currentWindow: Subject<T> | null = null;
    let closingSubscriber: Subscriber<unknown> | null = null;

    const handleError = (error: unknown): void => {
      currentWindow?.error(error);
      destination.error(error);
    };

    const openWindow = (): void => {
      closingSubscriber?.unsubscribe();
      currentWindow?.complete();
      const opened = createSubject<T>();
      currentWindow = opened;
      destination.next(opened.asObservable());

      let closingNotifier: Observable<unknown>;
      try {
        closingNotifier = closingSelector();
      } catch (error) {
        handleError(error);
        return;
      }

      closingSubscriber = createOperatorSubscriber<unknown, Observable<T>>(
        destination,
        openWindow,
        openWindow,
        handleError
      );
      subscribeOperator(closingNotifier, closingSubscriber);
    };

    openWindow();

    subscribeOperator(
      source,
      createOperatorSubscriber<T, Observable<T>>(
        destination,
        (value) => currentWindow?.next(value),
        () => {
          currentWindow?.complete();
          destination.complete();
        },
        handleError,
        () => {
          closingSubscriber?.unsubscribe();
          currentWindow = null;
        }
      )
    );

    return undefined;
  });
