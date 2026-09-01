import type { ObservableInput } from '../interop.ts';
import type { OperatorFunction } from '../operator.ts';
import { identity } from '../pipe.ts';
import { exhaustMap } from './exhaust-map.ts';

/** Flattening a higher-order source is projection by `identity`. */
export const exhaustAll = <T>(): OperatorFunction<ObservableInput<T>, T> =>
  exhaustMap<ObservableInput<T>, T>(identity);
