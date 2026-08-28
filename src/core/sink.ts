import { config } from './config.js';
import { captureError } from './error-context.js';
import { COMPLETE_NOTIFICATION, errorNotification, nextNotification, type ObservableNotification } from './notification.js';
import { createSubscription, isSubscription, type Subscription } from './subscription.js';

export type Observer<T> = {
  next(value: T): void;
  error(error: unknown): void;
  complete(): void;
};

export type PartialObserver<T> = {
  next?: ((value: T) => void) | undefined;
  error?: ((error: unknown) => void) | undefined;
  complete?: (() => void) | undefined;
};

export type Sink<T> = Observer<T>;

export type Subscriber<T> = Subscription & Observer<T> & {
  readonly isStopped: boolean;
};

export type SubscriberFactory = {
  <T>(destination?: Observer<T> | Subscriber<T>): Subscriber<T>;
  create<T>(
    next?: ((value: T) => void) | null,
    error?: ((error: unknown) => void) | null,
    complete?: (() => void) | null
  ): Subscriber<T>;
};

export const EMPTY_OBSERVER: Readonly<Observer<unknown>> & { readonly closed: true } = {
  closed: true,
  next() {},
  error(error) {
    throw error;
  },
  complete() {},
};

/**
 * Composes the M01 subscription lifecycle with the Observer protocol.
 * Stop-state and destination state are lexical; the returned value is the same
 * structural subscription record, enriched with notification functions.
 */
export const createSubscriber = <T>(destination?: Observer<T> | Subscriber<T>): Subscriber<T> => {
  const lifecycle = createSubscription();
  const unsubscribeLifecycle = lifecycle.unsubscribe;
  let isStopped = false;
  let currentDestination: Observer<T> | null = destination ?? (EMPTY_OBSERVER as Observer<T>);
  let subscriber!: Subscriber<T>;

  const unsubscribe = (): void => {
    if (!lifecycle.closed) {
      isStopped = true;
      unsubscribeLifecycle();
      currentDestination = null;
    }
  };

  const next = (value: T): void => {
    if (isStopped) {
      handleStoppedNotification(nextNotification(value), subscriber);
    } else {
      currentDestination?.next(value);
    }
  };

  const error = (errorValue: unknown): void => {
    if (isStopped) {
      handleStoppedNotification(errorNotification(errorValue), subscriber);
      return;
    }

    isStopped = true;
    try {
      currentDestination?.error(errorValue);
    } finally {
      unsubscribe();
    }
  };

  const complete = (): void => {
    if (isStopped) {
      handleStoppedNotification(COMPLETE_NOTIFICATION, subscriber);
      return;
    }

    isStopped = true;
    try {
      currentDestination?.complete();
    } finally {
      unsubscribe();
    }
  };

  subscriber = Object.defineProperties(lifecycle, {
    isStopped: {
      enumerable: true,
      configurable: false,
      get: () => isStopped,
    },
    unsubscribe: {
      enumerable: true,
      configurable: true,
      writable: true,
      value: unsubscribe,
    },
    next: {
      enumerable: true,
      configurable: true,
      writable: true,
      value: next,
    },
    error: {
      enumerable: true,
      configurable: true,
      writable: true,
      value: error,
    },
    complete: {
      enumerable: true,
      configurable: true,
      writable: true,
      value: complete,
    },
  }) as Subscriber<T>;

  if (destination && isSubscription(destination)) {
    destination.add(subscriber);
  }

  return subscriber;
};

/**
 * Adapts callback-style or partial-observer consumers into a guarded subscriber.
 * User-handler failures are reported out of band, matching RxJS SafeSubscriber.
 */
export const createSafeSubscriber = <T>(
  observerOrNext?: PartialObserver<T> | ((value: T) => void) | null,
  error?: ((error: unknown) => void) | null,
  complete?: (() => void) | null
): Subscriber<T> => {
  let partialObserver: PartialObserver<T>;
  let subscriber!: Subscriber<T>;

  if (typeof observerOrNext === 'function' || !observerOrNext) {
    partialObserver = {
      next: observerOrNext ?? undefined,
      error: error ?? undefined,
      complete: complete ?? undefined,
    };
  } else if (config.useDeprecatedNextContext) {
    const context = Object.create(observerOrNext) as PartialObserver<T> & { unsubscribe(): void };
    context.unsubscribe = () => subscriber.unsubscribe();
    partialObserver = {
      next: observerOrNext.next ? bindFunction(observerOrNext.next, context) : undefined,
      error: observerOrNext.error ? bindFunction(observerOrNext.error, context) : undefined,
      complete: observerOrNext.complete ? bindFunction(observerOrNext.complete, context) : undefined,
    };
  } else {
    partialObserver = observerOrNext;
  }

  subscriber = createSubscriber(createConsumerObserver(partialObserver));
  return subscriber;
};

const subscriberFactory = <T>(destination?: Observer<T> | Subscriber<T>): Subscriber<T> => createSubscriber(destination);

/**
 * RxJS 7.8.2 root-parity name. This remains an ordinary function rather than
 * a constructible class. Its deprecated `.create` helper is retained as a
 * function property and delegates to the safe-consumer adapter.
 */
export const Subscriber = Object.assign(subscriberFactory, {
  create: <T>(
    next?: ((value: T) => void) | null,
    error?: ((error: unknown) => void) | null,
    complete?: (() => void) | null
  ): Subscriber<T> => createSafeSubscriber(next, error, complete),
}) as SubscriberFactory;

const createConsumerObserver = <T>(partialObserver: PartialObserver<T>): Observer<T> => ({
  next(value) {
    if (partialObserver.next) {
      try {
        partialObserver.next(value);
      } catch (error) {
        handleUnhandledError(error);
      }
    }
  },
  error(errorValue) {
    if (partialObserver.error) {
      try {
        partialObserver.error(errorValue);
      } catch (error) {
        handleUnhandledError(error);
      }
    } else {
      handleUnhandledError(errorValue);
    }
  },
  complete() {
    if (partialObserver.complete) {
      try {
        partialObserver.complete();
      } catch (error) {
        handleUnhandledError(error);
      }
    }
  },
});

const handleUnhandledError = (error: unknown): void => {
  if (config.useDeprecatedSynchronousErrorHandling) {
    captureError(error);
  } else {
    reportUnhandledError(error);
  }
};

const reportUnhandledError = (error: unknown): void => {
  globalThis.setTimeout(() => {
    const { onUnhandledError } = config;
    if (onUnhandledError) {
      onUnhandledError(error);
    } else {
      throw error;
    }
  });
};

const handleStoppedNotification = <T>(notification: ObservableNotification<T>, subscriber: Subscriber<T>): void => {
  const { onStoppedNotification } = config;
  if (onStoppedNotification) {
    globalThis.setTimeout(() => onStoppedNotification(notification, subscriber as Subscriber<unknown>));
  }
};

const bindFunction = <TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  thisArg: object
): ((...args: TArgs) => void) => Function.prototype.bind.call(fn, thisArg) as (...args: TArgs) => void;
