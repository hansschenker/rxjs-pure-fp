import type { ObservableInput } from '../kernel/interop.ts';
import type { Observable } from '../kernel/observable.ts';
import type { OperatorFunction } from '../kernel/operator.ts';
import { partition as partitionKernel } from '../kernel/creation/partition.ts';
import { every as everyKernel } from '../kernel/operators/every.ts';
import {
  groupBy as groupByKernel,
  type GroupByOptions,
  type GroupedObservable,
} from '../kernel/operators/group-by.ts';
import { find as findKernel, findIndex as findIndexKernel } from '../kernel/operators/find.ts';
import type { Subject as SubjectLike } from '../kernel/subject.ts';

/**
 * RxJS 7.8.2 parity surface for the M15 collection queries: retains the
 * deprecated `thisArg` binding by wrapping the predicate before delegating to
 * the pure kernel operators.
 */
export function every<T, A = undefined>(
  predicate: (this: A, value: T, index: number, source: Observable<T>) => boolean,
  thisArg?: A
): OperatorFunction<T, boolean> {
  return everyKernel<T>((value, index, source) =>
    Reflect.apply(predicate, thisArg, [value, index, source])
  );
}

export function find<T, S extends T>(
  predicate: (value: T, index: number, source: Observable<T>) => value is S
): OperatorFunction<T, S | undefined>;
export function find<T, A = undefined>(
  predicate: (this: A, value: T, index: number, source: Observable<T>) => boolean,
  thisArg?: A
): OperatorFunction<T, T | undefined>;
export function find<T, A = undefined>(
  predicate: (this: A, value: T, index: number, source: Observable<T>) => boolean,
  thisArg?: A
): OperatorFunction<T, T | undefined> {
  return findKernel<T>((value, index, source) =>
    Reflect.apply(predicate, thisArg, [value, index, source])
  );
}

export function findIndex<T, A = undefined>(
  predicate: (this: A, value: T, index: number, source: Observable<T>) => boolean,
  thisArg?: A
): OperatorFunction<T, number> {
  return findIndexKernel<T>((value, index, source) =>
    Reflect.apply(predicate, thisArg, [value, index, source])
  );
}

export function partition<T, A = undefined>(
  source: ObservableInput<T>,
  predicate: (this: A, value: T, index: number) => boolean,
  thisArg?: A
): [Observable<T>, Observable<T>] {
  return partitionKernel<T>(source, (value, index) =>
    Reflect.apply(predicate, thisArg, [value, index])
  );
}

/**
 * RxJS 7.8.2 parity surface for `groupBy`: accepts the modern options object
 * or the deprecated positional `element` / `duration` / `connector`
 * arguments, normalizing both onto the kernel options record.
 */
export function groupBy<T, K>(
  keySelector: (value: T) => K,
  options?: GroupByOptions<T, K, T> & { readonly element?: undefined }
): OperatorFunction<T, GroupedObservable<K, T>>;
export function groupBy<T, K, E>(
  keySelector: (value: T) => K,
  options: GroupByOptions<T, K, E> & { readonly element: (value: T) => E }
): OperatorFunction<T, GroupedObservable<K, E>>;
export function groupBy<T, K>(
  keySelector: (value: T) => K,
  element: undefined | void,
  duration: (grouped: GroupedObservable<K, T>) => ObservableInput<unknown>
): OperatorFunction<T, GroupedObservable<K, T>>;
export function groupBy<T, K, E>(
  keySelector: (value: T) => K,
  element?: (value: T) => E,
  duration?: (grouped: GroupedObservable<K, E>) => ObservableInput<unknown>,
  connector?: () => SubjectLike<E>
): OperatorFunction<T, GroupedObservable<K, E>>;
export function groupBy<T, K, E>(
  keySelector: (value: T) => K,
  elementOrOptions?: ((value: T) => E) | GroupByOptions<T, K, E> | void,
  duration?: (grouped: GroupedObservable<K, E>) => ObservableInput<unknown>,
  connector?: () => SubjectLike<E>
): OperatorFunction<T, GroupedObservable<K, E>> {
  const options: GroupByOptions<T, K, E> =
    !elementOrOptions || typeof elementOrOptions === 'function'
      ? { element: elementOrOptions ?? undefined, duration, connector }
      : elementOrOptions;
  return groupByKernel(
    keySelector,
    options as GroupByOptions<T, K, E> & { readonly element: (value: T) => E }
  );
}
