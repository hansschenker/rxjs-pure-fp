import { concat } from '../creation/concat.ts';
import { innerFrom, type ObservableInput } from '../interop.ts';
import type { Observable } from '../observable.ts';
import type { MonoTypeOperatorFunction } from '../operator.ts';
import { pipeValue } from '../pipe.ts';
import { ignoreElements } from './ignore-elements.ts';
import { map } from './map.ts';
import { mergeMap } from './merge-map.ts';
import { take } from './take.ts';

/**
 * Per-value delay as flattening algebra, exactly RxJS 7.8.2's own
 * construction: each value maps to its duration's first emission, replaced by
 * the value. A duration that completes without emitting drops its value (the
 * v7 behavior change); duration errors are result errors; completion waits
 * for pending durations under merge semantics.
 *
 * The deprecated `subscriptionDelay` argument (M18) prefixes the delayed
 * source with the delay's first emission, ignored: `concat` of
 * `subscriptionDelay |> take(1) |> ignoreElements()` and the delayed source.
 */
export const delayWhen = <T>(
  delayDurationSelector: (value: T, index: number) => ObservableInput<unknown>,
  subscriptionDelay?: Observable<unknown>
): MonoTypeOperatorFunction<T> => {
  if (subscriptionDelay) {
    return (source) =>
      concat<T>([
        pipeValue(subscriptionDelay, take<unknown>(1), ignoreElements()),
        pipeValue(source, delayWhen(delayDurationSelector)),
      ]);
  }
  return mergeMap((value: T, index: number) =>
    pipeValue(
      innerFrom(delayDurationSelector(value, index)),
      take(1),
      map((): T => value)
    )
  );
};
