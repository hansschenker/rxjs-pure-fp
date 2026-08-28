import { subscribe } from '../core/observable.ts';
import { createOperatorSubscriber, operate, type MonoTypeOperatorFunction, type OperatorFunction } from '../core/operator.ts';

export function filter<T, S extends T>(
  predicate: (value: T, index: number) => value is S
): OperatorFunction<T, S>;
export function filter<T, A = undefined>(
  predicate: (this: A, value: T, index: number) => boolean,
  thisArg?: A
): MonoTypeOperatorFunction<T>;
export function filter<T, A = undefined>(
  predicate: (this: A, value: T, index: number) => boolean,
  thisArg?: A
): MonoTypeOperatorFunction<T> {
  return operate((source, destination) => {
    let index = 0;
    const operatorSubscriber = createOperatorSubscriber<T, T>(destination, (value) => {
      if (Reflect.apply(predicate, thisArg, [value, index++])) {
        destination.next(value);
      }
    });

    return subscribe(operatorSubscriber)(source);
  });
}
