import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';
import { noop } from '../pipe.ts';

/** Drops every value; only the terminal notification reaches downstream. */
export const ignoreElements = (): OperatorFunction<unknown, never> =>
  operate((source, destination) => {
    subscribeOperator(source, createOperatorSubscriber(destination, noop));
  });
