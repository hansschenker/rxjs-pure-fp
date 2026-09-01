import type { ObservableInput } from '../interop.ts';
import type { Observable } from '../observable.ts';
import { defer } from './defer.ts';

/**
 * Chooses between the two inputs at subscription time. Both branches are
 * eagerly created by the caller (RxJS semantics) — only the subscription is
 * deferred.
 */
export const iif = <T, F>(
  condition: () => boolean,
  trueResult: ObservableInput<T>,
  falseResult: ObservableInput<F>
): Observable<T | F> =>
  defer<T | F>(() => (condition() ? trueResult : falseResult) as ObservableInput<T | F>);
