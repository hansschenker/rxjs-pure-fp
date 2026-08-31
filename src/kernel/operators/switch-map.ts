import { flattenWith, latestPolicy } from '../flattening.ts';
import type { Observable } from '../observable.ts';
import type { OperatorFunction } from '../operator.ts';

/**
 * Latest policy over the M07 machine: a new outer value cancels the active
 * inner. The deprecated `resultSelector` overload is compat surface.
 */
export const switchMap = <T, R>(
  project: (value: T, index: number) => Observable<R>
): OperatorFunction<T, R> => flattenWith(latestPolicy, project);
