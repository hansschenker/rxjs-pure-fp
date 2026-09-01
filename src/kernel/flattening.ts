import { innerFrom, type ObservableInput } from './interop.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from './operator.ts';
import type { Subscriber } from './sink.ts';

/**
 * M07 higher-order kernel: one flattening machine, concurrency behavior as
 * data. The four canonical RxJS policies (M08's mergeMap/concatMap/
 * switchMap/exhaustMap) differ only in this record:
 *
 * - `concurrent` — how many inner executions may coexist;
 * - `overflow` — what an outer value does when the machine is at capacity:
 *   `enqueue` buffers it, `ignore` drops it, `switch` cancels the active
 *   inner and starts the new one;
 * - `settle` — when a finished inner releases its slot. `finalize` settles
 *   after the inner's teardown (merge/concat: previous inner tears down
 *   before the next queued inner subscribes and before downstream
 *   completion); `complete` settles inside the inner's complete handler
 *   (switch/exhaust: downstream completion precedes the inner's teardown).
 *   This asymmetry is observable RxJS 7.8.2 behavior, so it is policy data,
 *   not an implementation accident.
 *
 * Since M16, projected inners are any `ObservableInput`: the machine
 * converts them with `innerFrom` at the moment an inner starts.
 */
export type FlattenOverflow = 'enqueue' | 'ignore' | 'switch';

export type FlattenSettle = 'finalize' | 'complete';

export type FlatteningPolicy = {
  readonly concurrent: number;
  readonly overflow: FlattenOverflow;
  readonly settle: FlattenSettle;
};

/** merge family: overlap up to `concurrent`, queue the rest. */
export const overlapPolicy = (concurrent: number): FlatteningPolicy =>
  Object.freeze({ concurrent, overflow: 'enqueue', settle: 'finalize' });

/** concat family: one at a time, queue while busy. */
export const queuePolicy: FlatteningPolicy = overlapPolicy(1);

/** switch family: cancel the previous inner, keep the latest. */
export const latestPolicy: FlatteningPolicy = Object.freeze({
  concurrent: 1,
  overflow: 'switch',
  settle: 'complete',
});

/** exhaust family: ignore new outer values while busy. */
export const exhaustPolicy: FlatteningPolicy = Object.freeze({
  concurrent: 1,
  overflow: 'ignore',
  settle: 'complete',
});

/**
 * M08 machine hooks. `onInnerValue` observes every inner value before it is
 * emitted downstream (mergeScan's state update). `feedback` is the expand
 * mode: each projected value is emitted downstream before projection, and
 * inner values are routed back through outer admission instead of being
 * emitted directly.
 */
export type FlattenOptions<R> = {
  readonly onInnerValue?: ((value: R) => void) | undefined;
  readonly feedback?: boolean | undefined;
};

/**
 * Runs `project`ed inner Observables under `policy`. The outer index is
 * consumed only when a value is actually projected, so `ignore`d values never
 * advance it (RxJS exhaustMap semantics) while `enqueue`d values advance it
 * in arrival order when they leave the buffer.
 */
export const flattenWith = <T, R>(
  policy: FlatteningPolicy,
  project: (value: T, index: number) => ObservableInput<R>,
  options: FlattenOptions<R> = {}
): OperatorFunction<T, R> =>
  operate((source, destination) => {
    const { concurrent, overflow, settle } = policy;
    const { onInnerValue, feedback = false } = options;
    const activeInners: Subscriber<R>[] = [];
    const buffer: T[] = [];
    let outerComplete = false;
    let index = 0;

    const checkComplete = (): void => {
      if (outerComplete && buffer.length === 0 && activeInners.length === 0) {
        destination.complete();
      }
    };

    const settleInner = (inner: Subscriber<R>): void => {
      removeInner(activeInners, inner);
      while (buffer.length > 0 && activeInners.length < concurrent) {
        startInner(buffer.shift() as T);
      }
      checkComplete();
    };

    const startInner = (value: T): void => {
      if (feedback) {
        destination.next(value as unknown as R);
      }
      let completed = false;
      const inner: Subscriber<R> = createOperatorSubscriber<R, R>(
        destination,
        (innerValue) => {
          onInnerValue?.(innerValue);
          if (feedback) {
            outerNext(innerValue as unknown as T);
          } else {
            destination.next(innerValue);
          }
        },
        settle === 'complete'
          ? () => {
              settleInner(inner);
            }
          : () => {
              completed = true;
            },
        undefined,
        settle === 'finalize'
          ? () => {
              if (completed) {
                try {
                  settleInner(inner);
                } catch (error) {
                  destination.error(error);
                }
              }
            }
          : undefined
      );
      activeInners.push(inner);
      subscribeOperator(innerFrom(project(value, index++)), inner);
    };

    const outerNext = (value: T): void => {
      if (activeInners.length < concurrent) {
        startInner(value);
        return;
      }
      if (overflow === 'enqueue') {
        buffer.push(value);
      } else if (overflow === 'switch') {
        for (const inner of activeInners.splice(0, activeInners.length)) {
          inner.unsubscribe();
        }
        startInner(value);
      }
      // 'ignore': the value is dropped without consuming an index.
    };

    const outerSubscriber = createOperatorSubscriber<T, R>(destination, outerNext, () => {
      outerComplete = true;
      checkComplete();
    });

    return subscribeOperator(source, outerSubscriber);
  });

const removeInner = <R>(inners: Subscriber<R>[], inner: Subscriber<R>): void => {
  const at = inners.indexOf(inner);
  if (at >= 0) {
    inners.splice(at, 1);
  }
};
