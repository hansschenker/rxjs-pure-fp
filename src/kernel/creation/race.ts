import { createObservable, type Observable } from '../observable.ts';
import { createOperatorSubscriber, subscribeOperator } from '../operator.ts';
import type { Subscriber } from '../sink.ts';

/**
 * The first source to emit a value wins: every other contender is
 * unsubscribed at that instant. Errors and completions also race — a source
 * that errors or completes before any value settles the result the same way.
 * A synchronously settling contender prevents later contenders from ever
 * subscribing. A single source is returned as-is.
 */
export const race = <T>(sources: ReadonlyArray<Observable<T>>): Observable<T> => {
  if (sources.length === 1) {
    return sources[0] as Observable<T>;
  }

  return createObservable((destination) => {
    let contenders: Subscriber<T>[] | null = [];

    for (
      let index = 0;
      contenders !== null && !destination.closed && index < sources.length;
      index += 1
    ) {
      const contenderIndex = index;
      const holder = contenders;
      const contender = createOperatorSubscriber<T, T>(destination, (value) => {
        if (contenders !== null) {
          for (let other = 0; other < contenders.length; other += 1) {
            if (other !== contenderIndex) {
              (contenders[other] as Subscriber<T>).unsubscribe();
            }
          }
          contenders = null;
        }
        destination.next(value);
      });
      subscribeOperator(sources[contenderIndex] as Observable<T>, contender);
      holder.push(contender);
    }

    return undefined;
  });
};
