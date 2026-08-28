# Functional Runtime Model

The experiment asks what remains of RxJS 7.8.2 when its behavior is retained but its class/inheritance implementation model is removed.

## Functional decomposition

```text
Observable     = execution description
Operator       = Observable -> Observable
Sink           = next/error/complete protocol
Subscription   = teardown lifecycle closure
Subject        = multicast closure
Scheduler      = execution-time policy
```

## State placement rule

State belongs to the narrowest lifetime that requires it.

- pipeline configuration state belongs to construction;
- per-subscription state belongs inside the subscription execution closure;
- per-inner state belongs inside the higher-order execution managing that inner subscription;
- shared state exists only in explicit sharing topologies.

## Operators

Operators should rewire streams and delegate domain logic to user functions. A projection operator owns notification routing and lifecycle semantics; it does not own the business transformation passed to it.

## Policy composition

Where RxJS internals use subclass families, this project should first look for a common functional machine plus a policy.

Examples:

- flattening machine + overlap/queue/latest/exhaust policy;
- multicast hub + current-value/replay/final-value policy;
- scheduler kernel + queue/asap/timer/animation-frame policy.

This is a design heuristic, not permission to over-generalize before differential tests establish a shared invariant.
