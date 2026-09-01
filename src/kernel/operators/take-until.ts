import { innerFrom, type ObservableInput } from '../interop.ts';
import { executeSource } from '../observable.ts';
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
 * Since M16 the notifier is any `ObservableInput`, converted on subscribe.
 */
export const takeUntil = <T>(notifier: ObservableInput<unknown>): MonoTypeOperatorFunction<T> =>
  operate((source, destination) => {
    subscribeOperator(
      innerFrom(notifier),
      createOperatorSubscriber<unknown, T>(destination, () => destination.complete(), noop)
    );

    if (!destination.closed) {
      executeSource(source, destination);
    }
    return undefined;
  });
