import type { MonoTypeOperatorFunction } from '../operator.ts';
import { distinctUntilChanged } from './distinct-until-changed.ts';

export function distinctUntilKeyChanged<T>(key: keyof T): MonoTypeOperatorFunction<T>;
export function distinctUntilKeyChanged<T, K extends keyof T>(
  key: K,
  compare: (previous: T[K], current: T[K]) => boolean
): MonoTypeOperatorFunction<T>;
export function distinctUntilKeyChanged<T, K extends keyof T>(
  key: K,
  compare?: (previous: T[K], current: T[K]) => boolean
): MonoTypeOperatorFunction<T> {
  return distinctUntilChanged<T>((previous, current) =>
    compare ? compare(previous[key], current[key]) : previous[key] === current[key]
  );
}
