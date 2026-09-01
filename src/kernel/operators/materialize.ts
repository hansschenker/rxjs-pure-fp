import {
  completeNotificationRecord,
  errorNotificationRecord,
  nextNotificationRecord,
  type NotificationRecord,
} from '../notification.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';

/**
 * Reifies the notification protocol as data: every `next`/`error`/`complete`
 * becomes a `next` carrying a notification record, and the result completes
 * after a terminal record (errors surface as data, not on the error channel).
 */
export const materialize = <T>(): OperatorFunction<T, NotificationRecord<T>> =>
  operate((source, destination) => {
    subscribeOperator(
      source,
      createOperatorSubscriber<T, NotificationRecord<T>>(
        destination,
        (value) => {
          destination.next(nextNotificationRecord(value));
        },
        () => {
          destination.next(completeNotificationRecord<T>());
          destination.complete();
        },
        (error) => {
          destination.next(errorNotificationRecord<T>(error));
          destination.complete();
        }
      )
    );
  });
