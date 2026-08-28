export { config } from './core/config.js';
export {
  Subscriber,
  createSubscriber,
} from './core/sink.js';
export {
  Subscription,
  UnsubscriptionError,
  createSubscription,
} from './core/subscription.js';

export type { GlobalConfig } from './core/config.js';
export type {
  Observer,
  PartialObserver,
  Sink,
  Subscriber as SubscriberLike,
} from './core/sink.js';
export type {
  Subscription as SubscriptionLike,
  TeardownLogic,
  Unsubscribable,
  UnsubscriptionError as UnsubscriptionErrorLike,
} from './core/subscription.js';
