import { createObservable, type Observable } from '../observable.ts';

/**
 * Errors immediately on every subscription. A function argument is treated as
 * an error factory invoked per subscription; anything else is the error
 * itself. The deprecated scheduler overload is deferred to M13.
 */
export const throwError = (errorOrFactory: unknown): Observable<never> => {
  const factory =
    typeof errorOrFactory === 'function'
      ? (errorOrFactory as () => unknown)
      : () => errorOrFactory;
  return createObservable((subscriber) => {
    subscriber.error(factory());
  });
};
