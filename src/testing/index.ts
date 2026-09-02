/**
 * M21: the `rxjs/testing` subpath entry — RxJS 7.8.2's one value export,
 * `TestScheduler`, as a functional factory carrying the statics
 * (`frameTimeFactor`, `parseMarbles`, `parseMarblesAsSubscriptions`), plus
 * the record types of the marble-testing surface. `npm run parity:exports`
 * checks this entry against the oracle subpath.
 */
export { TestScheduler } from './test-scheduler.ts';
export type {
  AssertDeepEqual,
  MarbleValues,
  ObservableExpectation,
  ObservableToBeFn,
  RunHelpers,
  SubscriptionLogsToBeFn,
  SubscriptionsExpectation,
  TestSchedulerFactory,
} from './test-scheduler.ts';
export type { ColdObservable } from './cold-observable.ts';
export type { HotObservable } from './hot-observable.ts';
export type {
  SubscriptionLog,
  SubscriptionLoggable,
  TestMessage,
  TestNotification,
} from './test-message.ts';
