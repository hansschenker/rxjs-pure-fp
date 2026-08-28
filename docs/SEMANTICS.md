# Semantic Invariants

RxJS 7.8.2 is the behavioral oracle for this project.

## Laziness

Creating an Observable or composing operators must not start the described work. Execution starts only when the dataflow is subscribed to.

M03 concretely enforces this by representing an Observable as a lazy execution function that is invoked only by `subscribe`.

## Cold independence

Unless sharing is explicitly introduced, separate subscriptions create separate executions and separate mutable execution state.

Creation/operator functions may capture immutable configuration, but ordinary execution state belongs inside the per-subscription execution path.

## Notification protocol

An execution may emit zero or more `next(value)` notifications followed by at most one terminal `complete()` or `error(error)` notification.

After termination or explicit cancellation, further notifications are stopped. Optional stopped-notification reporting is out-of-band and does not re-open the execution.

## Subscriber state

`closed` and `isStopped` represent different responsibilities:

```text
closed     = teardown lifecycle has ended
isStopped  = notifications are no longer accepted
```

Terminal notification normally causes both states to converge, while explicit cancellation stops notifications without creating a terminal notification.

## Synchronous behavior

If RxJS 7.8.2 executes synchronously, `rxjs-pure-fp` must preserve that ordering. Promise/scheduler deferral cannot be introduced merely to simplify implementation.

A critical M03 invariant is the synchronous-completion/returned-teardown order:

```text
source complete
subscriber closes
source returns teardown
subscribe attaches teardown
add-to-closed executes teardown immediately
```

## Source exceptions

A synchronous exception thrown while the Observable source initializer is executing is routed to the active Subscriber error channel, matching RxJS's guarded source-subscription boundary.

The behavior of errors thrown by raw Subscriber destinations remains distinct from errors thrown by safe user handlers.

## Cancellation and teardown

Unsubscription is cancellation, not completion. Cancellation must never synthesize `complete()`.

A source may return teardown logic. Standalone `subscribe` attaches that returned teardown to the Subscriber lifecycle after the source call returns.

Returned child Subscriptions become owned resources and are cancelled with their parent Subscriber.

## Existing Subscriber identity

When an already-created Subscriber is supplied to the subscription boundary, it is reused rather than wrapped in a second Subscriber/lifecycle. This preserves identity-sensitive parentage and teardown semantics.

## Observable initializer context

For RxJS 7.8.2 parity, the user-provided Observable initializer observes the Observable representation as `this`.

In the functional runtime:

```text
initializer this === returned Observable execution function
```

No object instance or prototype is required.

## Operator contract

From M04 onward, a pipeable operator is permanently defined as:

```ts
type OperatorFunction<A, B> =
  (source: Observable<A>) => Observable<B>;
```

An operator configures a new lazy execution description. It must not subscribe to the source during pipeline construction.

## Higher-order execution

Inner subscriptions are execution resources. Their creation, coexistence, queueing, replacement, cancellation, completion, and errors must match RxJS 7.8.2.

Canonical flattening policies:

- `mergeMap`: allow overlap;
- `concatMap`: queue while busy;
- `switchMap`: cancel/replace with latest;
- `exhaustMap`: ignore new inner work while busy.

## Sharing

Sharing changes execution topology and must be explicit. Subject/connectable/share introduce shared participation; ordinary Observables remain independently executed.

## Time

Time enters through sources, clocks, and schedulers. Temporal operators reshape or gate notifications relative to that time; they do not create an unrelated time model.

## Differential evidence

Parity claims require trace evidence. At minimum traces compare execution start, notifications, subscription state, teardown, completion/error, and cancellation ordering.

Higher-order milestones add inner-subscription identity/lifecycle events; scheduler milestones add virtual/clock ordering.
