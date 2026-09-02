import type { Scheduler } from '../kernel/scheduler.ts';

/**
 * M21: RxJS's `TestMessage` and `SubscriptionLog` as pure data. Test
 * notifications carry the three fields RxJS's `createNotification` assigns
 * (`kind`, `value`, `error`), so recorded traces have the oracle's exact
 * shape under any deep-equality assertion.
 */
export type TestNotification<T> =
  | { readonly kind: 'N'; readonly value: T; readonly error: undefined }
  | { readonly kind: 'E'; readonly value: undefined; readonly error: unknown }
  | { readonly kind: 'C'; readonly value: undefined; readonly error: undefined };

export type TestMessage<T = unknown> = {
  readonly frame: number;
  readonly notification: TestNotification<T>;
  readonly isGhost?: boolean;
};

export const nextTestNotification = <T>(value: T): TestNotification<T> =>
  Object.freeze({ kind: 'N', value, error: undefined }) as TestNotification<T>;

export const errorTestNotification = <T = never>(error: unknown): TestNotification<T> =>
  Object.freeze({ kind: 'E', value: undefined, error }) as TestNotification<T>;

const COMPLETE_TEST_NOTIFICATION = Object.freeze({ kind: 'C', value: undefined, error: undefined });

/** One shared complete notification, as RxJS's `COMPLETE_NOTIFICATION`. */
export const completeTestNotification = <T = never>(): TestNotification<T> =>
  COMPLETE_TEST_NOTIFICATION as TestNotification<T>;

export const createTestMessage = <T>(frame: number, notification: TestNotification<T>): TestMessage<T> =>
  Object.freeze({ frame, notification });

export type SubscriptionLog = {
  readonly subscribedFrame: number;
  readonly unsubscribedFrame: number;
};

export const createSubscriptionLog = (subscribedFrame: number, unsubscribedFrame = Infinity): SubscriptionLog =>
  Object.freeze({ subscribedFrame, unsubscribedFrame });

/**
 * RxJS's `SubscriptionLoggable` mixin as a closure over the scheduler's
 * clock: the log array plus the two frame recorders that cold and hot
 * observables spread into their records.
 */
export type SubscriptionLoggable = {
  readonly subscriptions: SubscriptionLog[];
  readonly logSubscribedFrame: () => number;
  readonly logUnsubscribedFrame: (index: number) => void;
};

export const createSubscriptionLogger = (scheduler: Scheduler): SubscriptionLoggable => {
  const subscriptions: SubscriptionLog[] = [];
  return {
    subscriptions,
    logSubscribedFrame: (): number => {
      subscriptions.push(createSubscriptionLog(scheduler.now()));
      return subscriptions.length - 1;
    },
    logUnsubscribedFrame: (index: number): void => {
      const previous = subscriptions[index];
      if (previous) {
        subscriptions[index] = createSubscriptionLog(previous.subscribedFrame, scheduler.now());
      }
    },
  };
};
