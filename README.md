# rxjs-pure-fp

A modern functional reimplementation experiment targeting **RxJS 7.8.2 behavior and feature capability without classes, inheritance, or prototype architecture**.

> **RxJS 7.8.2 defines the behavior. `rxjs-pure-fp` defines a different implementation architecture.**

## Why this project exists

RxJS 7.8.2 is written in TypeScript and exposes a small runtime object model around `Observable`, `Subscriber`, `Subscription`, Subjects, and schedulers. A separate experiment downlevel-compiled RxJS 7.8.2 to ES3/CommonJS and demonstrated that modern JavaScript `class` syntax is not fundamental to the runtime: the emitted library becomes constructor functions and prototype methods.

`rxjs-pure-fp` asks the stronger question:

> Can the complete RxJS 7.8.2 reactive machine be re-expressed with functions, closures, structural records, and policy composition while retaining its observable semantics?

This is not an attempt to make a smaller "Rx-like" library. The long-term target is RxJS 7.8.2 feature equality, measured continuously against the real package.

## Three sources of truth

```text
                  rxjs@7.8.2
                 Behavioral Oracle
                        │
                        │ differential tests
                        ▼
ES3 downlevel ─────► rxjs-pure-fp
Runtime Map          Functional Reimplementation
                        │
                        ▼
                   parity traces
```

- **RxJS 7.8.2** defines correct behavior and the public feature set.
- **The ES3 downlevel reference** exposes runtime responsibilities without TypeScript class syntax, but it remains constructor/prototype architecture and is never copied as the target design.
- **`rxjs-pure-fp`** reconstructs those responsibilities functionally.

## Target mental model

```text
Observable     = lazy execution description
Operator       = Observable<A> -> Observable<B>
Sink           = next/error/complete protocol
Subscription   = teardown lifecycle closure
Subject        = multicast closure
Scheduler      = execution-time policy
```

The governing state rule is simple: **state belongs to the narrowest lifetime that requires it**. Normal execution state is created per subscription. Shared state exists only where sharing is explicit.

## Architecture rules

Implementation code under `src/` must not use project-defined classes, inheritance, `super`, prototype mutation, or constructor/prototype OO disguised as functions. An AST-based architecture check enforces this rule.

Functions, closures, structural objects, discriminated unions, higher-order functions, and localized mutable execution state are expected. Platform constructors such as `Error`, `Map`, `Set`, or `AbortController` remain available where appropriate.

## Current status — M01 Functional Subscription

M01 implements the first real RxJS runtime responsibility: **the Subscription lifecycle**.

Instead of translating the RxJS `Subscription` class into another constructor/prototype shape, M01 decomposes its responsibilities and rebuilds them with lexical state and functions:

```text
createSubscription(initialTeardown?)
        │
        ├── closure: closed
        ├── closure: parentage
        ├── closure: finalizers
        │
        └── structural record
              ├── closed
              ├── add(teardown)
              ├── remove(teardown)
              └── unsubscribe()
```

Nothing in this runtime primitive is a project-defined class or constructor instance. There is no prototype-owned behavior and no global registry holding subscription state.

### What happens during unsubscribe

```text
open subscription
      │
      ▼
unsubscribe()
      │
      ├── closed = true first
      ├── detach from every parent
      ├── run initial teardown
      ├── run registered finalizers in order
      ├── continue even if finalizers throw
      ├── flatten nested unsubscription errors
      └── remain permanently closed
```

The first call performs the lifecycle transition. Later calls are no-ops, matching RxJS 7.8.2 idempotence.

### Parent/child ownership

When one functional subscription is added to another, the parent owns the child's teardown. A child can belong to multiple parents. If the child unsubscribes first, it removes itself from every parent. If a parent explicitly removes the child, ownership is removed without cancelling the child.

Cross-record parent bookkeeping uses module-private symbol-keyed functions. They are internal closure-coordination hooks, not public methods or prototype machinery.

### Finalizers

M01 supports the same important finalizer forms as RxJS 7.8.2:

- teardown functions;
- child subscriptions;
- structural objects with `unsubscribe()`;
- duplicate function finalizers;
- immediate finalization when added after the subscription is already closed.

`remove()` removes one matching finalizer occurrence at a time, matching RxJS behavior for duplicate function/object finalizers.

### Teardown errors

All finalizers are attempted even if an earlier teardown throws. Errors are collected and raised as one `UnsubscriptionError`. If a child teardown already produced a functional `UnsubscriptionError`, its inner errors are flattened into the parent aggregate, matching the RxJS 7.8.2 lifecycle trace and message shape.

### Functional API and RxJS parity names

The canonical FP entry point is:

```ts
const subscription = createSubscription(() => {
  // initial teardown
});

subscription.add(() => {
  // additional finalizer
});

subscription.unsubscribe();
```

RxJS 7.8.2 publicly exports `Subscription` and `UnsubscriptionError`, so M01 also exposes those names. In `rxjs-pure-fp` they are **ordinary arrow-function factories**, not constructible classes:

```ts
const subscription = Subscription();
const error = UnsubscriptionError([new Error('boom')]);
```

`new Subscription()` and `new UnsubscriptionError()` intentionally fail. OO invocation compatibility is not part of the kernel contract.

`createSubscription` is recorded in `reference/functional-exports.json` as a deliberate FP-only root extension so the parity tooling can distinguish intentional functional API from accidental exports.

### M01 verification status

Current evidence after M01:

- **11 unit tests** pass across M00/M01;
- **7 M01 differential lifecycle traces** match `rxjs@7.8.2`;
- architecture gate passes for all TypeScript runtime source;
- ESM, CommonJS, and declaration builds pass;
- distribution class/prototype architecture checks pass;
- RxJS root export parity is **2 / 175 = 1.1%** (`Subscription`, `UnsubscriptionError`);
- one deliberate functional root extension exists: `createSubscription`;
- unexpected root exports: **0**.

The seven differential M01 scenarios cover lifecycle ordering, duplicate finalizer removal, explicit child removal, add-after-close behavior, structural unsubscribables, multi-parent child ownership, and nested teardown-error aggregation.

## Milestone roadmap

### M00 — Foundation ✅

Established the behavioral oracle, immutable reference boundary, architecture enforcement, differential testing, export measurement, reproducible build system, and canonical project documentation.

### M01 — Functional Subscription ✅

Replaced `Subscription` class architecture with closure-owned lifecycle state and a structural record. Implemented teardown registration, idempotent unsubscribe, nested ownership, explicit removal, structural unsubscribables, immediate teardown after closure, and aggregated teardown-error semantics. Differential lifecycle traces match RxJS 7.8.2.

### M02 — Functional Sink — next

Replace `Subscriber`/`SafeSubscriber` inheritance responsibilities with composed sink functions and lifecycle guards. Implement the `next/error/complete` protocol, stopped-state behavior, forwarding, user-handler errors, and finalization while composing the M01 Subscription lifecycle instead of inheriting from it.

### M03 — Functional Observable

Introduce the lazy Observable execution description and standalone `subscribe`. Pipeline construction remains inert; each subscription creates independent execution state. No `lift`, Observable class, or prototype methods are required by the kernel.

### M04 — First Functional RxJS Pipeline

Prove the complete path from creation to execution with `of`, representative `map` and `filter`, standalone `pipe`, and subscription. The milestone must match RxJS 7.8.2 notification order and cancellation semantics end-to-end.

### M05 — Projection & Querying

Recover the projection/querying family including map, filter, tap, scan, reduce, pairwise, and distinct variants while keeping business logic in user functions and reactive mechanics in operators.

### M06 — Selection & Gating

Implement positional, value-driven, and notifier-driven selection: take/skip families, first/last/single/elementAt, and related completion semantics.

### M07 — Higher-Order Kernel

Build the shared inner-subscription machinery needed to project source values into inner Observables and track their independent lifecycles.

### M08 — Flattening Policies

Express the four canonical policies over the higher-order kernel: `mergeMap` allows overlap, `concatMap` queues, `switchMap` keeps only the latest, and `exhaustMap` ignores new work while busy. Implement corresponding flattening relatives.

### M09 — Multi-Source Coordination

Implement merge, concat, combineLatest, zip, race, forkJoin, withLatestFrom, and their termination/coordination rules.

### M10 — Functional Subjects

Implement Subject as a multicast closure, then compose BehaviorSubject, ReplaySubject, and AsyncSubject from the multicast mechanism plus explicit state/replay/completion policies rather than inheritance.

### M11 — Sharing Topology

Implement connectable, connect, share, shareReplay, and multicast lifecycle semantics. Sharing is treated as an explicit change from independent execution to shared execution topology.

### M12 — Error & Resubscription

Implement catchError, retry, retryWhen, repeat, repeatWhen, finalize, and related resubscription lifecycle behavior.

### M13 — Scheduler Kernel

Replace scheduler/action inheritance with a scheduling kernel configured by clock, queue, request/cancel, and flush policies. Recover queue, asap, async, and animation-frame behavior.

### M14 — Temporal Operators

Implement timer, interval, delay, debounce, audit, throttle, sample, timeout, and related temporal behaviors on top of sources and scheduler policies.

### M15 — Boundary & Collection

Implement buffer, window, groupBy, and related boundary/collection families including overlapping, contiguous, and gapped execution patterns where RxJS 7.8.2 supports them.

### M16 — Platform Sources

Implement DOM/event sources, callback adapters, ajax, fetch, and WebSocket integration while retaining cancellation and teardown semantics.

### M17 — Testing Runtime

Recover virtual-time testing and TestScheduler-equivalent feature capability without importing scheduler class architecture into the functional kernel.

### M18 — Remaining RxJS 7.8.2 Surface

Close gaps for uncommon and deprecated-but-public behavior required by the declared feature-equality target.

### M19 — Package Parity

Complete public subpath exports, declarations, ESM/CommonJS surfaces, and package compatibility. Full export parity becomes strict here.

### M20 — Differential Certification

Run the complete behavioral and export parity matrix. The target is the same observable behavior and feature capability with a different runtime architecture.

## Reference material

`reference/rxjs-7.8.2-es3/` contains an immutable execution-core slice of the verified ES3/CommonJS build: `Subscription`, `Subscriber`, `Observable`, `OperatorSubscriber`, and representative `map`. It is read-only anatomy material. Later milestones may add exact files from the same verified artifact when they reach Subjects, sharing, schedulers, higher-order execution, or another subsystem.

The original ES3 artifact SHA-256 is:

```text
b274b8fb3d87c47b96623965abd67cf218a2bd5ec4e0ae856a0455641a5799c9
```

## Development

```bash
npm ci
npm run oracle:exports:check
npm run verify
```

Use `npm run oracle:exports` only when intentionally regenerating the committed RxJS 7.8.2 export baseline.

Individual gates are available as `typecheck`, `lint`, `architecture:check`, `test`, `test:differential`, `build`, `parity:exports`, and `dist:check`.

## Documentation

- `docs/ARCHITECTURE.md` — target functional architecture and state ownership.
- `docs/SEMANTICS.md` — RxJS 7.8.2 semantic invariants that must survive reimplementation.
- `docs/FUNCTIONAL-RUNTIME.md` — functional decomposition and policy-composition heuristics.
- `docs/ES3-TO-FP-MAPPING.md` — how to read the ES3 runtime without copying its OO architecture.
- `docs/RXJS-7.8.2-PARITY.md` — continuously updated parity scoreboard.
- `docs/EXECUTION-PLAN.md` — milestone order and completion gates.
- `AGENTS.md` — mandatory implementation rules for automated coding agents and contributors.

## License

Apache-2.0. RxJS reference material retains its corresponding Apache-2.0 license notice under `reference/`.
