import { innerFrom, type ObservableInput } from '../interop.ts';
import type { Observable } from '../observable.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type MonoTypeOperatorFunction,
} from '../operator.ts';
import type { Subscriber } from '../sink.ts';
import { createSubject, type Subject } from '../subject.ts';

/**
 * Deprecated M12-tail resubscription surface, completion-driven dual of
 * `retryWhen`: source completions feed a Subject created lazily on the first
 * completion; each notifier emission resubscribes the source. The result
 * completes only once both the source has completed and the notifier has
 * completed (`checkComplete`), and the `syncResub` handshake mirrors RxJS's
 * synchronous resubscription ordering.
 */
export const repeatWhen = <T>(
  notifier: (notifications: Observable<void>) => ObservableInput<unknown>
): MonoTypeOperatorFunction<T> =>
  operate((source, destination) => {
    let innerSubscriber: Subscriber<T> | null = null;
    let syncResub = false;
    let completions: Subject<void> | undefined;
    let isNotifierComplete = false;
    let isMainComplete = false;

    const checkComplete = (): boolean => {
      if (isMainComplete && isNotifierComplete) {
        destination.complete();
        return true;
      }
      return false;
    };

    const getCompletionSubject = (): Subject<void> => {
      if (!completions) {
        completions = createSubject<void>();
        subscribeOperator(
          innerFrom(notifier(completions)),
          createOperatorSubscriber<unknown, T>(
            destination,
            () => {
              if (innerSubscriber) {
                subscribeForRepeatWhen();
              } else {
                syncResub = true;
              }
            },
            () => {
              isNotifierComplete = true;
              checkComplete();
            }
          )
        );
      }
      return completions;
    };

    const subscribeForRepeatWhen = (): void => {
      isMainComplete = false;
      const attempt = createOperatorSubscriber<T, T>(destination, undefined, () => {
        isMainComplete = true;
        if (!checkComplete()) {
          getCompletionSubject().next(undefined);
        }
      });
      subscribeOperator(source, attempt);
      innerSubscriber = attempt;
      if (syncResub) {
        innerSubscriber.unsubscribe();
        innerSubscriber = null;
        syncResub = false;
        subscribeForRepeatWhen();
      }
    };

    subscribeForRepeatWhen();
  });
