import { createOperatorSubscriber, operate, subscribeOperator, type OperatorFunction } from '../core/operator.ts';

export const pairwise = <T>(): OperatorFunction<T, [T, T]> =>
  operate((source, destination) => {
    let previous!: T;
    let hasPrevious = false;

    const operatorSubscriber = createOperatorSubscriber<T, [T, T]>(destination, (value) => {
      const prior = previous;
      previous = value;
      if (hasPrevious) {
        destination.next([prior, value]);
      }
      hasPrevious = true;
    });

    return subscribeOperator(source, operatorSubscriber);
  });
