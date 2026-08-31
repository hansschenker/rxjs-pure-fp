import { isValidDate } from '../creation/timer.ts';
import { createTimeoutError } from '../errors.ts';
import { executeSource, type Observable } from '../observable.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';
import { asyncScheduler, type Scheduler } from '../scheduler.ts';
import type { Subscription } from '../subscription.ts';
import { executeScheduledWork } from './schedule-work.ts';

export type TimeoutInfo<T, M = unknown> = {
  readonly meta: M | null;
  readonly seen: number;
  readonly lastValue: T | null;
};

export type TimeoutConfig<T, R = T, M = unknown> = {
  readonly first?: number | Date | undefined;
  readonly each?: number | undefined;
  readonly scheduler?: Scheduler | undefined;
  readonly with?: ((info: TimeoutInfo<T, M>) => Observable<R>) | undefined;
  readonly meta?: M | undefined;
};

/**
 * Deadline policy over owned scheduled work: `first` bounds the wait for the
 * initial value (delay or absolute `Date`), `each` re-arms after every value.
 * On expiry the source is dropped and the `with` factory's observable takes
 * over the destination; without `with`, the factory throws a `TimeoutError`
 * carrying the `{meta, seen, lastValue}` diagnostics record — the throw is
 * routed to the error channel, as is a throwing user factory. A missing
 * deadline (`first`/`each` both absent) is a synchronous `TypeError` at call
 * time. The deprecated `timeout(due, scheduler)` overload is kept.
 */
export function timeout<T, M = unknown>(config: TimeoutConfig<T, T, M>): OperatorFunction<T, T>;
export function timeout<T, R, M = unknown>(config: TimeoutConfig<T, R, M>): OperatorFunction<T, T | R>;
export function timeout<T>(due: number | Date, scheduler?: Scheduler): OperatorFunction<T, T>;
export function timeout<T, R, M>(
  config: number | Date | TimeoutConfig<T, R, M>,
  schedulerArg?: Scheduler
): OperatorFunction<T, T | R> {
  const resolved: TimeoutConfig<T, R, M> = isValidDate(config)
    ? { first: config }
    : typeof config === 'number'
      ? { each: config }
      : config;
  const { first, each, scheduler = schedulerArg ?? asyncScheduler, meta = null } = resolved;
  const withFactory = resolved.with;
  if (first == null && each == null) {
    throw new TypeError('No timeout provided.');
  }
  const fallback: (info: TimeoutInfo<T, M>) => Observable<T | R> =
    withFactory ??
    ((info) => {
      throw createTimeoutError(info);
    });

  return operate((source, destination) => {
    let timerSubscription: Subscription | null = null;
    let lastValue: T | null = null;
    let seen = 0;

    const startTimer = (delay: number): void => {
      timerSubscription = executeScheduledWork(
        destination,
        scheduler,
        () => {
          try {
            originalSourceSubscription.unsubscribe();
            executeSource(fallback({ meta, lastValue, seen }), destination);
          } catch (error) {
            destination.error(error);
          }
        },
        delay
      );
    };

    const originalSourceSubscription = createOperatorSubscriber<T, T | R>(
      destination,
      (value) => {
        timerSubscription?.unsubscribe();
        seen += 1;
        lastValue = value;
        destination.next(value);
        if (each != null && each > 0) {
          startTimer(each);
        }
      },
      undefined,
      undefined,
      () => {
        if (!timerSubscription?.closed) {
          timerSubscription?.unsubscribe();
        }
        lastValue = null;
      }
    );

    subscribeOperator(source, originalSourceSubscription);
    if (seen === 0) {
      startTimer(
        first != null ? (typeof first === 'number' ? first : +first - scheduler.now()) : (each as number)
      );
    }
    return undefined;
  });
}
