import { createObjectUnsubscribedError } from './errors.ts';
import { createObservable, setSubscribePreflight, type Observable } from './observable.ts';
import { dateTimestampProvider, type TimestampProvider } from './scheduler.ts';
import type { Observer, PartialObserver, Subscriber } from './sink.ts';
import { EMPTY_SUBSCRIPTION, createSubscription, type TeardownLogic } from './subscription.ts';

/**
 * M10: multicast as one hub plus state policies — no inheritance. A Subject is
 * a branded callable hub function (it IS an Observable) carrying observer
 * methods and live state fields. Subjects are the documented mutable sharing
 * topology: state fields are plain data properties updated at transition
 * points, so the record is intentionally not frozen.
 */
export type Subject<T> = Observable<T> & {
  readonly closed: boolean;
  readonly isStopped: boolean;
  readonly hasError: boolean;
  readonly thrownError: unknown;
  readonly observed: boolean;
  readonly next: (value: T) => void;
  readonly error: (error: unknown) => void;
  readonly complete: () => void;
  readonly unsubscribe: () => void;
  readonly asObservable: () => Observable<T>;
};

export type BehaviorSubject<T> = Subject<T> & {
  readonly value: T;
  readonly getValue: () => T;
};

type MutableSubject<T> = Observable<T> & {
  closed: boolean;
  isStopped: boolean;
  hasError: boolean;
  thrownError: unknown;
  observed: boolean;
  next: (value: T) => void;
  error: (error: unknown) => void;
  complete: () => void;
  unsubscribe: () => void;
  asObservable: () => Observable<T>;
};

/** Hub operations handed to subject policies. */
type SubjectHub<T> = {
  readonly throwIfClosed: () => void;
  readonly isSettled: () => boolean;
  readonly isStopped: () => boolean;
  readonly hasError: () => boolean;
  readonly thrownError: () => unknown;
  readonly broadcast: (value: T) => void;
  readonly terminate: () => void;
  readonly register: (subscriber: Subscriber<T>) => TeardownLogic;
  readonly deliverFinalized: (subscriber: Subscriber<T>) => void;
};

type SubjectPolicy<T> = {
  readonly next?: (value: T, hub: SubjectHub<T>) => void;
  readonly error?: (error: unknown, hub: SubjectHub<T>) => void;
  readonly complete?: (hub: SubjectHub<T>) => void;
  readonly subscribeSelf?: (subscriber: Subscriber<T>, hub: SubjectHub<T>) => TeardownLogic;
  readonly deliverFinalized?: (subscriber: Subscriber<T>, hub: SubjectHub<T>) => void;
};

const buildSubject = <T>(policy: SubjectPolicy<T>): MutableSubject<T> => {
  let observers: Array<Observer<T>> = [];
  let currentObservers: Array<Observer<T>> | null = null;
  let subject!: MutableSubject<T>;

  const throwIfClosed = (): void => {
    if (subject.closed) {
      throw createObjectUnsubscribedError();
    }
  };

  // Broadcast iterates a lazily rebuilt snapshot: observers registered during
  // an emission miss that emission; observers removed during it are already
  // stopped, so their delivery is a no-op (RxJS reentrancy semantics).
  const broadcast = (value: T): void => {
    throwIfClosed();
    if (!subject.isStopped) {
      currentObservers ??= observers.slice();
      for (const observer of currentObservers) {
        observer.next(value);
      }
    }
  };

  const errorBase = (error: unknown): void => {
    throwIfClosed();
    if (!subject.isStopped) {
      subject.hasError = true;
      subject.isStopped = true;
      subject.thrownError = error;
      while (observers.length > 0) {
        (observers.shift() as Observer<T>).error(error);
      }
      subject.observed = false;
    }
  };

  const terminate = (): void => {
    throwIfClosed();
    if (!subject.isStopped) {
      subject.isStopped = true;
      while (observers.length > 0) {
        (observers.shift() as Observer<T>).complete();
      }
      subject.observed = false;
    }
  };

  const register = (subscriber: Subscriber<T>): TeardownLogic => {
    if (subject.hasError || subject.isStopped) {
      return EMPTY_SUBSCRIPTION;
    }
    currentObservers = null;
    observers.push(subscriber);
    subject.observed = true;
    return createSubscription(() => {
      currentObservers = null;
      const at = observers.indexOf(subscriber);
      if (at >= 0) {
        observers.splice(at, 1);
      }
      subject.observed = observers.length > 0;
    });
  };

  const deliverFinalized = (subscriber: Subscriber<T>): void => {
    if (policy.deliverFinalized) {
      policy.deliverFinalized(subscriber, hub);
    } else if (subject.hasError) {
      subscriber.error(subject.thrownError);
    } else if (subject.isStopped) {
      subscriber.complete();
    }
  };

  const hub: SubjectHub<T> = {
    throwIfClosed,
    isSettled: () => subject.hasError || subject.isStopped,
    isStopped: () => subject.isStopped,
    hasError: () => subject.hasError,
    thrownError: () => subject.thrownError,
    broadcast,
    terminate,
    register,
    deliverFinalized: (subscriber) => deliverFinalized(subscriber),
  };

  const subscribeSelf = (subscriber: Subscriber<T>): TeardownLogic => {
    if (policy.subscribeSelf) {
      return policy.subscribeSelf(subscriber, hub);
    }
    throwIfClosed();
    deliverFinalized(subscriber);
    return register(subscriber);
  };

  subject = createObservable<T>((subscriber) => subscribeSelf(subscriber)) as MutableSubject<T>;
  setSubscribePreflight(subject, throwIfClosed);
  subject.closed = false;
  subject.isStopped = false;
  subject.hasError = false;
  subject.thrownError = null;
  subject.observed = false;
  subject.next = (value) => (policy.next ? policy.next(value, hub) : broadcast(value));
  subject.error = (error) => (policy.error ? policy.error(error, hub) : errorBase(error));
  subject.complete = () => (policy.complete ? policy.complete(hub) : terminate());
  subject.unsubscribe = () => {
    subject.isStopped = true;
    subject.closed = true;
    subject.observed = false;
    observers = [];
    currentObservers = null;
  };
  subject.asObservable = () => createObservable((subscriber) => subject(subscriber));
  return subject;
};

export const createSubject = <T>(): Subject<T> => buildSubject<T>({});

/** Hub + current-value policy. `value` is a live snapshot field; `getValue()` carries the throwing contract. */
export const createBehaviorSubject = <T>(initialValue: T): BehaviorSubject<T> => {
  let current = initialValue;
  let record!: MutableSubject<T> & { value: T; getValue: () => T };
  const subject = buildSubject<T>({
    next: (value, hub) => {
      current = value;
      record.value = value;
      hub.broadcast(value);
    },
    subscribeSelf: (subscriber, hub) => {
      hub.throwIfClosed();
      hub.deliverFinalized(subscriber);
      const teardown = hub.register(subscriber);
      if (!hub.isSettled()) {
        subscriber.next(current);
      }
      return teardown;
    },
  });
  record = subject as MutableSubject<T> & { value: T; getValue: () => T };
  record.value = initialValue;
  record.getValue = () => {
    if (subject.hasError) {
      throw subject.thrownError;
    }
    if (subject.closed) {
      throw createObjectUnsubscribedError();
    }
    return current;
  };
  return record as BehaviorSubject<T>;
};

/**
 * Hub + replay-buffer policy: a size window and, since M18, RxJS's time
 * window over a timestamp provider. A finite window interleaves each value
 * with its expiry (`[value, expiry, value, expiry, ...]`) exactly as RxJS's
 * flat buffer does, and trimming runs on every `next` and every subscribe.
 */
export const createReplaySubject = <T>(
  bufferSize = Infinity,
  windowTime = Infinity,
  timestampProvider: TimestampProvider = dateTimestampProvider
): Subject<T> => {
  const infiniteTimeWindow = windowTime === Infinity;
  const max = Math.max(1, bufferSize);
  const window = Math.max(1, windowTime);
  const buffer: Array<T | number> = [];
  const stride = infiniteTimeWindow ? 1 : 2;

  const trimBuffer = (): void => {
    const adjustedBufferSize = stride * max;
    if (max < Infinity && adjustedBufferSize < buffer.length) {
      buffer.splice(0, buffer.length - adjustedBufferSize);
    }
    if (!infiniteTimeWindow) {
      const now = timestampProvider.now();
      let last = 0;
      for (let index = 1; index < buffer.length && (buffer[index] as number) <= now; index += 2) {
        last = index;
      }
      if (last) {
        buffer.splice(0, last + 1);
      }
    }
  };

  return buildSubject<T>({
    next: (value, hub) => {
      if (!hub.isStopped()) {
        buffer.push(value);
        if (!infiniteTimeWindow) {
          buffer.push(timestampProvider.now() + window);
        }
      }
      trimBuffer();
      hub.broadcast(value);
    },
    subscribeSelf: (subscriber, hub) => {
      hub.throwIfClosed();
      trimBuffer();
      const teardown = hub.register(subscriber);
      const copy = buffer.slice();
      for (let index = 0; index < copy.length && !subscriber.closed; index += stride) {
        subscriber.next(copy[index] as T);
      }
      hub.deliverFinalized(subscriber);
      return teardown;
    },
  });
};

/** Hub + last-on-complete policy. */
export const createAsyncSubject = <T>(): Subject<T> => {
  let hasValue = false;
  let isComplete = false;
  let lastValue!: T;
  return buildSubject<T>({
    next: (value, hub) => {
      if (!hub.isStopped()) {
        hasValue = true;
        lastValue = value;
      }
    },
    complete: (hub) => {
      if (!isComplete) {
        isComplete = true;
        if (hasValue) {
          hub.broadcast(lastValue);
        }
        hub.terminate();
      }
    },
    deliverFinalized: (subscriber, hub) => {
      if (hub.hasError()) {
        subscriber.error(hub.thrownError());
      } else if (hub.isStopped() || isComplete) {
        if (hasValue) {
          subscriber.next(lastValue);
        }
        subscriber.complete();
      }
    },
  });
};

/** Deprecated `Subject.create` shape: observer side delegates to `destination`, observable side to `source`. */
export const createAnonymousSubject = <T>(
  destination?: PartialObserver<T>,
  source?: Observable<T>
): Subject<T> =>
  buildSubject<T>({
    next: (value) => destination?.next?.(value),
    error: (error) => destination?.error?.(error),
    complete: () => destination?.complete?.(),
    subscribeSelf: (subscriber) => (source ? source(subscriber) : EMPTY_SUBSCRIPTION),
  });
