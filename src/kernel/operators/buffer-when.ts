import type { Observable } from '../observable.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';
import { noop } from '../pipe.ts';
import type { Subscriber } from '../sink.ts';

/**
 * Collects source values into a buffer whose end is decided per cycle: each
 * emitted buffer immediately invokes `closingSelector` for the notifier that
 * closes the next one. The first cycle opens silently (no leading empty
 * emission); the previous closing subscription is dropped before each new
 * cycle. M15 scope: the selector must return a functional Observable.
 */
export const bufferWhen = <T>(
  closingSelector: () => Observable<unknown>
): OperatorFunction<T, T[]> =>
  operate((source, destination) => {
    let currentBuffer: T[] | null = null;
    let closingSubscriber: Subscriber<unknown> | null = null;

    const openBuffer = (): void => {
      closingSubscriber?.unsubscribe();
      const previous = currentBuffer;
      currentBuffer = [];
      if (previous) {
        destination.next(previous);
      }
      closingSubscriber = createOperatorSubscriber<unknown, T[]>(destination, openBuffer, noop);
      subscribeOperator(closingSelector(), closingSubscriber);
    };

    openBuffer();

    subscribeOperator(
      source,
      createOperatorSubscriber<T, T[]>(
        destination,
        (value) => currentBuffer?.push(value),
        () => {
          if (currentBuffer) {
            destination.next(currentBuffer);
          }
          destination.complete();
        },
        undefined,
        () => {
          currentBuffer = null;
          closingSubscriber = null;
        }
      )
    );

    return undefined;
  });
