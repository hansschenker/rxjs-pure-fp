import type { OperatorFunction } from '../operator.ts';
import { map } from './map.ts';

/** Deprecated RxJS surface: projection to a constant is `map` ignoring input. */
export const mapTo = <R>(value: R): OperatorFunction<unknown, R> => map(() => value);
