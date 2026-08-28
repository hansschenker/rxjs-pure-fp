# Semantic Invariants

RxJS 7.8.2 is the behavioral oracle for this project.

## Laziness

Creating an Observable or applying operators must not start source work. Execution begins only at subscription.

## Cold independence

Unless sharing is explicit, separate subscriptions create separate executions and separate mutable execution state.

This includes operator-local state such as indexes, accumulators, previous values, and distinct-value Sets.

## Notification protocol

An execution emits zero or more `next(value)` notifications followed by at most one terminal `complete()` or `error(error)` notification.

After termination or explicit cancellation, normal destination delivery stops.

## Subscriber state

```text
closed     = teardown lifecycle ended
isStopped  = notifications no longer accepted
```

The two states represent different responsibilities even though terminal execution normally causes both to converge.

## Synchronous behavior

If RxJS 7.8.2 executes synchronously, the pure functional runtime preserves ordering and cancellation visibility.

A source is allowed to complete before returning teardown. That returned teardown is later added to the already-closed Subscriber and therefore executes immediately.

## Source exceptions

Synchronous exceptions thrown by a source initializer enter the Subscriber error channel.

## Cancellation and teardown

Unsubscription is cancellation, not completion. It must not synthesize `complete()`.

Returned source teardown becomes owned by the active Subscriber. Child Subscriptions participate in the same lifecycle ownership graph.

## Operator contract

A pipeable operator is:

```ts
type OperatorFunction<A, B> =
  (source: Observable<A>) => Observable<B>;
```

Applying an operator constructs another lazy Observable. It does not subscribe immediately.

## Operator ownership ordering

For a first-order operator, the upstream child Subscriber must be owned by the downstream Subscriber before source execution starts:

```text
create child
   │
downstream.add(child)
   │
subscribe source with child
```

This is required for synchronous cancellation. If downstream unsubscribes inside `next`, every upstream operator child must already be reachable by teardown before a synchronous source tries to emit another value.

## Operator state lifetime

Mutable operator state is allocated per subscription, not per operator definition.

For example:

```text
map(project)                     subscribe mapped$
------------                     -----------------
captures project                 index = 0
no mutable execution state       source execution
```

The same rule applies to filter indexes and later to scan accumulators, previous-value memory, buffers, and Sets.

## Operator callback failures

Errors thrown by operator-owned callbacks such as a map projection or filter predicate are caught at the operator Subscriber boundary and sent downstream through `error`.

This differs from an error thrown by a raw downstream Subscriber destination. Raw destination behavior follows Subscriber semantics; safe user callbacks follow safe-consumer semantics.

## Value direction and ownership direction

In an operator chain:

```text
values / notifications      upstream ─────► downstream
ownership / cancellation    upstream ◄───── downstream
```

This bidirectional relationship is a permanent execution invariant.

## `of` synchronous source rule

The synchronous source checks `subscriber.closed` before each next emission. Downstream cancellation can therefore stop source iteration immediately.

After the loop the source may still invoke `subscriber.complete()`; a stopped Subscriber decides whether that is delivered or treated as a stopped notification. Source code does not bypass Subscriber semantics.

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

Time enters through sources, clocks, and schedulers. Temporal operators reshape or gate notifications relative to that time.

## Differential evidence

Parity claims require trace evidence. First-order traces compare value order, indexes/state reset, terminal events, errors, subscription closure, and teardown/cancellation propagation.

Higher-order milestones add inner-subscription identity; scheduler milestones add clock/virtual-time ordering.
