import type { Observable } from '../observable.ts';
import type { Scheduler } from '../scheduler.ts';
import { from } from './from.ts';

/**
 * Deprecated RxJS 7.8.2 parity name: `from(Object.entries(obj), scheduler)`.
 */
export const pairs = <T>(obj: Readonly<Record<string, T>>, scheduler?: Scheduler): Observable<[string, T]> =>
  from(Object.entries(obj), scheduler);
