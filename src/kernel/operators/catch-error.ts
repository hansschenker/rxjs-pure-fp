import { executeSource, type Observable } from '../observable.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';
import type { Subscriber } from '../sink.ts';

/**
 * Replaces an erroring source with the selector's observable. The selector's
 * second argument is the caught observable itself, enabling retry-forever
 * composition; selector throws become downstream errors. The deferred
 * assignment mirrors RxJS's synchronous-error dance: a source that errors
 * during subscribe switches to the handled observable after connect returns.
 */
export const catchError = <T, R>(
  selector: (error: unknown, caught: Observable<T>) => Observable<R>
): OperatorFunction<T, T | R> =>
  operate((source, destination) => {
    let innerSubscriber: Subscriber<T> | null = null;
    let syncUnsub = false;
    let handled: Observable<R> | null = null;

    const operatorSubscriber = createOperatorSubscriber<T, T | R>(
      destination,
      undefined,
      undefined,
      (error) => {
        handled = selector(error, catchError(selector)(source) as Observable<T>);
        if (innerSubscriber) {
          innerSubscriber.unsubscribe();
          innerSubscriber = null;
          executeSource(handled, destination);
        } else {
          syncUnsub = true;
        }
      }
    );
    subscribeOperator(source, operatorSubscriber);
    innerSubscriber = operatorSubscriber;

    if (syncUnsub && handled) {
      innerSubscriber.unsubscribe();
      innerSubscriber = null;
      executeSource(handled, destination);
    }
    return undefined;
  });
