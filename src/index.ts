export { config } from './core/config.ts';
export {
  Observable,
  createObservable,
  subscribe,
} from './core/observable.ts';
export {
  pipe,
  pipeValue,
} from './core/pipe.ts';
export {
  Subscriber,
  createSubscriber,
} from './core/sink.ts';
export {
  Subscription,
  UnsubscriptionError,
  createSubscription,
} from './core/subscription.ts';

export type { GlobalConfig } from './core/config.ts';
export type {
  Observable as ObservableLike,
  ObservableInitializer,
  Subscribe,
} from './core/observable.ts';
export type { UnaryFunction } from './core/pipe.ts';
export type {
  Observer,
  PartialObserver,
  Sink,
  Subscriber as SubscriberLike,
} from './core/sink.ts';
export type {
  Subscription as SubscriptionLike,
  TeardownLogic,
  Unsubscribable,
  UnsubscriptionError as UnsubscriptionErrorLike,
} from './core/subscription.ts';
