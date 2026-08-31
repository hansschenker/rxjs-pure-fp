import { flattenWith, overlapPolicy } from '../flattening.ts';
import type { Observable } from '../observable.ts';
import type { OperatorFunction } from '../operator.ts';

/**
 * Overlap policy in feedback mode: every projected value (source values and
 * inner values alike) is emitted downstream and re-enters outer admission, so
 * the projection recurses until inners stop producing. As in RxJS, a
 * `concurrent` below one is normalized to unbounded.
 */
export const expand = <T, R>(
  project: (value: T | R, index: number) => Observable<R>,
  concurrent = Infinity
): OperatorFunction<T, R> =>
  flattenWith<T | R, R>(
    overlapPolicy((concurrent || 0) < 1 ? Infinity : concurrent),
    project,
    { feedback: true }
  );
