import type { Observable } from '../kernel/observable.ts';
import type { OperatorFunction } from '../kernel/operator.ts';
import { concatMap as concatMapKernel } from '../kernel/operators/concat-map.ts';
import { exhaustMap as exhaustMapKernel } from '../kernel/operators/exhaust-map.ts';
import { map as mapKernel } from '../kernel/operators/map.ts';
import { mergeMap as mergeMapKernel } from '../kernel/operators/merge-map.ts';
import { switchMap as switchMapKernel } from '../kernel/operators/switch-map.ts';

/**
 * RxJS 7.8.2 parity surface for the flattening family: the deprecated
 * `resultSelector` overloads are recovered by composition — the projected
 * inner is mapped with `(innerValue, innerIndex) => selector(...)` — which is
 * how RxJS itself implements them. The `*MapTo` operators and the `flatMap`
 * alias are deprecated parity names over the same kernel operators.
 */
export type FlattenResultSelector<T, I, R> = (
  outerValue: T,
  innerValue: I,
  outerIndex: number,
  innerIndex: number
) => R;

const withResultSelector = <T, I, R>(
  project: (value: T, index: number) => Observable<I>,
  resultSelector: FlattenResultSelector<T, I, R>
): ((value: T, index: number) => Observable<R>) =>
  (value, index) =>
    mapKernel((innerValue: I, innerIndex: number) => resultSelector(value, innerValue, index, innerIndex))(
      project(value, index)
    );

export function mergeMap<T, R>(
  project: (value: T, index: number) => Observable<R>,
  concurrent?: number
): OperatorFunction<T, R>;
export function mergeMap<T, I, R>(
  project: (value: T, index: number) => Observable<I>,
  resultSelector: FlattenResultSelector<T, I, R>,
  concurrent?: number
): OperatorFunction<T, R>;
export function mergeMap<T, I, R>(
  project: (value: T, index: number) => Observable<I>,
  resultSelector?: FlattenResultSelector<T, I, R> | number,
  concurrent = Infinity
): OperatorFunction<T, R> {
  if (typeof resultSelector === 'function') {
    return mergeMapKernel(withResultSelector(project, resultSelector), concurrent);
  }
  if (typeof resultSelector === 'number') {
    concurrent = resultSelector;
  }
  return mergeMapKernel(project, concurrent) as unknown as OperatorFunction<T, R>;
}

/** Deprecated RxJS root alias for `mergeMap`. */
export const flatMap = mergeMap;

export function concatMap<T, R>(
  project: (value: T, index: number) => Observable<R>
): OperatorFunction<T, R>;
export function concatMap<T, I, R>(
  project: (value: T, index: number) => Observable<I>,
  resultSelector: FlattenResultSelector<T, I, R>
): OperatorFunction<T, R>;
export function concatMap<T, I, R>(
  project: (value: T, index: number) => Observable<I>,
  resultSelector?: FlattenResultSelector<T, I, R>
): OperatorFunction<T, R> {
  return typeof resultSelector === 'function'
    ? concatMapKernel(withResultSelector(project, resultSelector))
    : (concatMapKernel(project) as unknown as OperatorFunction<T, R>);
}

export function switchMap<T, R>(
  project: (value: T, index: number) => Observable<R>
): OperatorFunction<T, R>;
export function switchMap<T, I, R>(
  project: (value: T, index: number) => Observable<I>,
  resultSelector: FlattenResultSelector<T, I, R>
): OperatorFunction<T, R>;
export function switchMap<T, I, R>(
  project: (value: T, index: number) => Observable<I>,
  resultSelector?: FlattenResultSelector<T, I, R>
): OperatorFunction<T, R> {
  return typeof resultSelector === 'function'
    ? switchMapKernel(withResultSelector(project, resultSelector))
    : (switchMapKernel(project) as unknown as OperatorFunction<T, R>);
}

export function exhaustMap<T, R>(
  project: (value: T, index: number) => Observable<R>
): OperatorFunction<T, R>;
export function exhaustMap<T, I, R>(
  project: (value: T, index: number) => Observable<I>,
  resultSelector: FlattenResultSelector<T, I, R>
): OperatorFunction<T, R>;
export function exhaustMap<T, I, R>(
  project: (value: T, index: number) => Observable<I>,
  resultSelector?: FlattenResultSelector<T, I, R>
): OperatorFunction<T, R> {
  return typeof resultSelector === 'function'
    ? exhaustMapKernel(withResultSelector(project, resultSelector))
    : (exhaustMapKernel(project) as unknown as OperatorFunction<T, R>);
}

export function mergeMapTo<T, R>(
  innerObservable: Observable<R>,
  concurrent?: number
): OperatorFunction<T, R>;
export function mergeMapTo<T, I, R>(
  innerObservable: Observable<I>,
  resultSelector: FlattenResultSelector<T, I, R>,
  concurrent?: number
): OperatorFunction<T, R>;
export function mergeMapTo<T, I, R>(
  innerObservable: Observable<I>,
  resultSelector?: FlattenResultSelector<T, I, R> | number,
  concurrent = Infinity
): OperatorFunction<T, R> {
  if (typeof resultSelector === 'function') {
    return mergeMap(() => innerObservable, resultSelector, concurrent);
  }
  if (typeof resultSelector === 'number') {
    concurrent = resultSelector;
  }
  return mergeMap<T, R>(() => innerObservable as unknown as Observable<R>, concurrent);
}

export function concatMapTo<T, R>(innerObservable: Observable<R>): OperatorFunction<T, R>;
export function concatMapTo<T, I, R>(
  innerObservable: Observable<I>,
  resultSelector: FlattenResultSelector<T, I, R>
): OperatorFunction<T, R>;
export function concatMapTo<T, I, R>(
  innerObservable: Observable<I>,
  resultSelector?: FlattenResultSelector<T, I, R>
): OperatorFunction<T, R> {
  return typeof resultSelector === 'function'
    ? concatMap(() => innerObservable, resultSelector)
    : concatMap<T, R>(() => innerObservable as unknown as Observable<R>);
}

export function switchMapTo<T, R>(innerObservable: Observable<R>): OperatorFunction<T, R>;
export function switchMapTo<T, I, R>(
  innerObservable: Observable<I>,
  resultSelector: FlattenResultSelector<T, I, R>
): OperatorFunction<T, R>;
export function switchMapTo<T, I, R>(
  innerObservable: Observable<I>,
  resultSelector?: FlattenResultSelector<T, I, R>
): OperatorFunction<T, R> {
  return typeof resultSelector === 'function'
    ? switchMap(() => innerObservable, resultSelector)
    : switchMap<T, R>(() => innerObservable as unknown as Observable<R>);
}
