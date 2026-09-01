import { innerFrom, type ObservableInput } from '../interop.ts';
import { createObservable, type Observable } from '../observable.ts';
import { mapOneOrManyArgs } from '../operators/map.ts';
import { mergeMap } from '../operators/merge-map.ts';
import { pipeValue } from '../pipe.ts';

export type NodeStyleEventEmitter = {
  readonly addListener: (eventName: string | symbol, handler: NodeEventHandler) => void;
  readonly removeListener: (eventName: string | symbol, handler: NodeEventHandler) => void;
};

export type NodeEventHandler = (...args: unknown[]) => void;

// RxJS types the jQuery handler with a `this: TContext` parameter; kernel
// purity forbids this-typing, so the context parameter is dropped and the
// handler is a plain function type.
export type JQueryStyleEventEmitter<T> = {
  readonly on: (eventName: string, handler: (t: T, ...args: unknown[]) => unknown) => void;
  readonly off: (eventName: string, handler: (t: T, ...args: unknown[]) => unknown) => void;
};

export type HasEventTargetAddRemove<E> = {
  readonly addEventListener: (
    type: string,
    listener: ((evt: E) => void) | null,
    options?: EventListenerOptions | boolean
  ) => void;
  readonly removeEventListener: (
    type: string,
    listener: ((evt: E) => void) | null,
    options?: EventListenerOptions | boolean
  ) => void;
};

export type EventListenerOptions = {
  readonly capture?: boolean | undefined;
  readonly passive?: boolean | undefined;
  readonly once?: boolean | undefined;
};

export type FromEventTarget<T> =
  | NodeStyleEventEmitter
  | HasEventTargetAddRemove<T>
  | JQueryStyleEventEmitter<T>
  | ArrayLike<NodeStyleEventEmitter | HasEventTargetAddRemove<T> | JQueryStyleEventEmitter<T>>;

type Handler = (...args: unknown[]) => void;

/**
 * One handler-registry probe per RxJS target shape, checked in RxJS's order:
 * EventTarget (`addEventListener`, with options), then Node-style
 * (`addListener`), then jQuery-style (`on`). Array-like targets fan out via
 * the flattening kernel; the deprecated result selector maps the emission
 * with `mapOneOrManyArgs`. Multi-argument events emit the argument array
 * (Node-style parity), single-argument events emit the value alone.
 */
export function fromEvent<T>(target: FromEventTarget<T>, eventName: string): Observable<T>;
export function fromEvent<T>(
  target: FromEventTarget<T>,
  eventName: string,
  options: EventListenerOptions
): Observable<T>;
export function fromEvent<T, R>(
  target: FromEventTarget<T>,
  eventName: string,
  resultSelector: (...args: unknown[]) => R
): Observable<R>;
export function fromEvent<T, R>(
  target: FromEventTarget<T>,
  eventName: string,
  options: EventListenerOptions,
  resultSelector: (...args: unknown[]) => R
): Observable<R>;
export function fromEvent<T>(
  target: FromEventTarget<T>,
  eventName: string,
  options?: EventListenerOptions | ((...args: unknown[]) => T),
  resultSelector?: (...args: unknown[]) => T
): Observable<T> {
  if (typeof options === 'function') {
    resultSelector = options;
    options = undefined;
  }
  if (resultSelector) {
    return pipeValue(
      fromEvent(target, eventName, options as EventListenerOptions),
      mapOneOrManyArgs(resultSelector)
    ) as Observable<T>;
  }

  const [add, remove] = isEventTarget(target)
    ? ['addEventListener', 'removeEventListener'].map(
        (methodName) => (handler: Handler) =>
          (target as unknown as Record<string, (e: string, h: Handler, o?: unknown) => void>)[
            methodName
          ]!(eventName, handler, options as EventListenerOptions | undefined)
      )
    : isNodeStyleEventEmitter(target)
      ? ['addListener', 'removeListener'].map(toCommonHandlerRegistry(target, eventName))
      : isJQueryStyleEventEmitter(target)
        ? ['on', 'off'].map(toCommonHandlerRegistry(target, eventName))
        : [];

  if (!add) {
    if (isArrayLike(target)) {
      return mergeMap((subTarget: FromEventTarget<T>) => fromEvent(subTarget, eventName, options as EventListenerOptions))(
        innerFrom(target as ObservableInput<FromEventTarget<T>>)
      );
    }
    throw new TypeError('Invalid event target');
  }

  return createObservable((subscriber) => {
    const handler: Handler = (...args) => subscriber.next((1 < args.length ? args : args[0]) as T);
    add(handler);
    return () => (remove as (handler: Handler) => void)(handler);
  });
}

const toCommonHandlerRegistry =
  (target: unknown, eventName: string) =>
  (methodName: string) =>
  (handler: Handler) =>
    (target as Record<string, (e: string, h: Handler) => void>)[methodName]!(eventName, handler);

const isNodeStyleEventEmitter = (target: unknown): target is NodeStyleEventEmitter =>
  typeof (target as NodeStyleEventEmitter).addListener === 'function' &&
  typeof (target as NodeStyleEventEmitter).removeListener === 'function';

const isJQueryStyleEventEmitter = (target: unknown): target is JQueryStyleEventEmitter<unknown> =>
  typeof (target as JQueryStyleEventEmitter<unknown>).on === 'function' &&
  typeof (target as JQueryStyleEventEmitter<unknown>).off === 'function';

const isEventTarget = (target: unknown): target is HasEventTargetAddRemove<unknown> =>
  typeof (target as HasEventTargetAddRemove<unknown>).addEventListener === 'function' &&
  typeof (target as HasEventTargetAddRemove<unknown>).removeEventListener === 'function';

const isArrayLike = (target: unknown): target is ArrayLike<unknown> =>
  target != null && typeof (target as ArrayLike<unknown>).length === 'number' && typeof target !== 'function';
