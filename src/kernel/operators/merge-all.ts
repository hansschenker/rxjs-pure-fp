import type { ObservableInput } from '../interop.ts';
import type { OperatorFunction } from '../operator.ts';
import { identity } from '../pipe.ts';
import { mergeMap } from './merge-map.ts';

/** Flattening a higher-order source is projection by `identity`. */
export const mergeAll = <T>(concurrent = Infinity): OperatorFunction<ObservableInput<T>, T> =>
  mergeMap<ObservableInput<T>, T>(identity, concurrent);
