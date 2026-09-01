import { innerFrom, type ObservableInput } from '../interop.ts';
import type { Observable } from '../observable.ts';
import { mergeAll } from '../operators/merge-all.ts';
import { scheduled } from '../scheduled.ts';
import type { Scheduler } from '../scheduler.ts';
import { EMPTY } from './empty.ts';
import { of } from './of.ts';

/**
 * Coordination as flattening algebra: merging sources is `mergeAll` over a
 * synchronous emission of the sources. A single source is returned as-is
 * (RxJS `innerFrom` identity — the scheduler is ignored there, as in RxJS);
 * no sources is `EMPTY`. With the deprecated scheduler argument (M18) the
 * source list is emitted through `scheduled`.
 */
export const merge = <T>(
  sources: ReadonlyArray<ObservableInput<T>>,
  concurrent = Infinity,
  scheduler?: Scheduler
): Observable<T> =>
  sources.length === 0
    ? EMPTY
    : sources.length === 1
      ? innerFrom(sources[0] as ObservableInput<T>)
      : mergeAll<T>(concurrent)(
          scheduler ? scheduled<ObservableInput<T>>(sources, scheduler) : of(...sources)
        );
