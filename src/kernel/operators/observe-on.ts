import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type MonoTypeOperatorFunction,
} from '../operator.ts';
import { executeScheduledWork } from './schedule-work.ts';
import type { Scheduler } from '../scheduler.ts';

/**
 * Re-emits every notification on the given scheduler; pending emissions are
 * cancelled by downstream unsubscription through action ownership.
 */
export const observeOn = <T>(scheduler: Scheduler, delay = 0): MonoTypeOperatorFunction<T> =>
  operate((source, destination) => {
    const operatorSubscriber = createOperatorSubscriber<T, T>(
      destination,
      (value) => executeScheduledWork(destination, scheduler, () => destination.next(value), delay),
      () => executeScheduledWork(destination, scheduler, () => destination.complete(), delay),
      (error) => executeScheduledWork(destination, scheduler, () => destination.error(error), delay)
    );
    return subscribeOperator(source, operatorSubscriber);
  });
