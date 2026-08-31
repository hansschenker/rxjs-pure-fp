import { executeSource, type Observable } from '../observable.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type MonoTypeOperatorFunction,
} from '../operator.ts';
import { noop } from '../pipe.ts';

/**
 * The notifier is subscribed before the source, so a synchronously firing
 * notifier prevents source execution entirely. A notifier value completes the
 * destination; notifier completion is deliberately swallowed (`noop`);
 * notifier errors flow downstream.
 *
 * M06 scope: the notifier must be a functional Observable. `ObservableInput`
 * conversion is deferred to the interoperability surface.
 */
export const takeUntil = <T>(notifier: Observable<unknown>): MonoTypeOperatorFunction<T> =>
  operate((source, destination) => {
    subscribeOperator(
      notifier,
      createOperatorSubscriber<unknown, T>(destination, () => destination.complete(), noop)
    );

    if (!destination.closed) {
      executeSource(source, destination);
    }
    return undefined;
  });
