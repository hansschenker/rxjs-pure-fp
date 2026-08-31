import { flattenWith, queuePolicy } from '../flattening.ts';
import type { Observable } from '../observable.ts';
import type { OperatorFunction } from '../operator.ts';

/**
 * Queue policy over the M07 machine — merge at concurrency one. The
 * deprecated `resultSelector` overload is compat surface.
 */
export const concatMap = <T, R>(
  project: (value: T, index: number) => Observable<R>
): OperatorFunction<T, R> => flattenWith(queuePolicy, project);
