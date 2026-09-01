import {
  createInvalidObservableTypeError,
  innerFrom,
  isArrayLike,
  isAsyncIterable,
  isInteropObservable,
  isIterable,
  isPromise,
  isReadableStreamLike,
  readableStreamToAsyncGenerator,
  type ObservableInput,
  type ReadableStreamLike,
} from './interop.ts';
import { createObservable, type Observable } from './observable.ts';
import { observeOn } from './operators/observe-on.ts';
import { executeRepeatingScheduledWork, executeScheduledWork } from './operators/schedule-work.ts';
import { subscribeOn } from './operators/subscribe-on.ts';
import { pipeValue } from './pipe.ts';
import type { Scheduler } from './scheduler.ts';

/**
 * M18: `ObservableInput` conversion that pushes every emission through a
 * scheduler — RxJS's `scheduled`, the machinery behind every deprecated
 * `scheduler` argument of the creation functions. The probe order is
 * `innerFrom`'s (M16); each case becomes scheduled work instead of a
 * synchronous loop.
 */

/** Observables and promises: subscribe on the scheduler, then re-emit on it. */
export const scheduleObservable = <T>(input: ObservableInput<T>, scheduler: Scheduler): Observable<T> =>
  pipeValue(innerFrom(input), subscribeOn<T>(scheduler), observeOn<T>(scheduler));

export const schedulePromise = <T>(input: PromiseLike<T>, scheduler: Scheduler): Observable<T> =>
  scheduleObservable(input, scheduler);

/** One action walks the array: each run emits one element and reschedules itself. */
export const scheduleArray = <T>(input: ArrayLike<T>, scheduler: Scheduler): Observable<T> =>
  createObservable((subscriber) => {
    let i = 0;
    return scheduler.schedule<undefined>((_state, action) => {
      if (i === input.length) {
        subscriber.complete();
      } else {
        subscriber.next(input[i++] as T);
        if (!subscriber.closed) {
          action.schedule();
        }
      }
    });
  });

/**
 * The iterator is obtained in one scheduled unit and then pulled by a
 * repeating one; iterator throws reach the error channel and an early
 * teardown calls `return` on a partially consumed iterator.
 */
export const scheduleIterable = <T>(input: Iterable<T>, scheduler: Scheduler): Observable<T> =>
  createObservable((subscriber) => {
    let iterator: Iterator<T> | undefined;
    executeScheduledWork(subscriber, scheduler, () => {
      iterator = input[Symbol.iterator]();
      executeRepeatingScheduledWork(subscriber, scheduler, () => {
        let result: IteratorResult<T>;
        try {
          result = (iterator as Iterator<T>).next();
        } catch (error) {
          subscriber.error(error);
          return;
        }
        if (result.done) {
          subscriber.complete();
        } else {
          subscriber.next(result.value);
        }
      });
    });
    return () => {
      if (typeof iterator?.return === 'function') {
        iterator.return();
      }
    };
  });

/** Async iteration pulled one `next()` per scheduled run, exactly as RxJS. */
export const scheduleAsyncIterable = <T>(input: AsyncIterable<T>, scheduler: Scheduler): Observable<T> => {
  if (!input) {
    throw new Error('Iterable cannot be null');
  }
  return createObservable((subscriber) => {
    executeScheduledWork(subscriber, scheduler, () => {
      const iterator = input[Symbol.asyncIterator]();
      executeRepeatingScheduledWork(subscriber, scheduler, () => {
        iterator.next().then((result) => {
          if (result.done) {
            subscriber.complete();
          } else {
            subscriber.next(result.value);
          }
        });
      });
    });
  });
};

export const scheduleReadableStreamLike = <T>(
  input: ReadableStreamLike<T>,
  scheduler: Scheduler
): Observable<T> => scheduleAsyncIterable(readableStreamToAsyncGenerator(input), scheduler);

/**
 * RxJS 7.8.2 root-parity name. A function input is already an Observable in
 * this representation (the `innerFrom` first case), so it takes the
 * observable route; everything else follows RxJS's probe order.
 */
export const scheduled = <T>(input: ObservableInput<T>, scheduler: Scheduler): Observable<T> => {
  if (typeof input === 'function') {
    return scheduleObservable(input as Observable<T>, scheduler);
  }
  if (input != null) {
    if (isInteropObservable(input)) {
      return scheduleObservable(input, scheduler);
    }
    if (isArrayLike(input)) {
      return scheduleArray(input, scheduler);
    }
    if (isPromise(input)) {
      return schedulePromise(input, scheduler);
    }
    if (isAsyncIterable(input)) {
      return scheduleAsyncIterable(input, scheduler);
    }
    if (isIterable(input)) {
      return scheduleIterable(input, scheduler);
    }
    if (isReadableStreamLike(input)) {
      return scheduleReadableStreamLike(input, scheduler);
    }
  }
  throw createInvalidObservableTypeError(input);
};
