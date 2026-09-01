import { combineLatest } from '../creation/combine-latest.ts';
import { zip } from '../creation/zip.ts';
import type { ObservableInput } from '../interop.ts';
import type { Observable } from '../observable.ts';
import type { OperatorFunction } from '../operator.ts';
import { identity, pipe } from '../pipe.ts';
import { mapOneOrManyArgs } from './map.ts';
import { mergeMap } from './merge-map.ts';
import { toArray } from './to-array.ts';

/**
 * M18: RxJS's `joinAllInternals` — collect every inner input until the outer
 * completes, join the collected sources with the given coordination function,
 * and optionally spread each joined tuple into a projection. Pure operator
 * algebra over `toArray`, `mergeMap`, and `map`.
 */
export const joinAllInternals = <T, R>(
  joinFn: (sources: ReadonlyArray<ObservableInput<T>>) => Observable<T[]>,
  project?: (...values: T[]) => R
): OperatorFunction<ObservableInput<T>, T[] | R> =>
  pipe(
    toArray<ObservableInput<T>>(),
    mergeMap((sources: Array<ObservableInput<T>>) => joinFn(sources)),
    (project ? mapOneOrManyArgs(project) : identity) as OperatorFunction<T[], T[] | R>
  );

/** Deprecated RxJS 7.8.2 name: `combineLatest` over the collected inner inputs. */
export function combineLatestAll<T>(): OperatorFunction<ObservableInput<T>, T[]>;
export function combineLatestAll<T, R>(project: (...values: T[]) => R): OperatorFunction<ObservableInput<T>, R>;
export function combineLatestAll<T, R>(
  project?: (...values: T[]) => R
): OperatorFunction<ObservableInput<T>, T[] | R> {
  return joinAllInternals<T, R>(combineLatest, project);
}

/** Deprecated alias: the same function reference as `combineLatestAll`. */
export const combineAll = combineLatestAll;

/** Deprecated RxJS 7.8.2 name: `zip` over the collected inner inputs. */
export function zipAll<T>(): OperatorFunction<ObservableInput<T>, T[]>;
export function zipAll<T, R>(project: (...values: T[]) => R): OperatorFunction<ObservableInput<T>, R>;
export function zipAll<T, R>(project?: (...values: T[]) => R): OperatorFunction<ObservableInput<T>, T[] | R> {
  return joinAllInternals<T, R>(zip, project);
}
