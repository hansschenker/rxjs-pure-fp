import type { Observable } from '../observable.ts';
import type { OperatorFunction } from '../operator.ts';
import { identity } from '../pipe.ts';
import { switchMap } from './switch-map.ts';

/** Flattening a higher-order source is projection by `identity`. */
export const switchAll = <T>(): OperatorFunction<Observable<T>, T> =>
  switchMap<Observable<T>, T>(identity);
