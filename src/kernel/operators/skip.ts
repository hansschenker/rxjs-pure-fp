import type { MonoTypeOperatorFunction } from '../operator.ts';
import { filter } from './filter.ts';

/** Positional skip is index gating: pure operator algebra over `filter`. */
export const skip = <T>(count: number): MonoTypeOperatorFunction<T> =>
  filter((_value, index) => count <= index);
