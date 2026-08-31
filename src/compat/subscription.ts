import {
  createSubscription,
  createUnsubscriptionError,
  type Subscription as SubscriptionRecord,
  type UnsubscriptionError as UnsubscriptionErrorRecord,
} from '../kernel/subscription.ts';

/**
 * Root-export parity name for RxJS 7.8.2. It is intentionally a function, not
 * a constructible class. Prefer `createSubscription` in the functional API.
 */
export const Subscription = (initialTeardown?: () => void): SubscriptionRecord =>
  createSubscription(initialTeardown);

/**
 * Root-export parity name for RxJS 7.8.2. Like `Subscription`, this is a
 * functional factory rather than a constructible error class.
 */
export const UnsubscriptionError = (errors: unknown[]): UnsubscriptionErrorRecord =>
  createUnsubscriptionError(errors);
