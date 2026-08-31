import type { Observable } from '../observable.ts';
import type { OperatorFunction } from '../operator.ts';
import { identity } from '../pipe.ts';
import { mergeMap } from './merge-map.ts';

/** Flattening a higher-order source is projection by `identity`. */
export const mergeAll = <T>(concurrent = Infinity): OperatorFunction<Observable<T>, T> =>
  mergeMap<Observable<T>, T>(identity, concurrent);
