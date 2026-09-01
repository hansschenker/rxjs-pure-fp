import { combineLatest as combineLatestKernel } from '../kernel/creation/combine-latest.ts';
import { concat as concatKernel } from '../kernel/creation/concat.ts';
import { forkJoin as forkJoinKernel } from '../kernel/creation/fork-join.ts';
import { merge as mergeKernel } from '../kernel/creation/merge.ts';
import { race as raceKernel } from '../kernel/creation/race.ts';
import { zip as zipKernel } from '../kernel/creation/zip.ts';
import type { ObservableInput } from '../kernel/interop.ts';
import { isBrandedObservable, type Observable } from '../kernel/observable.ts';
import type { OperatorFunction } from '../kernel/operator.ts';
import { map } from '../kernel/operators/map.ts';
import { withLatestFrom as withLatestFromKernel } from '../kernel/operators/with-latest-from.ts';

/**
 * RxJS 7.8.2 argument surface for the coordination family: rest arguments,
 * single-array form, plain-object (dictionary) form, deprecated result
 * selectors, and merge's trailing `concurrent`. Since M16 every input is any
 * `ObservableInput`, converted by the kernel machines; the deprecated
 * scheduler arguments remain deferred to M18.
 */

type AnyObservable = Observable<unknown>;
type AnySelector = (...values: unknown[]) => unknown;

// In this representation Observables ARE functions, so the RxJS trailing-
// selector heuristic must exclude branded observables. Raw-function sources
// in trailing rest position would be misread as selectors; use the array
// forms for those (recorded as an intentional deviation).
const popResultSelector = (args: unknown[]): AnySelector | undefined => {
  const last = args[args.length - 1];
  return typeof last === 'function' && !isBrandedObservable(last)
    ? (args.pop() as AnySelector)
    : undefined;
};

const argsOrArgArray = (args: unknown[]): AnyObservable[] =>
  args.length === 1 && Array.isArray(args[0]) ? (args[0] as AnyObservable[]) : (args as AnyObservable[]);

const plainObjectPrototype: unknown = Object.getPrototypeOf({});

const isPlainObject = (value: unknown): value is Record<string, AnyObservable> =>
  value !== null && typeof value === 'object' && (Object.getPrototypeOf(value) as unknown) === plainObjectPrototype;

const argsArgArrayOrObject = (
  args: unknown[]
): { sources: AnyObservable[]; keys: string[] | null } => {
  if (args.length === 1) {
    const first = args[0];
    if (Array.isArray(first)) {
      return { sources: first as AnyObservable[], keys: null };
    }
    if (isPlainObject(first)) {
      const keys = Object.keys(first);
      return { sources: keys.map((key) => first[key] as AnyObservable), keys };
    }
  }
  return { sources: args as AnyObservable[], keys: null };
};

const buildObject = (keys: string[], values: unknown[]): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (let index = 0; index < keys.length; index += 1) {
    result[keys[index] as string] = values[index];
  }
  return result;
};

const applySelector = (selector: AnySelector) => (value: unknown): unknown =>
  Array.isArray(value) ? selector(...value) : selector(value);

const shapeResult = (
  result: Observable<unknown[]>,
  keys: string[] | null,
  resultSelector: AnySelector | undefined
): AnyObservable => {
  const keyed = keys ? map((values: unknown[]) => buildObject(keys, values))(result) : result;
  return resultSelector ? map(applySelector(resultSelector))(keyed as Observable<unknown>) : keyed;
};

export function merge<T>(...sources: Array<ObservableInput<T>>): Observable<T>;
export function merge<T>(...sourcesAndConcurrent: [...Array<ObservableInput<T>>, number]): Observable<T>;
export function merge<T>(...args: Array<ObservableInput<T> | number>): Observable<T> {
  const concurrent =
    typeof args[args.length - 1] === 'number' ? (args.pop() as number) : Infinity;
  return mergeKernel(args as Array<ObservableInput<T>>, concurrent);
}

export const concat = <T>(...sources: Array<ObservableInput<T>>): Observable<T> => concatKernel(sources);

export function combineLatest<T>(sources: ReadonlyArray<ObservableInput<T>>): Observable<T[]>;
export function combineLatest<T>(
  sourcesObject: Readonly<Record<string, ObservableInput<T>>>
): Observable<Record<string, T>>;
export function combineLatest<T>(...sources: Array<ObservableInput<T>>): Observable<T[]>;
export function combineLatest<T, R>(
  ...sourcesAndSelector: [...Array<ObservableInput<T>>, (...values: T[]) => R]
): Observable<R>;
export function combineLatest(...args: unknown[]): AnyObservable {
  const resultSelector = popResultSelector(args);
  const { sources, keys } = argsArgArrayOrObject(args);
  return shapeResult(combineLatestKernel(sources), keys, resultSelector);
}

export function zip<T>(sources: ReadonlyArray<ObservableInput<T>>): Observable<T[]>;
export function zip<T>(...sources: Array<ObservableInput<T>>): Observable<T[]>;
export function zip<T, R>(
  ...sourcesAndSelector: [...Array<ObservableInput<T>>, (...values: T[]) => R]
): Observable<R>;
export function zip(...args: unknown[]): AnyObservable {
  const resultSelector = popResultSelector(args);
  const sources = argsOrArgArray(args);
  return shapeResult(zipKernel(sources), null, resultSelector);
}

export function race<T>(sources: ReadonlyArray<ObservableInput<T>>): Observable<T>;
export function race<T>(...sources: Array<ObservableInput<T>>): Observable<T>;
export function race(...args: unknown[]): AnyObservable {
  return raceKernel(argsOrArgArray(args));
}

export function forkJoin<T>(sources: ReadonlyArray<ObservableInput<T>>): Observable<T[]>;
export function forkJoin<T>(
  sourcesObject: Readonly<Record<string, ObservableInput<T>>>
): Observable<Record<string, T>>;
export function forkJoin<T>(...sources: Array<ObservableInput<T>>): Observable<T[]>;
export function forkJoin<T, R>(
  ...sourcesAndSelector: [...Array<ObservableInput<T>>, (...values: T[]) => R]
): Observable<R>;
export function forkJoin(...args: unknown[]): AnyObservable {
  const resultSelector = popResultSelector(args);
  const { sources, keys } = argsArgArrayOrObject(args);
  return shapeResult(forkJoinKernel(sources), keys, resultSelector);
}

export function withLatestFrom<T, O>(
  ...sources: Array<ObservableInput<O>>
): OperatorFunction<T, [T, ...O[]]>;
export function withLatestFrom<T, O, R>(
  ...sourcesAndProject: [...Array<ObservableInput<O>>, (...values: [T, ...O[]]) => R]
): OperatorFunction<T, R>;
export function withLatestFrom(...args: unknown[]): OperatorFunction<unknown, unknown> {
  const project = popResultSelector(args);
  return withLatestFromKernel(
    args as AnyObservable[],
    project as ((...values: [unknown, ...unknown[]]) => unknown) | undefined
  );
}
