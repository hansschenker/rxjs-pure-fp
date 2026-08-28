import { subscribe } from '../core/observable.ts';
import { createOperatorSubscriber, operate, type OperatorFunction } from '../core/operator.ts';

export const map = <T, R, A = undefined>(
  project: (this: A, value: T, index: number) => R,
  thisArg?: A
): OperatorFunction<T, R> =>
  operate((source, destination) => {
    let index = 0;
    const operatorSubscriber = createOperatorSubscriber<T, R>(destination, (value) => {
      destination.next(Reflect.apply(project, thisArg, [value, index++]));
    });

    return subscribe(operatorSubscriber)(source);
  });
