import type { Observable } from '../observable.ts';
import { from } from './from.ts';

/**
 * Deprecated RxJS 7.8.2 parity name: `from(Object.entries(obj))`. The
 * scheduler argument is deferred with `from`'s scheduler overload (M18).
 */
export const pairs = <T>(obj: Readonly<Record<string, T>>): Observable<[string, T]> =>
  from(Object.entries(obj));
