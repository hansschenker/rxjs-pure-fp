import {
  createSubscriber as createKernelSubscriber,
  type Observer,
  type PartialObserver,
  type Subscriber as SubscriberRecord,
} from '../kernel/sink.ts';
import { config, configEnv } from './config.ts';
import { captureError } from './error-context.ts';

/**
 * RxJS 7.8.2 parity constructor: a kernel Subscriber bound to the live
 * config-backed environment (F6).
 */
export const createSubscriber = <T>(
  destination?: Observer<T> | SubscriberRecord<T>
): SubscriberRecord<T> => createKernelSubscriber(destination, configEnv);

export type SubscriberFactory = {
  <T>(destination?: Observer<T> | SubscriberRecord<T>): SubscriberRecord<T>;
  readonly create: <T>(
    next?: ((value: T) => void) | null,
    error?: ((error: unknown) => void) | null,
    complete?: (() => void) | null
  ) => SubscriberRecord<T>;
};

/**
 * RxJS 7.8.2 safe consumer boundary: partial observers, callback overloads,
 * unhandled-error policy, and the deprecated next-context all live here, on
 * top of the kernel Subscriber machine.
 */
export const createSafeSubscriber = <T>(
  observerOrNext?: PartialObserver<T> | ((value: T) => void) | null,
  error?: ((error: unknown) => void) | null,
  complete?: (() => void) | null
): SubscriberRecord<T> => {
  let partialObserver: PartialObserver<T>;
  let subscriber!: SubscriberRecord<T>;

  // Subjects are callable observer records in this representation, so a bare
  // function only counts as a next-callback when it carries no observer shape.
  const callbackOnly =
    typeof observerOrNext === 'function' &&
    typeof (observerOrNext as PartialObserver<T>).next !== 'function' &&
    typeof (observerOrNext as PartialObserver<T>).error !== 'function' &&
    typeof (observerOrNext as PartialObserver<T>).complete !== 'function';
  if (callbackOnly || !observerOrNext) {
    partialObserver = {
      next: (observerOrNext as ((value: T) => void) | null | undefined) ?? undefined,
      error: error ?? undefined,
      complete: complete ?? undefined,
    };
  } else if (config.useDeprecatedNextContext) {
    const observerRecord = observerOrNext as PartialObserver<T>;
    const context = Object.create(observerRecord) as PartialObserver<T> & { unsubscribe(): void };
    context.unsubscribe = () => subscriber.unsubscribe();
    partialObserver = {
      next: observerRecord.next ? bindFunction(observerRecord.next, context) : undefined,
      error: observerRecord.error ? bindFunction(observerRecord.error, context) : undefined,
      complete: observerRecord.complete ? bindFunction(observerRecord.complete, context) : undefined,
    };
  } else {
    partialObserver = observerOrNext as PartialObserver<T>;
  }

  subscriber = createSubscriber(createConsumerObserver(partialObserver));
  return subscriber;
};

const subscriberFactory = <T>(destination?: Observer<T> | SubscriberRecord<T>): SubscriberRecord<T> =>
  createSubscriber(destination);

/**
 * Root-export parity name for RxJS 7.8.2. It is intentionally a function, not
 * a constructible class. Prefer `createSubscriber` in the functional API.
 */
export const Subscriber = Object.assign(subscriberFactory, {
  create: <T>(
    next?: ((value: T) => void) | null,
    error?: ((error: unknown) => void) | null,
    complete?: (() => void) | null
  ): SubscriberRecord<T> => createSafeSubscriber(next, error, complete),
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
  configEnv.defer(() => {
    const { onUnhandledError } = configEnv;
    if (onUnhandledError) {
      onUnhandledError(error);
    } else {
      throw error;
    }
  });
};

const bindFunction = <TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  thisArg: object
): ((...args: TArgs) => void) =>
  (...args) => {
    Reflect.apply(fn, thisArg, args);
  };
