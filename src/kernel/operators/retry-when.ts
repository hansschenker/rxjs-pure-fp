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
 * Deprecated M12-tail resubscription surface: source errors feed a Subject
 * handed to `notifier` once, on the first error; each notifier emission
 * resubscribes the source. Errors signalled while the attempt subscriber is
 * still being wired resubscribe synchronously after wiring (`syncResub`),
 * matching RxJS's ordering exactly. Notifier error/complete pass through to
 * the destination.
 */
export const retryWhen = <T>(
  notifier: (errors: Observable<unknown>) => ObservableInput<unknown>
): MonoTypeOperatorFunction<T> =>
  operate((source, destination) => {
    let innerSubscriber: Subscriber<T> | null = null;
    let syncResub = false;
    let errors: Subject<unknown> | undefined;

    const subscribeForRetryWhen = (): void => {
      const attempt = createOperatorSubscriber<T, T>(destination, undefined, undefined, (error) => {
        if (!errors) {
          errors = createSubject<unknown>();
          subscribeOperator(
            innerFrom(notifier(errors)),
            createOperatorSubscriber<unknown, T>(destination, () => {
              if (innerSubscriber) {
                subscribeForRetryWhen();
              } else {
                syncResub = true;
              }
            })
          );
        }
        errors.next(error);
      });
      subscribeOperator(source, attempt);
      innerSubscriber = attempt;
      if (syncResub) {
        innerSubscriber.unsubscribe();
        innerSubscriber = null;
        syncResub = false;
        subscribeForRetryWhen();
      }
    };

    subscribeForRetryWhen();
  });
