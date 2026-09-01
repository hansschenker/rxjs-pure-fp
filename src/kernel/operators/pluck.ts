import type { OperatorFunction } from '../operator.ts';
import { map } from './map.ts';

/**
 * Deprecated RxJS surface: nested property access as projection. The walk
 * preserves RxJS's exact quirk — any nullish hop or `undefined` property
 * value short-circuits the whole projection to `undefined`.
 */
export function pluck<T, K1 extends keyof T>(k1: K1): OperatorFunction<T, T[K1]>;
export function pluck<T, K1 extends keyof T, K2 extends keyof T[K1]>(
  k1: K1,
  k2: K2
): OperatorFunction<T, T[K1][K2]>;
export function pluck<T, K1 extends keyof T, K2 extends keyof T[K1], K3 extends keyof T[K1][K2]>(
  k1: K1,
  k2: K2,
  k3: K3
): OperatorFunction<T, T[K1][K2][K3]>;
export function pluck<T>(...properties: Array<string | number | symbol>): OperatorFunction<T, unknown>;
export function pluck<T>(...properties: Array<string | number | symbol>): OperatorFunction<T, unknown> {
  const length = properties.length;
  if (length === 0) {
    throw new Error('list of properties cannot be empty.');
  }
  return map((value: T) => {
    let current: unknown = value;
    for (let index = 0; index < length; index += 1) {
      const next =
        current === null || current === undefined
          ? undefined
          : (current as Record<string | number | symbol, unknown>)[
              properties[index] as string | number | symbol
            ];
      if (typeof next === 'undefined') {
        return undefined;
      }
      current = next;
    }
    return current;
  });
}
