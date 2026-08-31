import { COMPLETE_NOTIFICATION, errorNotification, nextNotification, type ObservableNotification } from './notification.ts';
import { defaultEnv, type RuntimeEnv } from './runtime.ts';
import { createLifecycleState, isSubscription } from './subscription.ts';
import type { Subscription } from './subscription.ts';

const envSymbol = Symbol('rxjs-pure-fp.subscriber.env');

export type Observer<T> = {
  readonly next: (value: T) => void;
  readonly error: (error: unknown) => void;
  readonly complete: () => void;
};

export type PartialObserver<T> = {
  readonly next?: ((value: T) => void) | undefined;
  readonly error?: ((error: unknown) => void) | undefined;
  readonly complete?: (() => void) | undefined;
};

export type Sink<T> = Observer<T>;

export type Subscriber<T> = Subscription & Observer<T> & {
  readonly isStopped: boolean;
};

type SubscriberHooks = {
  onFinalize?: (() => void) | undefined;
  env?: RuntimeEnv | undefined;
};

export const EMPTY_OBSERVER: Readonly<Observer<unknown>> & { readonly closed: true } = Object.freeze({
  closed: true,
  next() {},
  error(error: unknown) {
    throw error;
  },
  complete() {},
});

/**
 * Public kernel constructor: no lifecycle hooks, explicit runtime environment
 * (F6). Without an env the subscriber falls back to the destination's env and
 * then to the silent `defaultEnv`; the config-backed parity constructor is
 * compat surface (`src/compat/sink.ts`).
 */
export const createSubscriber = <T>(
  destination?: Observer<T> | Subscriber<T>,
  env?: RuntimeEnv
): Subscriber<T> => createSubscriberWithHooks(destination, { env });

/** Reads the runtime environment a subscriber record carries, if any. */
export const subscriberEnv = (value: unknown): RuntimeEnv | undefined =>
  typeof value === 'object' && value !== null
    ? (value as { [envSymbol]?: RuntimeEnv })[envSymbol]
    : undefined;

/**
 * Internal composition point used by operator machinery that needs behavior
 * after the Subscriber lifecycle has successfully finalized.
 *
 * F4: the Subscriber is a frozen record composed around the shared lifecycle
 * closure state — no in-place enrichment. The record itself is registered as
 * the lifecycle identity so parentage bookkeeping sees the Subscriber.
 */
export const createSubscriberWithHooks = <T>(
  destination?: Observer<T> | Subscriber<T>,
  hooks: SubscriberHooks = {}
): Subscriber<T> => {
  const env = hooks.env ?? subscriberEnv(destination) ?? defaultEnv;
  const lifecycle = createLifecycleState();
  let isStopped = false;
  let currentDestination: Observer<T> | null = destination ?? (EMPTY_OBSERVER as Observer<T>);
  let subscriber!: Subscriber<T>;

  const unsubscribe = (): void => {
    if (!lifecycle.isClosed()) {
      isStopped = true;
      lifecycle.unsubscribe();
      currentDestination = null;
      hooks.onFinalize?.();
    }
  };

  const next = (value: T): void => {
    if (isStopped) {
      handleStoppedNotification(env, nextNotification(value), subscriber);
    } else {
      currentDestination?.next(value);
    }
  };

  const error = (errorValue: unknown): void => {
    if (isStopped) {
      handleStoppedNotification(env, errorNotification(errorValue), subscriber);
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
      handleStoppedNotification(env, COMPLETE_NOTIFICATION, subscriber);
      return;
    }

    isStopped = true;
    try {
      currentDestination?.complete();
    } finally {
      unsubscribe();
    }
  };

  subscriber = Object.freeze({
    get closed() {
      return lifecycle.isClosed();
    },
    get isStopped() {
      return isStopped;
    },
    add: lifecycle.add,
    remove: lifecycle.remove,
    unsubscribe,
    next,
    error,
    complete,
    [envSymbol]: env,
    ...lifecycle.protocol,
  }) as Subscriber<T>;
  lifecycle.setSelf(subscriber);

  if (destination && isSubscription(destination)) {
    destination.add(subscriber);
  }

  return subscriber;
};

const handleStoppedNotification = <T>(
  env: RuntimeEnv,
  notification: ObservableNotification<T>,
  subscriber: Subscriber<T>
): void => {
  const { onStoppedNotification } = env;
  if (onStoppedNotification) {
    env.defer(() => onStoppedNotification(notification, subscriber as Subscriber<unknown>));
  }
};
