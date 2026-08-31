import { createObservable, executeSource, type Observable as ObservableFn } from '../kernel/observable.ts';
import type { PartialObserver, Subscriber } from '../kernel/sink.ts';
import { isSubscription, type Subscription, type TeardownLogic } from '../kernel/subscription.ts';
import { errorContext } from './error-context.ts';
import { createSafeSubscriber } from './sink.ts';

/**
 * RxJS 7.8.2 constructor-initializer contract: the initializer receives the
 * returned Observable function as `this`. The kernel has no such binding —
 * a kernel Observable is a plain `(subscriber) => TeardownLogic` function.
 */
export type ObservableInitializer<T> = (
  this: ObservableFn<T>,
  subscriber: Subscriber<T>
) => TeardownLogic;

export type Subscribe = {
  <T>(observer?: PartialObserver<T> | Subscriber<T> | ((value: T) => void) | null): (source: ObservableFn<T>) => Subscription;
  <T>(
    next?: ((value: T) => void) | null,
    error?: ((error: unknown) => void) | null,
    complete?: (() => void) | null
  ): (source: ObservableFn<T>) => Subscription;
};

export type ObservableFactory = {
  <T>(initializer?: ObservableInitializer<T>): ObservableFn<T>;
  readonly create: <T>(initializer?: ObservableInitializer<T>) => ObservableFn<T>;
};

const bindInitializer = <T>(initializer?: ObservableInitializer<T>): ObservableFn<T> => {
  if (!initializer) {
    return createObservable();
  }

  let observable!: ObservableFn<T>;
  observable = createObservable((subscriber: Subscriber<T>): TeardownLogic =>
    Reflect.apply(initializer, observable, [subscriber]) as TeardownLogic);
  return observable;
};

const observableFactory = <T>(initializer?: ObservableInitializer<T>): ObservableFn<T> =>
  bindInitializer(initializer);

/**
 * RxJS 7.8.2 root-parity name. It is intentionally a non-constructible
 * functional factory. The deprecated static `create` capability is retained as
 * a function property.
 */
export const Observable = Object.assign(observableFactory, {
  create: <T>(initializer?: ObservableInitializer<T>): ObservableFn<T> => bindInitializer(initializer),
}) as ObservableFactory;

/**
 * Public subscribe surface: safe-subscriber conversion, the deprecated
 * callback overload, and the deprecated synchronous error context wrap the
 * kernel execution connector.
 */
export const subscribe: Subscribe = (<T>(
  observerOrNext?: PartialObserver<T> | Subscriber<T> | ((value: T) => void) | null,
  error?: ((error: unknown) => void) | null,
  complete?: (() => void) | null
) => {
  return (source: ObservableFn<T>): Subscription => {
    const subscriber = isSubscriber(observerOrNext)
      ? observerOrNext
      : createSafeSubscriber(observerOrNext, error, complete);

    errorContext(() => {
      executeSource(source, subscriber);
    });

    return subscriber;
  };
}) as Subscribe;

const isSubscriber = <T>(value: unknown): value is Subscriber<T> => {
  if (!isSubscription(value)) {
    return false;
  }

  const candidate = value as Partial<Subscriber<T>>;
  return (
    typeof candidate.next === 'function' &&
    typeof candidate.error === 'function' &&
    typeof candidate.complete === 'function'
  );
};
