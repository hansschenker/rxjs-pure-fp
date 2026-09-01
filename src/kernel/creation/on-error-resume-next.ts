import { innerFrom, type ObservableInput } from '../interop.ts';
import { createObservable, type Observable } from '../observable.ts';
import { createOperatorSubscriber, subscribeOperator } from '../operator.ts';
import { noop } from '../pipe.ts';

/**
 * Sequential coordination that swallows terminal signals: each source runs to
 * either termination, then the next one starts — errors are discarded
 * (`noop` on both terminal channels), so only exhausting the list completes
 * the result, and nothing ever errors it. The advance step rides teardown:
 * `add(subscribeNext)` on a subscriber that just closed runs immediately,
 * which is exactly how synchronous sources chain in RxJS. A source that fails
 * `innerFrom` conversion is skipped like an errored source.
 */
export const onErrorResumeNext = <T>(
  sources: ReadonlyArray<ObservableInput<T>>
): Observable<T> =>
  createObservable((subscriber) => {
    let sourceIndex = 0;

    const subscribeNext = (): void => {
      if (sourceIndex < sources.length) {
        let nextSource: Observable<T>;
        try {
          nextSource = innerFrom(sources[sourceIndex++] as ObservableInput<T>);
        } catch {
          subscribeNext();
          return;
        }
        const innerSubscriber = createOperatorSubscriber<T, T>(subscriber, undefined, noop, noop);
        subscribeOperator(nextSource, innerSubscriber);
        innerSubscriber.add(subscribeNext);
      } else {
        subscriber.complete();
      }
    };

    subscribeNext();
  });
