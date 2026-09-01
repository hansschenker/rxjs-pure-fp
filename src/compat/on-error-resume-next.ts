import { onErrorResumeNext as onErrorResumeNextKernel } from '../kernel/creation/on-error-resume-next.ts';
import type { ObservableInput } from '../kernel/interop.ts';
import type { Observable } from '../kernel/observable.ts';
import type { OperatorFunction } from '../kernel/operator.ts';

/**
 * RxJS 7.8.2 argument surface for both root names: rest arguments or a single
 * array of sources (`argsOrArgArray` — a lone array argument is always the
 * source list, never an array source).
 */

const argsOrArgArray = <T>(
  args: ReadonlyArray<ObservableInput<T> | ReadonlyArray<ObservableInput<T>>>
): ReadonlyArray<ObservableInput<T>> =>
  args.length === 1 && Array.isArray(args[0])
    ? (args[0] as ReadonlyArray<ObservableInput<T>>)
    : (args as ReadonlyArray<ObservableInput<T>>);

export function onErrorResumeNext<T>(sources: ReadonlyArray<ObservableInput<T>>): Observable<T>;
export function onErrorResumeNext<T>(...sources: Array<ObservableInput<T>>): Observable<T>;
export function onErrorResumeNext<T>(
  ...sources: Array<ObservableInput<T> | ReadonlyArray<ObservableInput<T>>>
): Observable<T> {
  return onErrorResumeNextKernel(argsOrArgArray(sources));
}

export function onErrorResumeNextWith<T, D = T>(
  sources: ReadonlyArray<ObservableInput<D>>
): OperatorFunction<T, T | D>;
export function onErrorResumeNextWith<T, D = T>(
  ...sources: Array<ObservableInput<D>>
): OperatorFunction<T, T | D>;
export function onErrorResumeNextWith<T, D = T>(
  ...sources: Array<ObservableInput<D> | ReadonlyArray<ObservableInput<D>>>
): OperatorFunction<T, T | D> {
  const nextSources = argsOrArgArray(sources);
  return (source) =>
    onErrorResumeNextKernel<T | D>([source, ...nextSources]);
}
