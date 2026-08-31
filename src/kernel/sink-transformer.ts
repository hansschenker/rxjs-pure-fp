import {
  COMPLETE_NOTIFICATION,
  errorNotification,
  nextNotification,
  type ObservableNotification,
} from './notification.ts';
import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from './operator.ts';

/**
 * F2 prototype (docs/FP-ROADMAP.md): the sink as one total function over the
 * notification ADT instead of a three-method record.
 */
export type NotificationSink<T> = (notification: ObservableNotification<T>) => void;

/**
 * An operator expressed as a contravariant sink transformation: it receives the
 * downstream sink and returns the sink handed upstream. `liftSinkTransformer`
 * applies a transformer exactly once per subscription.
 */
export type SinkTransformer<T, R> = (downstream: NotificationSink<R>) => NotificationSink<T>;

/** Functor map as pure notification rewriting over the `N` case. */
export const mapSink = <T, R>(project: (value: T) => R): SinkTransformer<T, R> =>
  (downstream) => (notification) => {
    downstream(notification.kind === 'N' ? nextNotification(project(notification.value)) : notification);
  };

/** Gates the `N` case; error and complete notifications pass through untouched. */
export const filterSink = <T>(predicate: (value: T) => boolean): SinkTransformer<T, T> =>
  (downstream) => (notification) => {
    if (notification.kind !== 'N' || predicate(notification.value)) {
      downstream(notification);
    }
  };

/**
 * Fuses two transformers in pipe order: values flow through `first`, then
 * `second`. Contravariance flips the applied order, so the fused transformer
 * wires `first(second(downstream))` and the whole pipeline collapses into a
 * single sink function.
 */
export const fuseSinkTransformers = <A, B, C>(
  first: SinkTransformer<A, B>,
  second: SinkTransformer<B, C>
): SinkTransformer<A, C> =>
  (downstream) => first(second(downstream));

/**
 * Lifts a pure sink transformer into an OperatorFunction. Lifecycle semantics
 * stay in the existing operator Subscriber machinery: child ownership via
 * `destination.add`, stop-state, and handler-error routing to
 * `destination.error` are unchanged from the fused operators.
 */
export const liftSinkTransformer = <T, R>(transformer: SinkTransformer<T, R>): OperatorFunction<T, R> =>
  operate((source, destination) => {
    const downstream: NotificationSink<R> = (notification) => {
      if (notification.kind === 'N') {
        destination.next(notification.value);
      } else if (notification.kind === 'E') {
        destination.error(notification.error);
      } else {
        destination.complete();
      }
    };
    const upstream = transformer(downstream);

    const operatorSubscriber = createOperatorSubscriber<T, R>(
      destination,
      (value) => upstream(nextNotification(value)),
      () => upstream(COMPLETE_NOTIFICATION),
      (error) => upstream(errorNotification(error))
    );

    return subscribeOperator(source, operatorSubscriber);
  });
