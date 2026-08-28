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

The source gate currently enforces the stronger rule that even type-level `extends` is absent from runtime source. Type composition uses structural intersections.

---

# Current status — M02 Functional Sink

M02 reconstructs the second major runtime responsibility: **the RxJS Subscriber / sink notification machine**.

RxJS 7.8.2 expresses the relationship through inheritance:

```text
Subscription
     ▲
     │
 Subscriber
     ▲
     │
SafeSubscriber
```

`rxjs-pure-fp` separates those responsibilities and composes them:

```text
createSubscription()
        │
        │ lifecycle ownership
        ▼
structural Subscription record
        │
        │ enrich same record
        ▼
createSubscriber(destination)
        │
        ├── closure: isStopped
        ├── closure: destination
        ├── next(value)
        ├── error(error)
        ├── complete()
        └── unsubscribe()

partial observer / callbacks
        │
        ▼
safe consumer adapter
        │
        ▼
createSubscriber(...)
```

The important point is that **Subscriber is not a second lifecycle object**. M02 takes the structural record produced by M01 and enriches that same record with the Observer protocol. This preserves the identity-sensitive parent/child teardown behavior already established by M01.

The enrichment uses own properties on the record. It does not modify a prototype and does not create an inheritance chain.

## M01 foundation — lifecycle

M01 established the functional Subscription machine:

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

Its tested contract includes idempotent cancellation, parent/child teardown ownership, explicit removal, structural unsubscribables, add-after-close behavior, ordered finalization, and aggregated teardown errors.

M02 composes this lifecycle rather than inheriting it.

## M02 notification state machine

A raw functional Subscriber has two independent but coordinated state dimensions:

```text
Lifecycle state                Notification state
---------------                ------------------
closed                         isStopped
finalizers                     destination
parentage                      next/error/complete
```

The states meet at terminal notifications and direct cancellation.

### `next(value)`

```text
next(value)
    │
    ├── isStopped = false ──► destination.next(value)
    │
    └── isStopped = true  ──► optional stopped-notification report
```

A raw destination is deliberately raw. If its `next` handler throws, that error propagates synchronously and the Subscriber remains open, matching RxJS 7.8.2 `Subscriber` behavior.

### `error(error)`

```text
error(error)
    │
    ├── already stopped
    │       └── optional stopped-notification report
    │
    └── active
            ├── isStopped = true
            ├── destination.error(error)
            └── unsubscribe() in finally
```

Even if the raw destination's `error` handler throws, teardown still runs because finalization occurs in `finally`.

### `complete()`

```text
complete()
    │
    ├── already stopped
    │       └── optional stopped-notification report
    │
    └── active
            ├── isStopped = true
            ├── destination.complete()
            └── unsubscribe() in finally
```

Completion is terminal and triggers teardown. Direct `unsubscribe()` also sets the Subscriber to stopped, but cancellation does **not** synthesize a completion notification.

## `closed` and `isStopped` are different ideas

M02 preserves an important RxJS distinction:

```text
closed     = lifecycle has been torn down
isStopped  = notifications are no longer accepted
```

For normal terminal execution they move together, but they express different responsibilities. That separation becomes important when operators and Observable execution are introduced.

## Destination chaining

If a Subscriber is used as another Subscriber's destination, M02 preserves RxJS's ownership topology:

```text
parent Subscriber
       │
       │ owns child lifecycle
       ▼
child Subscriber
```

Unsubscribing the destination parent tears down the child. This works because M02 composes the already-tested M01 Subscription record rather than introducing a parallel lifecycle representation.

## Raw Subscriber versus safe consumer

RxJS makes an important distinction between `Subscriber` and `SafeSubscriber` / `ConsumerObserver`. M02 keeps the distinction, but expresses it as function composition.

### Raw boundary

```text
source/operator code
      │
      ▼
createSubscriber(destination)
      │
      ▼
raw destination functions
```

Errors thrown by a raw destination are not automatically converted into asynchronous unhandled errors.

### Safe user-consumer boundary

```text
partial observer / callbacks
          │
          ▼
consumer adapter
  try/catch each handler
          │
          ▼
createSubscriber(...)
```

`Subscriber.create(...)` retains the deprecated RxJS 7.8.2 helper shape and delegates to this safe adapter. The public parity name `Subscriber` remains a normal function, not a constructible class.

```ts
const subscriber = Subscriber.create(
  value => console.log(value),
  error => console.error(error),
  () => console.log('complete')
);
```

`new Subscriber()` intentionally fails. OO invocation compatibility is not part of the functional kernel contract.

The canonical FP constructor is:

```ts
const subscriber = createSubscriber({
  next: value => console.log(value),
  error: error => console.error(error),
  complete: () => console.log('complete')
});
```

## User-handler errors

The safe consumer adapter mirrors RxJS's boundary behavior:

- a thrown user `next` handler is reported asynchronously;
- a thrown user `error` handler is reported asynchronously;
- a thrown user `complete` handler is reported asynchronously;
- an error notification without a supplied error handler is reported asynchronously;
- the Subscriber's lifecycle is not confused with that out-of-band error reporting.

M02 implements the relevant `config.onUnhandledError` hook and differentially verifies the asynchronous behavior.

## Stopped notifications

Notifications sent after completion, error, or explicit unsubscription are not delivered to the destination. By default they are ignored.

If `config.onStoppedNotification` is configured, M02 reports them asynchronously, matching RxJS 7.8.2:

```text
stopped Subscriber
      │
      ├── next(value)
      ├── error(error)
      └── complete()
              │
              ▼
     onStoppedNotification
       on another job
```

The callback receives the notification shape and the stopped Subscriber record.

## Deprecated next context

RxJS 7.8.2 still contains the deprecated `config.useDeprecatedNextContext` compatibility path. M02 preserves the behavior without copying RxJS's `Function.prototype.bind` technique.

Instead, the functional implementation creates a context value and uses a closure plus `Reflect.apply`:

```text
handler + context
       │
       ▼
closure(args)
       │
       ▼
Reflect.apply(handler, context, args)
```

This was an architectural discovery during M02: the no-prototype gate rejected the first direct translation of RxJS's binding trick, forcing a cleaner functional representation.

## Config scope introduced by M02

`config` is now a root parity export because it participates directly in Subscriber semantics.

M02 behaviorally exercises:

- `config.onUnhandledError`;
- `config.onStoppedNotification`;
- `config.useDeprecatedNextContext` at the unit level.

The object also carries the RxJS 7.8.2 fields `Promise` and `useDeprecatedSynchronousErrorHandling`. Their complete observable-level behavior is **not** claimed by M02; later milestones will certify those paths when the corresponding execution APIs exist.

## Multi-file TypeScript source strategy

M02 is the first milestone where the runtime spans several TypeScript modules. Source tests execute TypeScript directly under Node 22, while distributable builds emit JavaScript.

The project therefore enables TypeScript's relative-import extension rewriting:

```json
"rewriteRelativeImportExtensions": true
```

Runtime source modules can use explicit `.ts` relative specifiers during direct source execution, and TypeScript rewrites them to emitted JavaScript paths for ESM/CommonJS builds. This is now shared infrastructure for later milestones.

## M02 verification status

Latest verified M02 evidence:

- **16 / 16 unit tests** pass across M00-M02;
- **9 M02 differential traces** match `rxjs@7.8.2`;
- **17 / 17 total differential tests** pass including M00 and M01 evidence;
- architecture gate passes for **6 TypeScript runtime source files**;
- ESM, CommonJS, and declaration builds pass;
- distribution architecture check passes for **12 emitted JavaScript files**;
- RxJS root export parity is **4 / 175 = 2.3%**;
- implemented RxJS root parity names are `Subscription`, `UnsubscriptionError`, `Subscriber`, and `config`;
- deliberate functional root extensions are `createSubscription` and `createSubscriber`;
- unexpected root exports: **0**.

The nine M02 differential scenarios cover:

1. ordinary next/complete/stopped notification behavior;
2. direct unsubscribe behavior;
3. Subscriber destination/lifecycle chaining;
4. raw `next` handler failure semantics;
5. raw `error` handler failure plus guaranteed finalization;
6. safe callback adaptation;
7. asynchronous safe-handler error reporting;
8. asynchronous reporting when no error handler exists;
9. asynchronous stopped-notification reporting.

---

# Milestone roadmap

### M00 — Foundation ✅

Established the RxJS 7.8.2 behavioral oracle, immutable ES3 reference boundary, architecture enforcement, differential testing, export measurement, reproducible build system, and canonical project documentation.

### M01 — Functional Subscription ✅

Replaced `Subscription` class architecture with closure-owned lifecycle state and a structural record. Implemented teardown registration, idempotent unsubscribe, nested ownership, explicit removal, structural unsubscribables, immediate teardown after closure, and aggregated teardown-error semantics. Seven differential lifecycle traces match RxJS 7.8.2.

### M02 — Functional Sink ✅

Replaced `Subscription ← Subscriber ← SafeSubscriber` inheritance with composition of the M01 lifecycle record, lexical stop/destination state, structural notification functions, and a separate safe consumer adapter. Nine new differential traces match RxJS 7.8.2, including asynchronous user-error and stopped-notification behavior.

### M03 — Functional Observable — next

Introduce the lazy Observable execution description and standalone `subscribe`. Pipeline construction must remain inert; each subscription creates independent execution state. M03 will compose the M01 lifecycle and M02 sink into the first actual Observable execution boundary without `Observable` class, `lift`, or prototype methods.

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

---

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

- `docs/ARCHITECTURE.md` — realized functional kernel and state ownership.
- `docs/SEMANTICS.md` — RxJS 7.8.2 semantic invariants that must survive reimplementation.
- `docs/FUNCTIONAL-RUNTIME.md` — functional decomposition and policy-composition heuristics.
- `docs/ES3-TO-FP-MAPPING.md` — how to read the ES3 runtime without copying its OO architecture.
- `docs/RXJS-7.8.2-PARITY.md` — continuously updated parity scoreboard.
- `docs/EXECUTION-PLAN.md` — milestone order and completion gates.
- `AGENTS.md` — mandatory implementation rules for automated coding agents and contributors.

## License

Apache-2.0. RxJS reference material retains its corresponding Apache-2.0 license notice under `reference/`.
