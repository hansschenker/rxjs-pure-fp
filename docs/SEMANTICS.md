# Semantic Invariants

RxJS 7.8.2 is the behavioral oracle for this project.

## Laziness

Creating an Observable or composing operators must not start the described work. Execution starts only when the dataflow is subscribed to.

## Cold independence

Unless sharing is explicitly introduced, separate subscriptions create separate executions and separate mutable execution state.

## Notification protocol

An execution may emit zero or more `next(value)` notifications, followed by at most one terminal notification: `complete()` or `error(error)`.

Once the Subscriber is stopped, later notifications are not delivered to its destination. If `config.onStoppedNotification` is configured, those ignored notifications may be observed asynchronously as diagnostics; that diagnostic reporting is not destination delivery.

## Subscriber stop-state versus lifecycle closure

M02 confirms that `isStopped` and `closed` represent different responsibilities:

- `isStopped` means the Subscriber no longer accepts destination notifications;
- `closed` means its Subscription lifecycle has been torn down.

Terminal `error` and `complete` set stop-state before invoking the destination, then trigger teardown. Direct unsubscription also stops notifications, but cancellation does not synthesize completion.

## Raw versus safe consumer behavior

The raw Subscriber boundary forwards directly to its destination. A raw `next` handler that throws propagates synchronously and does not by itself stop the Subscriber.

Terminal raw handlers execute inside a `try/finally` lifecycle boundary so teardown still occurs when an `error` or `complete` handler throws.

The safe user-consumer boundary catches user callback failures and reports them out of band, matching RxJS 7.8.2. With `config.onUnhandledError` configured, that callback runs asynchronously on another job.

An error notification for a safe consumer with no error handler is likewise reported asynchronously while the Subscriber itself transitions to stopped/closed synchronously.

## Stopped notifications

A notification sent to an already stopped Subscriber is not forwarded. By default it is a no-op. If `config.onStoppedNotification` exists, it receives the ignored notification and stopped Subscriber asynchronously.

This diagnostic hook must not reopen the Subscriber, alter terminal ordering, or deliver the notification to the original destination.

## Synchronous behavior

If RxJS 7.8.2 emits or throws synchronously for a scenario, the pure FP implementation must preserve that ordering. Moving work to a Promise or scheduler merely to simplify implementation is a semantic change.

Conversely, RxJS-defined asynchronous error-reporting boundaries must remain asynchronous. M02 specifically preserves the asynchronous SafeSubscriber unhandled-error and stopped-notification hooks.

## Cancellation and teardown

Unsubscription is cancellation, not completion. Teardown must occur at the same semantic boundary as the RxJS 7.8.2 oracle. A cancellation must not synthesize `complete`.

Subscription ownership is structural. When a Subscriber destination owns a child Subscriber, cancellation cascades through the M01 parent/child lifecycle relation rather than an inheritance relation.

## Error behavior

Errors have different routing policies depending on the boundary:

- raw Subscriber destination errors follow raw Subscriber semantics;
- safe user-consumer callback errors use asynchronous unhandled-error reporting;
- later operator milestones must route projection/predicate/etc. errors according to their RxJS 7.8.2 operator semantics;
- teardown errors follow the M01 aggregate `UnsubscriptionError` semantics.

These categories must not be collapsed into one generic error policy.

## Higher-order execution

Inner subscriptions are execution resources. Their creation, coexistence, queueing, replacement, cancellation, completion, and error behavior must match RxJS 7.8.2.

The canonical flattening policies are:

- `mergeMap`: allow overlap;
- `concatMap`: queue while busy;
- `switchMap`: only the latest inner execution remains active;
- `exhaustMap`: ignore new inner work while busy.

## Sharing

Sharing changes execution topology. It must be explicit. A Subject is not merely a value container; it is a multicast participation point with lifecycle semantics.

## Time

Time enters through sources, clocks, and schedulers. Temporal operators reshape or gate values relative to that time; they do not create an unrelated notion of time.

## Differential evidence

Parity claims require trace evidence. At minimum traces compare subscription, `next`, `error`, `complete`, and unsubscription behavior. Higher-order milestones add inner-subscription identity and lifecycle events.

M02 additionally demonstrates that differential evidence must capture synchronous versus asynchronous error/reporting boundaries; comparing only output values would miss essential Subscriber semantics.
