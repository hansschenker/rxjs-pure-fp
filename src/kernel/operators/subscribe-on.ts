import { executeSource } from '../observable.ts';
import { operate, type MonoTypeOperatorFunction } from '../operator.ts';
import type { Scheduler } from '../scheduler.ts';

/** Defers the act of subscribing itself onto the given scheduler. */
export const subscribeOn = <T>(scheduler: Scheduler, delay = 0): MonoTypeOperatorFunction<T> =>
  operate((source, destination) => {
    destination.add(scheduler.schedule(() => executeSource(source, destination), delay));
    return undefined;
  });
