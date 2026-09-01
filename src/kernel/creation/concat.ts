import type { ObservableInput } from '../interop.ts';
import type { Observable } from '../observable.ts';
import { concatAll } from '../operators/concat-all.ts';
import { scheduled } from '../scheduled.ts';
import type { Scheduler } from '../scheduler.ts';
import { of } from './of.ts';

/**
 * Coordination as flattening algebra: concatenation is `concatAll` over a
 * synchronous emission of the sources — later sources are queued sources.
 * With the deprecated scheduler argument (M18) the source list itself is
 * emitted through `scheduled`, one source per scheduled run.
 */
export const concat = <T>(sources: ReadonlyArray<ObservableInput<T>>, scheduler?: Scheduler): Observable<T> =>
  concatAll<T>()(scheduler ? scheduled<ObservableInput<T>>(sources, scheduler) : of(...sources));
