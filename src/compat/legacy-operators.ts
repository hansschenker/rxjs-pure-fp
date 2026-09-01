import { combineLatest as combineLatestKernel } from '../kernel/creation/combine-latest.ts';
import { concat as concatKernel } from '../kernel/creation/concat.ts';
import { merge as mergeKernel } from '../kernel/creation/merge.ts';
import type { ObservableInput } from '../kernel/interop.ts';
import type { Observable } from '../kernel/observable.ts';
import type { MonoTypeOperatorFunction, OperatorFunction } from '../kernel/operator.ts';
import { mapOneOrManyArgs } from '../kernel/operators/map.ts';
import { raceWith } from '../kernel/operators/race-with.ts';
import { pipe } from '../kernel/pipe.ts';
import type { Scheduler } from '../kernel/scheduler.ts';
import { partition as partitionCreation } from './collection.ts';
import { argsOrArgArray, popResultSelector, zip as zipCreation } from './coordination.ts';
import { onErrorResumeNextWith } from './on-error-resume-next.ts';
import { popScheduler } from './scheduler-args.ts';

/**
 * M19: the `rxjs/operators` subpath names whose operator forms differ from
 * the root creation functions of the same name. Each is RxJS 7.8.2's own
 * construction: the creation function over `[source, ...others]`, with the
 * subpath's argument surface (trailing result selectors, schedulers, and
 * merge's concurrency).
 */

type AnyObservable = Observable<unknown>;

/** `rxjs/operators` `onErrorResumeNext` is the operator form: the same reference as `onErrorResumeNextWith`. */
export const onErrorResumeNext = onErrorResumeNextWith;

export function combineLatest<T, O>(
  ...others: Array<ObservableInput<O>>
): OperatorFunction<T, Array<T | O>>;
export function combineLatest<T, O, R>(
  ...othersAndSelector: [...Array<ObservableInput<O>>, (...values: Array<T | O>) => R]
): OperatorFunction<T, R>;
export function combineLatest(...args: unknown[]): OperatorFunction<unknown, unknown> {
  const resultSelector = popResultSelector(args);
  const withoutSelector = combineLatest as (...rest: unknown[]) => OperatorFunction<unknown, unknown[]>;
  return resultSelector
    ? pipe(withoutSelector(...args), mapOneOrManyArgs(resultSelector))
    : (source: AnyObservable) => combineLatestKernel([source, ...argsOrArgArray(args)]);
}

export function concat<T>(...others: Array<ObservableInput<T>>): MonoTypeOperatorFunction<T>;
export function concat<T>(
  ...othersAndScheduler: [...Array<ObservableInput<T>>, Scheduler]
): MonoTypeOperatorFunction<T>;
export function concat<T>(...args: Array<ObservableInput<T> | Scheduler>): MonoTypeOperatorFunction<T> {
  const scheduler = popScheduler(args);
  return (source) => concatKernel<T>([source, ...(args as Array<ObservableInput<T>>)], scheduler);
}

export function merge<T>(...others: Array<ObservableInput<T>>): MonoTypeOperatorFunction<T>;
export function merge<T>(
  ...othersAndConcurrent: [...Array<ObservableInput<T>>, number]
): MonoTypeOperatorFunction<T>;
export function merge<T>(
  ...othersAndScheduler: [...Array<ObservableInput<T>>, Scheduler]
): MonoTypeOperatorFunction<T>;
export function merge<T>(
  ...othersConcurrentAndScheduler: [...Array<ObservableInput<T>>, number, Scheduler]
): MonoTypeOperatorFunction<T>;
export function merge<T>(
  ...args: Array<ObservableInput<T> | number | Scheduler>
): MonoTypeOperatorFunction<T> {
  const scheduler = popScheduler(args);
  const concurrent =
    typeof args[args.length - 1] === 'number' ? (args.pop() as number) : Infinity;
  return (source) =>
    mergeKernel<T>([source, ...(args as Array<ObservableInput<T>>)], concurrent, scheduler);
}

export function zip<T, O>(...others: Array<ObservableInput<O>>): OperatorFunction<T, Array<T | O>>;
export function zip<T, O, R>(
  ...othersAndSelector: [...Array<ObservableInput<O>>, (...values: Array<T | O>) => R]
): OperatorFunction<T, R>;
export function zip(...args: unknown[]): OperatorFunction<unknown, unknown> {
  return (source: AnyObservable) =>
    (zipCreation as (...sources: unknown[]) => AnyObservable)(source, ...args);
}

export function race<T>(...others: Array<ObservableInput<T>>): MonoTypeOperatorFunction<T>;
export function race<T>(others: ReadonlyArray<ObservableInput<T>>): MonoTypeOperatorFunction<T>;
export function race<T>(...args: unknown[]): MonoTypeOperatorFunction<T> {
  return raceWith<T>(...(argsOrArgArray(args) as Array<ObservableInput<T>>));
}

/** The operator form of `partition`: `[matches, rest]` from the piped source. */
export const partition =
  <T, A = undefined>(predicate: (this: A, value: T, index: number) => boolean, thisArg?: A) =>
  (source: Observable<T>): [Observable<T>, Observable<T>] =>
    partitionCreation<T, A>(source, predicate, thisArg);
