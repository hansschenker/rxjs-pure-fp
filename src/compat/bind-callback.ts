import { createObservable, executeSource, type Observable } from '../kernel/observable.ts';
import { mapOneOrManyArgs } from '../kernel/operators/map.ts';
import { observeOn } from '../kernel/operators/observe-on.ts';
import { subscribeOn } from '../kernel/operators/subscribe-on.ts';
import { pipeValue } from '../kernel/pipe.ts';
import { isScheduler, type Scheduler } from '../kernel/scheduler.ts';
import { createAsyncSubject } from '../kernel/subject.ts';

export type CallbackFunc = (...args: unknown[]) => void;

export type BoundCallbackFunc = (...args: unknown[]) => Observable<unknown>;

export type CallbackResultSelector = (...args: unknown[]) => unknown;

/**
 * RxJS 7.8.2 `bindCallbackInternals`, functionally: one AsyncSubject per
 * argument application, the callback invoked on first subscription with the
 * call-site `this` passed through, and the sync/async completion dance
 * (`isAsync`/`isComplete`) preserved exactly. The scheduler form rides the
 * already-landed `subscribeOn`/`observeOn`; the deprecated result selector
 * maps the emission with `mapOneOrManyArgs`. Node-style binding shifts a
 * leading error argument onto the error channel.
 */
const bindCallbackInternals = (
  isNodeStyle: boolean,
  callbackFunc: CallbackFunc,
  resultSelector?: CallbackResultSelector | Scheduler,
  scheduler?: Scheduler
): BoundCallbackFunc => {
  if (resultSelector) {
    if (isScheduler(resultSelector)) {
      scheduler = resultSelector;
    } else {
      const selector = resultSelector;
      return function (this: unknown, ...args: unknown[]): Observable<unknown> {
        return pipeValue(
          Reflect.apply(bindCallbackInternals(isNodeStyle, callbackFunc, scheduler), this, args) as Observable<unknown>,
          mapOneOrManyArgs(selector)
        );
      };
    }
  }

  if (scheduler) {
    const boundScheduler = scheduler;
    return function (this: unknown, ...args: unknown[]): Observable<unknown> {
      return pipeValue(
        Reflect.apply(bindCallbackInternals(isNodeStyle, callbackFunc), this, args) as Observable<unknown>,
        subscribeOn<unknown>(boundScheduler),
        observeOn<unknown>(boundScheduler)
      );
    };
  }

  return function (this: unknown, ...args: unknown[]): Observable<unknown> {
    const subject = createAsyncSubject<unknown>();
    let uninitialized = true;
    return createObservable((subscriber) => {
      executeSource(subject, subscriber);
      if (uninitialized) {
        uninitialized = false;
        let isAsync = false;
        let isComplete = false;
        Reflect.apply(callbackFunc, this, [
          ...args,
          (...results: unknown[]) => {
            if (isNodeStyle) {
              const err = results.shift();
              if (err != null) {
                subject.error(err);
                return;
              }
            }
            subject.next(1 < results.length ? results : results[0]);
            isComplete = true;
            if (isAsync) {
              subject.complete();
            }
          },
        ]);
        if (isComplete) {
          subject.complete();
        }
        isAsync = true;
      }
    });
  };
};

export const bindCallback = (
  callbackFunc: CallbackFunc,
  resultSelector?: CallbackResultSelector | Scheduler,
  scheduler?: Scheduler
): BoundCallbackFunc => bindCallbackInternals(false, callbackFunc, resultSelector, scheduler);

export const bindNodeCallback = (
  callbackFunc: CallbackFunc,
  resultSelector?: CallbackResultSelector | Scheduler,
  scheduler?: Scheduler
): BoundCallbackFunc => bindCallbackInternals(true, callbackFunc, resultSelector, scheduler);
