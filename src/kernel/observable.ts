import type { Subscriber } from './sink.ts';
import type { TeardownLogic } from './subscription.ts';

export type Observable<T> = (subscriber: Subscriber<T>) => TeardownLogic;

const observableMarker = Symbol('rxjs-pure-fp.observable');

type ObservableBrand = { [observableMarker]?: boolean };

/**
 * Kernel construction is reference-identity: any `(subscriber) =>
 * TeardownLogic` function already is an Observable, and the same function is
 * returned. Construction stamps a brand symbol on it (M09) so variadic compat
 * surfaces can tell trailing source functions from trailing selector
 * functions — in this representation both are functions. The deprecated
 * `this`-bound initializer contract of RxJS 7.8.2 lives in the compat
 * `Observable` factory, not here.
 */
export const createObservable = <T>(run?: Observable<T>): Observable<T> => {
  const observable = run ?? (() => undefined);
  (observable as ObservableBrand)[observableMarker] = true;
  return observable;
};

/**
 * True for functions created (or re-branded) via `createObservable`. Raw
 * unbranded functions are still valid Observables everywhere except as
 * trailing rest arguments of the selector-capable compat surfaces.
 */
export const isBrandedObservable = (value: unknown): value is Observable<unknown> =>
  typeof value === 'function' && (value as ObservableBrand)[observableMarker] === true;

const subscribePreflight = Symbol('rxjs-pure-fp.observable.preflight');

type PreflightCarrier = { [subscribePreflight]?: () => void };

/**
 * M10 functional override point mirroring RxJS's `_trySubscribe` overrides:
 * a check invoked before the guarded source execution, so its throw reaches
 * the subscribe caller synchronously (Subjects throw
 * `ObjectUnsubscribedError` this way). Nested executions still route the
 * throw to the error channel, because the outer guarded region catches it.
 */
export const setSubscribePreflight = <T>(observable: Observable<T>, check: () => void): void => {
  (observable as PreflightCarrier)[subscribePreflight] = check;
};

/**
 * Connects source execution to an already-owned Subscriber: the returned
 * teardown joins the subscriber lifecycle, and synchronous initializer throws
 * are routed to the error channel.
 */
export const executeSource = <T>(source: Observable<T>, subscriber: Subscriber<T>): void => {
  (source as PreflightCarrier)[subscribePreflight]?.();
  subscriber.add(tryExecute(source, subscriber));
};

const tryExecute = <T>(source: Observable<T>, subscriber: Subscriber<T>): TeardownLogic => {
  try {
    return source(subscriber);
  } catch (error) {
    subscriber.error(error);
    return undefined;
  }
};
