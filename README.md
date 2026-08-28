# rxjs-pure-fp

A modern functional reimplementation experiment targeting **RxJS 7.8.2 behavior and feature capability without classes, inheritance, or prototype architecture**.

> **RxJS 7.8.2 defines the behavior. `rxjs-pure-fp` defines a different implementation architecture.**

## Why this project exists

RxJS 7.8.2 exposes a small runtime object model around `Observable`, `Subscriber`, `Subscription`, Subjects, schedulers, and operators. A previous experiment downlevel-compiled RxJS 7.8.2 to ES3/CommonJS. That experiment removed modern `class` syntax, but revealed that the generated runtime was still constructor/prototype OO.

`rxjs-pure-fp` asks the stronger question:

> Can the complete RxJS 7.8.2 reactive machine be reconstructed from functions, closures, structural records, and policy composition while preserving observable behavior?

This is not intended to be a smaller "Rx-like" library. The long-term target is RxJS 7.8.2 feature equality, continuously measured against the real `rxjs@7.8.2` package.

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
- **The ES3 downlevel reference** exposes runtime responsibilities without TypeScript class syntax, but is never copied as the target architecture.
- **`rxjs-pure-fp`** reconstructs those responsibilities functionally.

## Architectural rules

Runtime source under `src/` must not introduce project-defined classes, inheritance, `super`, prototype mutation, constructor/prototype OO disguised as functions, or a global registry holding per-execution state.

The project prefers:

- functions over classes;
- composition over inheritance;
- closures over instance fields;
- structural types over nominal hierarchies;
- policies over subclass variation;
- standalone functions over prototype methods;
- state allocated at the narrowest lifetime that needs it.

An AST-based architecture gate enforces these rules. The current source gate is intentionally stronger than required at runtime: even type-level `extends` is absent from `src/`; type composition uses intersections.

## Runtime mental model

```text
Observable     = lazy execution function
Subscriber     = notification participation + lifecycle
Subscription   = teardown lifecycle closure
Operator       = Observable<A> -> Observable<B>
Subject        = multicast closure
Scheduler      = execution-time policy
```

After M03 the first three layers are no longer merely a plan. They are working code with differential evidence:

```text
Observable execution function
          │
          ▼
Subscriber notification record
          │
          ▼
Subscription lifecycle closure
```

---

# Current status — M03 Functional Observable

M03 reconstructs the RxJS execution boundary without an `Observable` class.

## M03 representation

The core type is deliberately small:

```ts
type Observable<T> =
  (subscriber: Subscriber<T>) => TeardownLogic;
```

`createObservable(initializer)` returns a lazy execution function. Creating the function does not execute the initializer.

```text
createObservable(initializer)
        │
        └── returns lazy execution function
                    │
                    │ subscribe(...)(source)
                    ▼
              initializer runs
```

Each subscription invokes the execution function again and therefore receives independent ordinary execution state.

## Standalone subscription

The canonical FP subscription boundary is data-last and curried:

```ts
const subscription = subscribe({
  next: value => console.log(value),
  error: error => console.error(error),
  complete: () => console.log('complete')
})(source$);
```

`subscribe` performs four jobs:

```text
observer/callbacks
      │
      ▼
M02 safe Subscriber
      │
      ▼
execute source
      │
      ▼
returned TeardownLogic
      │
      ▼
M01 subscriber.add(teardown)
```

Source execution is wrapped in the same error-context behavior used by RxJS 7.8.2. A synchronous exception thrown by a source enters the Subscriber error channel rather than escaping the normal subscription path.

## The synchronous completion / returned teardown case

One of the most important M03 tests is this ordering:

```text
source starts
   │
   ├── next(...)
   ├── complete()
   │      └── Subscriber is now closed
   │
   └── source returns teardown
                │
                ▼
        subscriber.add(teardown)
                │
                ▼
      add-to-closed runs teardown now
```

This requires no Observable-specific special case. M03 inherits the correct behavior from the M01 lifecycle contract. That is strong evidence that the functional layers are composing correctly.

## Source cancellation

A non-terminal source can return teardown work:

```ts
const source$ = createObservable(subscriber => {
  const handle = startWork(value => subscriber.next(value));
  return () => stopWork(handle);
});
```

Manual unsubscription runs that teardown without creating a synthetic `complete()` notification.

## Existing Subscriber identity

Standalone `subscribe` accepts an already-created functional Subscriber. It uses the same record rather than wrapping it in another lifecycle object.

This preserves identity-sensitive ownership semantics introduced by M01 and M02.

## Constructor initializer `this`

RxJS constructor initializers are invoked with the Observable instance as `this`. Even though `rxjs-pure-fp` has no Observable instance, M03 preserves the useful semantic relationship:

```text
initializer this === functional Observable execution function
```

`createObservable` uses `Reflect.apply` to provide the returned Observable function as the initializer context. No prototype mechanism is required.

## Observable parity name

RxJS 7.8.2 root-exports `Observable`, so M03 provides that parity name as a normal functional factory:

```ts
const source$ = Observable(subscriber => {
  subscriber.next(1);
  subscriber.complete();
});
```

The deprecated `Observable.create(...)` capability is retained as a function property.

`new Observable()` intentionally fails. Constructibility is an OO invocation detail, not part of the pure functional kernel contract.

## `pipe` and `pipeValue`

RxJS already root-exports a standalone `pipe` function, so M03 preserves its RxJS 7.8.2 meaning: compose unary functions and return one unary function.

```ts
const transform = pipe(
  plusOne,
  double
);

transform(3); // 8
```

The project also wants the direct Callbag-style/data-first form. That is exposed explicitly as a functional extension rather than silently changing RxJS's exported `pipe` semantics:

```ts
pipeValue(
  source$,
  operatorA,
  operatorB
);
```

This distinction keeps export parity honest.

## M03 verification status

Latest verified M03 evidence:

- **24 / 24 unit tests** pass across M00-M03;
- **8 new M03 differential traces** match `rxjs@7.8.2`;
- **25 / 25 total differential tests** pass;
- architecture gate passes for **8 TypeScript runtime source files**;
- ESM, CommonJS, and declaration builds pass;
- distribution architecture check passes for **16 emitted JavaScript files**;
- RxJS root export parity is **6 / 175 = 3.4%**;
- implemented root parity names now include `Observable` and `pipe` in addition to the M01-M02 exports;
- deliberate functional root extensions: `createSubscription`, `createSubscriber`, `createObservable`, `subscribe`, `pipeValue`;
- unexpected root exports: **0**.

The eight M03 differential scenarios cover:

1. synchronous completion followed by returned teardown;
2. source exception routing;
3. independent executions per subscription;
4. direct cancellation without completion;
5. existing Subscriber identity reuse;
6. returned child Subscription ownership;
7. initializer `this` identity;
8. RxJS-compatible standalone `pipe` composition.

---

# Kernel established by M01-M03

## M01 — lifecycle

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

M01 established idempotent cancellation, nested ownership, explicit removal, structural unsubscribables, add-after-close behavior, ordered teardown, and aggregated unsubscription errors.

## M02 — notification participation

```text
M01 Subscription record
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
```

M02 preserved the distinction between raw Subscriber forwarding and safe user-consumer handling. It also established asynchronous `onUnhandledError` and stopped-notification behavior.

## M03 — lazy execution

```text
createObservable(initializer)
          │
          ▼
lazy execution function
          │
      subscribe(...)
          │
          ▼
M02 Subscriber
          │
          ▼
M01 teardown ownership
```

This is the first complete functional runtime skeleton. M04 now needs to add values and transformations rather than redesigning execution mechanics.

---

# Milestone roadmap

### M00 — Foundation ✅

Established the RxJS 7.8.2 behavioral oracle, immutable ES3 reference boundary, architecture enforcement, differential testing, export measurement, reproducible build system, and canonical documentation.

### M01 — Functional Subscription ✅

Replaced `Subscription` class architecture with closure-owned lifecycle state and a structural record. Seven differential lifecycle traces match RxJS 7.8.2.

### M02 — Functional Sink ✅

Replaced `Subscription ← Subscriber ← SafeSubscriber` inheritance with composition of lifecycle, lexical notification state, structural functions, and a safe consumer adapter. Nine new differential traces match RxJS 7.8.2.

### M03 — Functional Observable ✅

Replaced the Observable class execution boundary with a lazy execution function plus standalone `subscribe`. Eight new differential traces match RxJS 7.8.2. The M01-M03 functional kernel is now operational.

### M04 — First Functional RxJS Pipeline — next

Prove the complete value path with `of`, `map`, `filter`, `pipeValue`, and standalone `subscribe`. The goal is the first end-to-end RxJS pipeline implemented entirely on the functional kernel.

### M05 — Projection & Querying

Expand the first operator slice into the projection/querying family: `map`, `filter`, `tap`, `scan`, `reduce`, `pairwise`, and distinct variants, with differential behavior tests for transformation, accumulation, selection, completion, and error paths.

### M06 — Selection & Gating

Implement positional, value-driven, and notifier-driven selection: take/skip families, first/last/single/elementAt, and related termination semantics.

### M07 — Higher-Order Kernel

Build the shared inner-subscription machinery needed to project source values into inner Observables and track their independent lifecycles.

### M08 — Flattening Policies

Express `mergeMap`, `concatMap`, `switchMap`, and `exhaustMap` as policies over the higher-order kernel, together with their flattening relatives.

### M09 — Multi-Source Coordination

Implement merge, concat, combineLatest, zip, race, forkJoin, withLatestFrom, and their coordination/termination rules.

### M10 — Functional Subjects

Implement Subject as a multicast closure, then compose BehaviorSubject, ReplaySubject, and AsyncSubject through explicit state/replay/completion policies rather than inheritance.

### M11 — Sharing Topology

Implement connectable, connect, share, shareReplay, and multicast lifecycle semantics.

### M12 — Error & Resubscription

Implement catchError, retry, retryWhen, repeat, repeatWhen, finalize, and related resubscription behavior.

### M13 — Scheduler Kernel

Replace scheduler/action inheritance with a functional clock, queue, request/cancel, and flush policy kernel.

### M14 — Temporal Operators

Implement timer, interval, delay, debounce, audit, throttle, sample, timeout, and related time-dependent behavior.

### M15 — Boundary & Collection

Implement buffer, window, groupBy, and related boundary/collection families.

### M16 — Platform Sources

Implement event sources, callback adapters, ajax, fetch, and WebSocket integration with cancellation semantics.

### M17 — Testing Runtime

Recover virtual time and TestScheduler-equivalent capability without scheduler class architecture.

### M18 — Remaining RxJS 7.8.2 Surface

Close gaps for uncommon and deprecated-but-public behavior required by the feature-equality target.

### M19 — Package Parity

Complete public subpath exports, declarations, ESM/CommonJS surfaces, and package compatibility. Full export parity becomes strict here.

### M20 — Differential Certification

Run the complete behavioral/export parity matrix and certify the target: same observable behavior, different runtime architecture.

---

# Four implementation sessions

M00 is the foundation outside the 20 runtime milestones. The runtime plan is grouped into four five-milestone working sessions:

```text
Session 1  M01-M05   core kernel + first operator families
Session 2  M06-M10   gating + higher-order + coordination + Subjects
Session 3  M11-M15   sharing + recovery + scheduling + time + boundaries
Session 4  M16-M20   platform + testing + remaining surface + certification
```

---

## Reference material

`reference/rxjs-7.8.2-es3/` contains an immutable execution-core slice of the verified ES3/CommonJS build: `Subscription`, `Subscriber`, `Observable`, `OperatorSubscriber`, and representative `map`. It is read-only anatomy material.

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

`npm run verify` runs typecheck, repository lint, architecture validation, unit tests, differential tests, builds, export parity, and distribution architecture checks.

## Documentation

- `docs/ARCHITECTURE.md` — realized and target functional architecture.
- `docs/SEMANTICS.md` — RxJS 7.8.2 invariants that must survive the rewrite.
- `docs/FUNCTIONAL-RUNTIME.md` — functional decomposition and policy heuristics.
- `docs/ES3-TO-FP-MAPPING.md` — how to use the ES3 runtime as anatomy rather than target architecture.
- `docs/RXJS-7.8.2-PARITY.md` — continuously updated parity scoreboard.
- `docs/EXECUTION-PLAN.md` — milestone order and completion gates.
- `AGENTS.md` — mandatory coding-agent and contributor rules.

## License

Apache-2.0. RxJS reference material retains its corresponding Apache-2.0 notices under `reference/`.
