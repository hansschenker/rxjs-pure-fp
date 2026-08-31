import { exhaustPolicy, flattenWith } from '../flattening.ts';
import type { Observable } from '../observable.ts';
import type { OperatorFunction } from '../operator.ts';

/**
 * Exhaust policy over the M07 machine: outer values arriving while an inner
 * is active are ignored without consuming a projection index. The deprecated
 * `resultSelector` overload is compat surface.
 */
export const exhaustMap = <T, R>(
  project: (value: T, index: number) => Observable<R>
): OperatorFunction<T, R> => flattenWith(exhaustPolicy, project);
