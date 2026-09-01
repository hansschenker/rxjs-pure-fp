import { innerFrom, type ObservableInput } from '../interop.ts';
import { createObservable, executeSource, type Observable } from '../observable.ts';

/**
 * Calls the factory on each subscription and subscribes to its converted
 * result. A factory throw (or an unconvertible result) is routed to the
 * subscriber's error channel by the guarded source execution, matching RxJS.
 */
export const defer = <T>(observableFactory: () => ObservableInput<T>): Observable<T> =>
  createObservable((subscriber) => {
    executeSource(innerFrom(observableFactory()), subscriber);
  });
