# Semantic Invariants

RxJS 7.8.2 is the behavioral oracle for this project.

## Laziness

Creating an Observable or composing operators must not start the described work. Execution starts only when the dataflow is subscribed to.

## Cold independence

Unless sharing is explicitly introduced, separate subscriptions create separate executions and separate mutable execution state.

## Notification protocol

An execution may emit zero or more `next(value)` notifications, followed by at most one terminal notification: `complete()` or `error(error)`. No notification is delivered after termination or cancellation.

## Synchronous behavior

If RxJS 7.8.2 emits synchronously for a scenario, the pure FP implementation must preserve that ordering. Moving work to a Promise or scheduler merely to simplify implementation is a semantic change.

## Cancellation and teardown

Unsubscription is cancellation, not completion. Teardown must occur at the same semantic boundary as the RxJS 7.8.2 oracle. A cancellation must not synthesize `complete`.

## Error behavior

Errors thrown by user-provided functions such as projections and predicates must be routed according to the corresponding RxJS 7.8.2 operator semantics.

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

Parity claims require trace evidence. At minimum traces compare subscription, `next`, `error`, `complete`, and unsubscription events. Higher-order milestones add inner-subscription identity and lifecycle events.
