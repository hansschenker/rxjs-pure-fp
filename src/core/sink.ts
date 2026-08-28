import { config } from './config.ts';
import { captureError } from './error-context.ts';
import { COMPLETE_NOTIFICATION, errorNotification, nextNotification, type ObservableNotification } from './notification.ts';
import { createSubscription, isSubscription, type Subscription } from './subscription.ts';

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

type SubscriberHooks = {
  onFinalize?: (() => void) | undefined;
};

export const EMPTY_OBSERVER: Readonly<Observer<unknown>> & { readonly closed: true } = {
  closed: true,
  next() {},
  error(error) {
    throw error;
  },
  complete() {},
};

/** Public M02 constructor: no lifecycle hooks. */
export const createSubscriber = <T>(destination?: Observer<T> | Subscriber<T>): Subscriber<T> =>
  createSubscriberWithHooks(destination);

/**
 * Internal composition point used by operator machinery that needs behavior
 * after the Subscriber lifecycle has successfully finalized.
 */
export const createSubscriberWithHooks = <T>(
  destination?: Observer<T> | Subscriber<T>,
  hooks: SubscriberHooks = {}
): Subscriber<T> => {
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
      hooks.onFinalize?.();
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
): ((...args: TArgs) => void) =>
  (...args) => {
    Reflect.apply(fn, thisArg, args);
  };
