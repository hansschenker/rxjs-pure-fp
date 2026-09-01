import { innerFrom, type ObservableInput } from '../interop.ts';
import { createObservable, executeSource, type Observable } from '../observable.ts';
import type { Unsubscribable } from '../subscription.ts';
import { EMPTY } from './empty.ts';

/**
 * Creates a resource per subscription and disposes it on teardown. A void
 * observable-factory result subscribes to `EMPTY` per RxJS; factory throws
 * reach the error channel via the guarded execution, in which case no
 * teardown was registered yet — also RxJS behavior.
 */
export const using = <T>(
  resourceFactory: () => Unsubscribable | void,
  observableFactory: (resource: Unsubscribable | void) => ObservableInput<T> | void
): Observable<T> =>
  createObservable((subscriber) => {
    const resource = resourceFactory();
    const result = observableFactory(resource);
    const source = result ? innerFrom(result) : EMPTY;
    executeSource(source, subscriber);
    return () => {
      if (resource) {
        resource.unsubscribe();
      }
    };
  });
