import type { ObservableInput } from '../interop.ts';
import type { Observable } from '../observable.ts';
import { concatAll } from '../operators/concat-all.ts';
import { of } from './of.ts';

/**
 * Coordination as flattening algebra: concatenation is `concatAll` over a
 * synchronous emission of the sources — later sources are queued sources.
 */
export const concat = <T>(sources: ReadonlyArray<ObservableInput<T>>): Observable<T> =>
  concatAll<T>()(of(...sources));
