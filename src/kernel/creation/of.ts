import { createObservable, type Observable } from '../observable.ts';

type ValueFromArray<A extends readonly unknown[]> = A[number];

/**
 * Synchronously emits each argument and then completes.
 *
 * The deprecated RxJS scheduler overload is intentionally outside M04's
 * certified scope and is recovered with scheduler support in a later milestone.
 */
export const of = <A extends readonly unknown[]>(...values: A): Observable<ValueFromArray<A>> =>
  createObservable((subscriber) => {
    for (let index = 0; index < values.length && !subscriber.closed; index += 1) {
      subscriber.next(values[index] as ValueFromArray<A>);
    }

    // RxJS's array-like source performs this call even if synchronous
    // unsubscription closed the subscriber during the loop. The Subscriber
    // decides whether it is a terminal delivery or a stopped notification.
    subscriber.complete();
  });
