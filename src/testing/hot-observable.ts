import { observeNotification } from '../kernel/notification.ts';
import { createObservable, type Observable } from '../kernel/observable.ts';
import type { Scheduler } from '../kernel/scheduler.ts';
import { createAnonymousSubject, createSubject, type Subject } from '../kernel/subject.ts';
import { createSubscription } from '../kernel/subscription.ts';
import { createSubscriptionLogger, type SubscriptionLoggable, type TestMessage } from './test-message.ts';

export type HotObservable<T> = Subject<T> &
  SubscriptionLoggable & {
    readonly messages: TestMessage<T>[];
    readonly scheduler: Scheduler;
    readonly setup: () => void;
  };

/**
 * RxJS `HotObservable` without the subclass: a Subject whose subscriptions
 * are logged and whose messages `setup()` pushes into it at their frames,
 * whether or not anyone is subscribed. It is composed as the deprecated
 * `Subject.create` shape — observer side delegating to an inner hub,
 * observable side to a logging source over that hub — so the record is a
 * Subject that participates anywhere an Observable or an observer is expected.
 */
export const createHotObservable = <T>(messages: TestMessage<T>[], scheduler: Scheduler): HotObservable<T> => {
  const hub = createSubject<T>();
  const logger = createSubscriptionLogger(scheduler);

  const source: Observable<T> = createObservable((subscriber) => {
    const index = logger.logSubscribedFrame();
    const subscription = createSubscription();
    subscription.add(() => {
      logger.logUnsubscribedFrame(index);
    });
    subscription.add(hub(subscriber));
    return subscription;
  });

  const hot = createAnonymousSubject<T>(hub, source);

  const setup = (): void => {
    for (const { notification, frame } of messages) {
      scheduler.schedule(() => {
        observeNotification(notification, hot);
      }, frame);
    }
  };

  return Object.assign(hot, { ...logger, messages, scheduler, setup });
};
