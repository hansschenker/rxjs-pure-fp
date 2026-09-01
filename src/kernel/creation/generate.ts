import type { Observable } from '../observable.ts';
import { identity } from '../pipe.ts';
import { defer } from './defer.ts';

export type GenerateBaseOptions<S> = {
  readonly initialState: S;
  readonly condition?: ((state: S) => boolean) | undefined;
  readonly iterate: (state: S) => S;
};

export type GenerateOptions<T, S> = GenerateBaseOptions<S> & {
  readonly resultSelector: (state: S) => T;
};

/**
 * Loop-as-stream: a generator over `(initialState, condition, iterate,
 * resultSelector)` subscribed through `defer`, exactly RxJS's construction.
 * An absent condition loops forever; state-function throws reach the error
 * channel through the deferred subscription. The options form carries the
 * same fields; the deprecated scheduler argument is deferred to the
 * remaining-scheduler-shapes milestone (M18).
 */
export function generate<S>(options: GenerateBaseOptions<S>): Observable<S>;
export function generate<T, S>(options: GenerateOptions<T, S>): Observable<T>;
export function generate<S>(
  initialState: S,
  condition: (state: S) => boolean,
  iterate: (state: S) => S
): Observable<S>;
export function generate<T, S>(
  initialState: S,
  condition: (state: S) => boolean,
  iterate: (state: S) => S,
  resultSelector: (state: S) => T
): Observable<T>;
export function generate<T, S>(
  ...args:
    | [GenerateBaseOptions<S> | GenerateOptions<T, S>]
    | [S, (state: S) => boolean, (state: S) => S, ((state: S) => T)?]
): Observable<T | S> {
  let initialState: S;
  let condition: ((state: S) => boolean) | undefined;
  let iterate: (state: S) => S;
  let resultSelector: (state: S) => T | S;

  if (args.length === 1) {
    const options = args[0] as GenerateOptions<T, S>;
    initialState = options.initialState;
    condition = options.condition;
    iterate = options.iterate;
    resultSelector = options.resultSelector ?? (identity as (state: S) => S);
  } else {
    [initialState, condition, iterate] = args as [S, (state: S) => boolean, (state: S) => S];
    resultSelector = (args[3] as ((state: S) => T) | undefined) ?? (identity as (state: S) => S);
  }

  const gen = function* (): Generator<T | S> {
    for (let state = initialState; !condition || condition(state); state = iterate(state)) {
      yield resultSelector(state);
    }
  };

  return defer(gen);
}
