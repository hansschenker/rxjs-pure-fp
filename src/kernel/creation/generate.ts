import type { Observable } from '../observable.ts';
import { identity } from '../pipe.ts';
import { scheduleIterable } from '../scheduled.ts';
import { isScheduler, type Scheduler } from '../scheduler.ts';
import { defer } from './defer.ts';

export type GenerateBaseOptions<S> = {
  readonly initialState: S;
  readonly condition?: ((state: S) => boolean) | undefined;
  readonly iterate: (state: S) => S;
  readonly scheduler?: Scheduler | undefined;
};

export type GenerateOptions<T, S> = GenerateBaseOptions<S> & {
  readonly resultSelector: (state: S) => T;
};

/**
 * Loop-as-stream: a generator over `(initialState, condition, iterate,
 * resultSelector)` subscribed through `defer`, exactly RxJS's construction.
 * An absent condition loops forever; state-function throws reach the error
 * channel through the deferred subscription. The options form carries the
 * same fields, and a scheduler (options field, or the deprecated positional
 * argument after `iterate` / `resultSelector`) pulls the generator through
 * `scheduleIterable` instead.
 */
export function generate<S>(options: GenerateBaseOptions<S>): Observable<S>;
export function generate<T, S>(options: GenerateOptions<T, S>): Observable<T>;
export function generate<S>(
  initialState: S,
  condition: (state: S) => boolean,
  iterate: (state: S) => S,
  scheduler?: Scheduler
): Observable<S>;
export function generate<T, S>(
  initialState: S,
  condition: (state: S) => boolean,
  iterate: (state: S) => S,
  resultSelector: (state: S) => T,
  scheduler?: Scheduler
): Observable<T>;
export function generate<T, S>(
  ...args: [
    S | GenerateBaseOptions<S> | GenerateOptions<T, S>,
    ((state: S) => boolean)?,
    ((state: S) => S)?,
    (((state: S) => T) | Scheduler)?,
    Scheduler?,
  ]
): Observable<T | S> {
  let initialState: S;
  let condition: ((state: S) => boolean) | undefined;
  let iterate: (state: S) => S;
  let resultSelector: (state: S) => T | S;
  let scheduler: Scheduler | undefined;

  if (args.length === 1) {
    const options = args[0] as GenerateOptions<T, S>;
    initialState = options.initialState;
    condition = options.condition;
    iterate = options.iterate;
    resultSelector = options.resultSelector ?? (identity as (state: S) => S);
    scheduler = options.scheduler;
  } else {
    [initialState, condition, iterate] = args as [S, (state: S) => boolean, (state: S) => S];
    const resultSelectorOrScheduler = args[3] as ((state: S) => T) | Scheduler | undefined;
    if (!resultSelectorOrScheduler || isScheduler(resultSelectorOrScheduler)) {
      resultSelector = identity as (state: S) => S;
      scheduler = resultSelectorOrScheduler;
    } else {
      resultSelector = resultSelectorOrScheduler;
      scheduler = args[4] as Scheduler | undefined;
    }
  }

  const gen = function* (): Generator<T | S> {
    for (let state = initialState; !condition || condition(state); state = iterate(state)) {
      yield resultSelector(state);
    }
  };

  const pull = scheduler;
  return defer(pull ? () => scheduleIterable(gen(), pull) : gen);
}
