import { createObservable, executeSource, type Observable } from '../observable.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';
import {
  createSubscriberWithHooks,
  subscriberEnv,
  type Observer,
  type Subscriber,
} from '../sink.ts';
import { createSubject, type Subject } from '../subject.ts';
import type { TeardownLogic } from '../subscription.ts';

/** RxJS `GroupedObservable`: a per-key stream carrying its grouping key. */
export type GroupedObservable<K, T> = Observable<T> & { readonly key: K };

export type GroupByOptions<T, K, E> = {
  /** Maps each source value to the element delivered to its group. */
  readonly element?: ((value: T) => E) | undefined;
  /**
   * Per-group lifetime notifier: its first emission (or completion) completes
   * the group; a later source value under the same key opens a fresh group.
   * M15 scope: must return a functional Observable.
   */
  readonly duration?: ((grouped: GroupedObservable<K, E>) => Observable<unknown>) | undefined;
  /** Replaces the default per-group `Subject` (e.g. with a replaying one). */
  readonly connector?: (() => Subject<E>) | undefined;
};

/** A consumer a terminal signal fans out to: every group first, then the result. */
type Terminal = {
  readonly complete: () => void;
  readonly error: (error: unknown) => void;
};

const runTeardown = (teardown: TeardownLogic): void => {
  if (typeof teardown === 'function') {
    teardown();
  } else {
    teardown?.unsubscribe();
  }
};

/**
 * Demultiplexes the source into Subject-backed groups keyed by
 * `keySelector` (M10 prerequisite). Termination fans out to every group
 * before the result. Downstream unsubscription is reference-counted RxJS
 * behavior: while any group still has a subscriber the source stays
 * subscribed feeding it, and the last group teardown releases the source
 * (the functional replacement for RxJS's `shouldUnsubscribe` guard). The
 * deprecated positional `element`/`duration`/`connector` arguments are
 * compat surface (`src/compat/collection.ts`).
 */
export function groupBy<T, K>(
  keySelector: (value: T) => K,
  options?: GroupByOptions<T, K, T> & { readonly element?: undefined }
): OperatorFunction<T, GroupedObservable<K, T>>;
export function groupBy<T, K, E>(
  keySelector: (value: T) => K,
  options: GroupByOptions<T, K, E> & { readonly element: (value: T) => E }
): OperatorFunction<T, GroupedObservable<K, E>>;
export function groupBy<T, K, E>(
  keySelector: (value: T) => K,
  options: GroupByOptions<T, K, E> = {}
): OperatorFunction<T, GroupedObservable<K, E>> {
  const { element, duration, connector } = options;
  return operate((source, destination) => {
    const groups = new Map<K, Subject<E>>();
    let activeGroups = 0;
    let teardownAttempted = false;

    const notify = (signal: (consumer: Terminal) => void): void => {
      groups.forEach(signal);
      signal(destination);
    };
    const handleError = (error: unknown): void => notify((consumer) => consumer.error(error));

    const sourceSubscriber: Subscriber<T> = createOperatorSubscriber<T, GroupedObservable<K, E>>(
      destination,
      (value) => {
        // The whole admission is guarded so a throwing selector/element/
        // connector errors every group, not just the result (RxJS fan-out).
        try {
          const key = keySelector(value);
          let group = groups.get(key);
          if (!group) {
            group = connector ? connector() : createSubject<E>();
            groups.set(key, group);
            const grouped = createGrouped(key, group);
            destination.next(grouped);
            if (duration) {
              startDuration(key, group, duration(grouped));
            }
          }
          group.next(element ? element(value) : (value as unknown as E));
        } catch (error) {
          handleError(error);
        }
      },
      () => notify((consumer) => consumer.complete()),
      handleError,
      () => groups.clear()
    );

    const startDuration = (key: K, group: Subject<E>, notifier: Observable<unknown>): void => {
      let durationSubscriber: Subscriber<unknown> | null = null;
      // The duration notifier's destination is the group itself (RxJS): its
      // error/completion terminates just that group, and a first emission
      // completes the group and retires the notifier subscription.
      const observer: Observer<unknown> = {
        next: () => {
          try {
            group.complete();
            durationSubscriber?.unsubscribe();
          } catch (error) {
            group.error(error);
          }
        },
        error: (error) => group.error(error),
        complete: () => group.complete(),
      };
      durationSubscriber = createSubscriberWithHooks(observer, {
        env: subscriberEnv(destination),
        onFinalize: () => groups.delete(key),
      });
      sourceSubscriber.add(durationSubscriber);
      executeSource(notifier, durationSubscriber);
    };

    const createGrouped = (key: K, group: Subject<E>): GroupedObservable<K, E> => {
      const grouped = createObservable<E>((groupSubscriber) => {
        activeGroups += 1;
        const innerTeardown = group(groupSubscriber);
        return () => {
          runTeardown(innerTeardown);
          activeGroups -= 1;
          if (activeGroups === 0 && teardownAttempted) {
            sourceSubscriber.unsubscribe();
          }
        };
      });
      (grouped as Observable<E> & { key: K }).key = key;
      return grouped as GroupedObservable<K, E>;
    };

    // Reference-counted release: the operator subscriber leaves the
    // destination's direct ownership, and this guard decides at downstream
    // teardown whether the source can already be released.
    destination.remove(sourceSubscriber);
    destination.add(() => {
      teardownAttempted = true;
      if (activeGroups === 0) {
        sourceSubscriber.unsubscribe();
      }
    });

    subscribeOperator(source, sourceSubscriber);
    return undefined;
  });
}
