import { observeNotification } from '../kernel/notification.ts';
import { createObservable, type Observable } from '../kernel/observable.ts';
import type { Scheduler } from '../kernel/scheduler.ts';
import type { Subscriber } from '../kernel/sink.ts';
import { createSubscription } from '../kernel/subscription.ts';
import { createSubscriptionLogger, type SubscriptionLoggable, type TestMessage } from './test-message.ts';

export type ColdObservable<T> = Observable<T> &
  SubscriptionLoggable & {
    readonly messages: TestMessage<T>[];
    readonly scheduler: Scheduler;
    readonly scheduleMessages: (subscriber: Subscriber<T>) => void;
  };

type ColdState<T> = {
  readonly message: TestMessage<T>;
  readonly subscriber: Subscriber<T>;
};

const coldMarker = Symbol('rxjs-pure-fp.testing.cold');

type ColdBrand = { readonly [coldMarker]?: true };

export const isColdObservable = (value: unknown): value is ColdObservable<unknown> =>
  typeof value === 'function' && (value as ColdBrand)[coldMarker] === true;

/**
 * RxJS `ColdObservable` without the subclass: a branded Observable function
 * carrying its messages and subscription log. Each subscription logs its
 * frame, schedules every message on the scheduler at the message's frame
 * (owned by the subscriber, so cancellation drops the pending ones), and
 * logs its unsubscription frame from the returned teardown.
 */
export const createColdObservable = <T>(messages: TestMessage<T>[], scheduler: Scheduler): ColdObservable<T> => {
  const logger = createSubscriptionLogger(scheduler);

  const scheduleMessages = (subscriber: Subscriber<T>): void => {
    for (const message of messages) {
      subscriber.add(
        scheduler.schedule<ColdState<T>>(
          (state) => {
            const { message: scheduled, subscriber: destination } = state as ColdState<T>;
            observeNotification(scheduled.notification, destination);
          },
          message.frame,
          { message, subscriber }
        )
      );
    }
  };

  const cold = createObservable<T>((subscriber) => {
    const index = logger.logSubscribedFrame();
    const subscription = createSubscription();
    subscription.add(() => {
      logger.logUnsubscribedFrame(index);
    });
    scheduleMessages(subscriber);
    return subscription;
  });

  return Object.assign(cold, {
    ...logger,
    messages,
    scheduler,
    scheduleMessages,
    [coldMarker]: true as const,
  });
};
