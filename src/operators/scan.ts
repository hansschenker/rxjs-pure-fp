import type { OperatorFunction } from '../core/operator.ts';
import { scanInternals } from './scan-internals.ts';

export function scan<V, A = V>(
  accumulator: (accumulator: A | V, value: V, index: number) => A
): OperatorFunction<V, V | A>;
export function scan<V, A>(
  accumulator: (accumulator: A, value: V, index: number) => A,
  seed: A
): OperatorFunction<V, A>;
export function scan<V, A, S>(
  accumulator: (accumulator: A | S, value: V, index: number) => A,
  seed: S
): OperatorFunction<V, A>;
export function scan<V, A, S>(
  accumulator: (accumulator: V | A | S, value: V, index: number) => A,
  seed?: S
): OperatorFunction<V, V | A> {
  return scanInternals(accumulator, seed as S, arguments.length >= 2, true, false) as OperatorFunction<V, V | A>;
}
