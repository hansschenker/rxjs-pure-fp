import { createObservable, type Observable } from '../observable.ts';
import type { Scheduler } from '../scheduler.ts';
import type { Subscriber } from '../sink.ts';

/**
 * Errors immediately on every subscription. A function argument is treated as
 * an error factory invoked per subscription; anything else is the error
 * itself. With the deprecated scheduler argument (M18) the error is delivered
 * from a scheduled run instead.
 */
export const throwError = (errorOrFactory: unknown, scheduler?: Scheduler): Observable<never> => {
  const factory =
    typeof errorOrFactory === 'function'
      ? (errorOrFactory as () => unknown)
      : () => errorOrFactory;
  const init = (subscriber: Subscriber<never>): void => {
    subscriber.error(factory());
  };
  return createObservable(
    scheduler ? (subscriber) => scheduler.schedule(() => init(subscriber)) : init
  );
};
