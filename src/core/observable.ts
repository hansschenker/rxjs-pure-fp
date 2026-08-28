import { errorContext } from './error-context.ts';
import {
  createSafeSubscriber,
  type PartialObserver,
  type Subscriber,
} from './sink.ts';
import { isSubscription, type Subscription, type TeardownLogic } from './subscription.ts';

export type Observable<T> = (subscriber: Subscriber<T>) => TeardownLogic;

export type ObservableInitializer<T> = (
  this: Observable<T>,
  subscriber: Subscriber<T>
) => TeardownLogic;

export type Subscribe = {
  <T>(observer?: PartialObserver<T> | Subscriber<T> | ((value: T) => void) | null): (source: Observable<T>) => Subscription;
  <T>(
    next?: ((value: T) => void) | null,
    error?: ((error: unknown) => void) | null,
    complete?: (() => void) | null
  ): (source: Observable<T>) => Subscription;
};

export type ObservableFactory = {
  <T>(initializer?: ObservableInitializer<T>): Observable<T>;
  create<T>(initializer?: ObservableInitializer<T>): Observable<T>;
};

/**
 * Creates a lazy Observable execution function.
 *
 * Construction stores no execution state. Invoking the returned function is the
 * execution boundary used by `subscribe`. The initializer receives the returned
 * Observable function as `this`, preserving the useful part of RxJS constructor
 * initializer semantics without creating an object instance or prototype.
 */
export const createObservable = <T>(initializer?: ObservableInitializer<T>): Observable<T> => {
  const run = initializer ?? (() => undefined);
  let observable!: Observable<T>;

  observable = ((subscriber: Subscriber<T>) =>
    Reflect.apply(run, observable, [subscriber]) as TeardownLogic) as Observable<T>;

  return observable;
};

const observableFactory = <T>(initializer?: ObservableInitializer<T>): Observable<T> =>
  createObservable(initializer);

/**
 * RxJS 7.8.2 root-parity name. It is intentionally a non-constructible
 * functional factory. The deprecated static `create` capability is retained as
 * a function property.
 */
export const Observable = Object.assign(observableFactory, {
  create: <T>(initializer?: ObservableInitializer<T>): Observable<T> => createObservable(initializer),
}) as ObservableFactory;

export const subscribe: Subscribe = (<T>(
  observerOrNext?: PartialObserver<T> | Subscriber<T> | ((value: T) => void) | null,
  error?: ((error: unknown) => void) | null,
  complete?: (() => void) | null
) => {
  return (source: Observable<T>): Subscription => {
    const subscriber = isSubscriber(observerOrNext)
      ? observerOrNext
      : createSafeSubscriber(observerOrNext, error, complete);

    errorContext(() => {
      subscriber.add(tryExecute(source, subscriber));
    });

    return subscriber;
  };
}) as Subscribe;

const tryExecute = <T>(source: Observable<T>, subscriber: Subscriber<T>): TeardownLogic => {
  try {
    return source(subscriber);
  } catch (error) {
    subscriber.error(error);
    return undefined;
  }
};

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
