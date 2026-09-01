import { observeNotification, type ObservableNotification } from '../notification.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';

/**
 * Inverse of `materialize`: replays notification records onto the live
 * protocol. Any record shape with a string `kind` participates (including
 * RxJS `Notification` instances); a non-string `kind` throws the RxJS
 * validation TypeError onto the error channel.
 */
export const dematerialize = <T>(): OperatorFunction<ObservableNotification<T>, T> =>
  operate((source, destination) => {
    subscribeOperator(
      source,
      createOperatorSubscriber<ObservableNotification<T>, T>(destination, (notification) =>
        observeNotification(notification, destination)
      )
    );
  });
