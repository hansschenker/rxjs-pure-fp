import { createObservable, isBrandedObservable, type Observable } from './observable.ts';
import { defaultEnv, reportUnhandledError } from './runtime.ts';
import { subscriberEnv, type Subscriber } from './sink.ts';
import type { Unsubscribable } from './subscription.ts';

declare global {
  interface SymbolConstructor {
    readonly observable: symbol;
  }
}

/**
 * M16 interop point, RxJS 7.8.2 root-export parity name: `Symbol.observable`
 * when the host defines it, the `'@@observable'` ponyfill key otherwise —
 * computed once at module load, exactly like RxJS.
 */
export const observable: string | symbol = (() =>
  (typeof Symbol === 'function' && Symbol.observable) || '@@observable')();

/** The observer-accepting subscribe contract a `Symbol.observable` carrier returns. */
export type InteropSubscribable<T> = {
  readonly subscribe: (subscriber: Subscriber<T>) => Unsubscribable | void;
};

export type InteropObservable<T> = {
  readonly [Symbol.observable]: () => InteropSubscribable<T>;
};

export type ReadableStreamDefaultReaderLike<T> = {
  readonly read: () => PromiseLike<
    { readonly done: false; readonly value: T } | { readonly done: true; readonly value?: undefined }
  >;
  readonly releaseLock: () => void;
};

export type ReadableStreamLike<T> = {
  readonly getReader: () => ReadableStreamDefaultReaderLike<T>;
};

/**
 * Everything RxJS 7.8.2 accepts where a stream is expected. In this
 * representation a functional Observable is itself the first case; the other
 * cases are converted by `innerFrom`.
 */
export type ObservableInput<T> =
  | Observable<T>
  | InteropObservable<T>
  | AsyncIterable<T>
  | PromiseLike<T>
  | ArrayLike<T>
  | Iterable<T>
  | ReadableStreamLike<T>;

/** Extracts the emitted type from any `ObservableInput`. */
export type ObservedValueOf<O> = O extends ObservableInput<infer T> ? T : never;

/**
 * M16 conversion core, mirroring RxJS `innerFrom` case order (interop,
 * array-like, promise, async-iterable, iterable, readable-stream). The one
 * representational difference sits in the first case: RxJS checks
 * `instanceof Observable`, while here any function already is an Observable
 * (M04 reference identity), so functions are passed through unchanged — a
 * function carrying `Symbol.observable` is used as an Observable, not as an
 * interop carrier.
 */
export const innerFrom = <T>(input: ObservableInput<T>): Observable<T> => {
  if (typeof input === 'function') {
    return input as Observable<T>;
  }
  if (input != null) {
    if (isInteropObservable(input)) {
      return fromInteropObservable(input);
    }
    if (isArrayLike(input)) {
      return fromArrayLike(input);
    }
    if (isPromise(input)) {
      return fromPromise(input);
    }
    if (isAsyncIterable(input)) {
      return fromAsyncIterable(input);
    }
    if (isIterable(input)) {
      return fromIterable(input);
    }
    if (isReadableStreamLike(input)) {
      return fromReadableStreamLike(input);
    }
  }
  throw createInvalidObservableTypeError(input);
};

/**
 * RxJS 7.8.2 root-export parity name. RxJS answers `instanceof Observable`
 * (or a `lift`/`subscribe` duck check); the closest representational
 * equivalent is the construction brand — raw unbranded initializer functions
 * remain usable as Observables everywhere but are not recognized here, just
 * as a plain object with a `subscribe` method is not an RxJS Observable.
 */
export const isObservable = (value: unknown): value is Observable<unknown> =>
  isBrandedObservable(value);

const isInteropObservable = (input: object): input is InteropObservable<unknown> =>
  typeof (input as Record<PropertyKey, unknown>)[observable] === 'function';

const isArrayLike = (input: object): input is ArrayLike<unknown> =>
  typeof (input as ArrayLike<unknown>).length === 'number';

const isPromise = (input: object): input is PromiseLike<unknown> =>
  typeof (input as PromiseLike<unknown>).then === 'function';

const isAsyncIterable = (input: object): input is AsyncIterable<unknown> =>
  typeof Symbol.asyncIterator === 'symbol' &&
  typeof (input as Partial<AsyncIterable<unknown>>)[Symbol.asyncIterator] === 'function';

const isIterable = (input: object): input is Iterable<unknown> =>
  typeof (input as Partial<Iterable<unknown>>)[Symbol.iterator] === 'function';

const isReadableStreamLike = (input: object): input is ReadableStreamLike<unknown> =>
  typeof (input as Partial<ReadableStreamLike<unknown>>).getReader === 'function';

const fromInteropObservable = <T>(input: InteropObservable<T>): Observable<T> =>
  createObservable((subscriber) => {
    const interop = (input as Record<PropertyKey, () => InteropSubscribable<T>>)[observable]!();
    if (typeof interop.subscribe === 'function') {
      return interop.subscribe(subscriber);
    }
    throw new TypeError('Provided object does not correctly implement Symbol.observable');
  });

const fromArrayLike = <T>(array: ArrayLike<T>): Observable<T> =>
  createObservable((subscriber) => {
    for (let index = 0; index < array.length && !subscriber.closed; index += 1) {
      subscriber.next(array[index] as T);
    }
    subscriber.complete();
  });

const fromPromise = <T>(promise: PromiseLike<T>): Observable<T> =>
  createObservable((subscriber) => {
    const env = subscriberEnv(subscriber) ?? defaultEnv;
    promise
      .then(
        (value) => {
          if (!subscriber.closed) {
            subscriber.next(value);
            subscriber.complete();
          }
        },
        (error: unknown) => subscriber.error(error)
      )
      // A consumer crash inside next/complete lands here: report it through
      // the runtime environment instead of swallowing it in the promise chain.
      .then(null, (error: unknown) => reportUnhandledError(env, error));
  });

const fromIterable = <T>(iterable: Iterable<T>): Observable<T> =>
  createObservable((subscriber) => {
    for (const value of iterable) {
      subscriber.next(value);
      // Early return after a closing next: leaving the for..of loop invokes
      // the iterator's `return`, releasing generator finalizers (RxJS order).
      if (subscriber.closed) {
        return;
      }
    }
    subscriber.complete();
  });

const consumeAsyncIterable = async <T>(
  asyncIterable: AsyncIterable<T>,
  subscriber: Subscriber<T>
): Promise<void> => {
  for await (const value of asyncIterable) {
    subscriber.next(value);
    if (subscriber.closed) {
      return;
    }
  }
  subscriber.complete();
};

const fromAsyncIterable = <T>(asyncIterable: AsyncIterable<T>): Observable<T> =>
  createObservable((subscriber) => {
    consumeAsyncIterable(asyncIterable, subscriber).then(null, (error: unknown) =>
      subscriber.error(error)
    );
  });

const readableStreamToAsyncGenerator = async function* <T>(
  readableStream: ReadableStreamLike<T>
): AsyncGenerator<T> {
  const reader = readableStream.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        return;
      }
      yield value as T;
    }
  } finally {
    reader.releaseLock();
  }
};

const fromReadableStreamLike = <T>(readableStream: ReadableStreamLike<T>): Observable<T> =>
  fromAsyncIterable(readableStreamToAsyncGenerator(readableStream));

const createInvalidObservableTypeError = (input: unknown): TypeError =>
  new TypeError(
    `You provided ${
      input !== null && typeof input === 'object' ? 'an invalid object' : `'${String(input)}'`
    } where a stream was expected. You can provide an Observable, Promise, ReadableStream, Array, AsyncIterable, or Iterable.`
  );
