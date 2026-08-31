import { race } from '../creation/race.ts';
import type { Observable } from '../observable.ts';
import type { MonoTypeOperatorFunction } from '../operator.ts';
import { identity } from '../pipe.ts';

/**
 * Operator algebra: `race` over `[source, ...others]`. With no companions it
 * is the identity operator, as in RxJS.
 */
export const raceWith = <T>(...others: Array<Observable<T>>): MonoTypeOperatorFunction<T> =>
  others.length === 0 ? identity : (source) => race([source, ...others]);
