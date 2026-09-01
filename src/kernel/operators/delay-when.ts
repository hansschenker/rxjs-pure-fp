import { innerFrom, type ObservableInput } from '../interop.ts';
import type { MonoTypeOperatorFunction } from '../operator.ts';
import { pipeValue } from '../pipe.ts';
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
 * The deprecated `subscriptionDelay` second argument is deferred to the
 * remaining-surface milestone (M18).
 */
export const delayWhen = <T>(
  delayDurationSelector: (value: T, index: number) => ObservableInput<unknown>
): MonoTypeOperatorFunction<T> =>
  mergeMap((value: T, index: number) =>
    pipeValue(
      innerFrom(delayDurationSelector(value, index)),
      take(1),
      map((): T => value)
    )
  );
