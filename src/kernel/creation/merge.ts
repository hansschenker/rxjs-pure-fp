import type { Observable } from '../observable.ts';
import { mergeAll } from '../operators/merge-all.ts';
import { EMPTY } from './empty.ts';
import { of } from './of.ts';

/**
 * Coordination as flattening algebra: merging sources is `mergeAll` over a
 * synchronous emission of the sources. A single source is returned as-is
 * (RxJS `innerFrom` identity); no sources is `EMPTY`.
 */
export const merge = <T>(
  sources: ReadonlyArray<Observable<T>>,
  concurrent = Infinity
): Observable<T> =>
  sources.length === 0
    ? EMPTY
    : sources.length === 1
      ? (sources[0] as Observable<T>)
      : mergeAll<T>(concurrent)(of(...sources));
