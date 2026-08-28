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

## Current status — M00 Foundation

M00 deliberately implements **no RxJS runtime primitive yet**. It establishes the measuring equipment before the experiment starts changing the machine.

M00 provides:

- `rxjs@7.8.2` pinned as the development-only behavioral oracle;
- a curated immutable slice of the verified RxJS 7.8.2 ES3 build;
- an AST architecture gate that prevents class/inheritance architecture;
- a differential trace harness with an RxJS oracle self-test;
- generated public-export snapshot tooling;
- an export-parity reporter;
- modern TypeScript 7 configuration;
- ESM, CommonJS, and declaration build scaffolding;
- distribution architecture checks;
- CI verification;
- canonical architecture, semantics, and execution-plan documents.

M00 therefore gives later milestones three independent gates:

```text
Architecture  → is the implementation genuinely functional?
API scope     → did the milestone expose what it promised?
Behavior      → does its execution trace match RxJS 7.8.2?
```

## Milestone roadmap

### M00 — Foundation ✅

Establish the behavioral oracle, immutable reference boundary, architecture enforcement, differential testing, export measurement, build system, and project documentation. Runtime feature parity remains intentionally at zero.

### M01 — Functional Subscription

Replace `Subscription` class architecture with closure-owned lifecycle state. Implement teardown registration, idempotent unsubscribe, nested teardown ownership, finalizer behavior, and teardown-error semantics. Differential tests focus on lifecycle rather than values.

### M02 — Functional Sink

Replace `Subscriber`/`SafeSubscriber` inheritance responsibilities with composed sink functions and lifecycle guards. Implement the `next/error/complete` protocol, stopped-state behavior, forwarding, user-handler errors, and finalization.

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

`reference/rxjs-7.8.2-es3/` contains a curated M00 slice of the verified ES3/CommonJS build: Observable, Subscriber, Subscription, Subject variants, OperatorSubscriber, representative operators, and scheduler internals. It is read-only anatomy material. Later milestones may add files from the same verified artifact when they reach another subsystem.

The original ES3 artifact SHA-256 is:

```text
b274b8fb3d87c47b96623965abd67cf218a2bd5ec4e0ae856a0455641a5799c9
```

## Development

```bash
npm install
npm run oracle:exports
npm run verify
```

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
