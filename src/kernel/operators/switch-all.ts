import type { ObservableInput } from '../interop.ts';
import type { OperatorFunction } from '../operator.ts';
import { identity } from '../pipe.ts';
import { switchMap } from './switch-map.ts';

/** Flattening a higher-order source is projection by `identity`. */
export const switchAll = <T>(): OperatorFunction<ObservableInput<T>, T> =>
  switchMap<ObservableInput<T>, T>(identity);
