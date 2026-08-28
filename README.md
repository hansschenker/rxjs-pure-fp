# rxjs-pure-fp

A modern functional reimplementation experiment targeting **RxJS 7.8.2 behavior and feature capability without classes, inheritance, or prototype architecture**.

> **RxJS 7.8.2 defines the behavior. `rxjs-pure-fp` defines a different implementation architecture.**

## Why this project exists

RxJS 7.8.2 exposes a small runtime object model around `Observable`, `Subscriber`, `Subscription`, Subjects, schedulers, and operators. A previous experiment downlevel-compiled RxJS 7.8.2 to ES3/CommonJS. That experiment removed modern `class` syntax, but the generated runtime was still constructor/prototype OO.

`rxjs-pure-fp` asks the stronger question:

> Can the complete RxJS 7.8.2 reactive machine be reconstructed from functions, closures, structural records, and policy composition while preserving observable behavior?

RxJS 7.8.2 is the behavioral oracle. The ES3 build is anatomy material. The implementation architecture belongs to this project.

## Architectural rules

Runtime source under `src/` must not introduce project-defined classes, inheritance, `super`, prototype mutation, constructor/prototype OO disguised as functions, or a global registry holding per-execution state.

The project prefers functions over classes, composition over inheritance, lexical state over instance fields, structural types over nominal hierarchies, policies over subclass variation, and standalone functions over prototype methods.

The state rule is:

> **State belongs to the narrowest lifetime that requires it.**

An AST architecture gate enforces the source rules, including the intentionally strong rule that runtime TypeScript does not use type-level `extends`.

---

# Current status — M04 First Functional RxJS Pipeline

M04 proves that the M01-M03 kernel can now perform actual RxJS work end to end:

```text
creation
   │
   ▼
Observable
   │
   ▼
map
   │
   ▼
filter
   │
   ▼
subscribe
   │
   ▼
next / complete / teardown
```

The canonical M04 demonstration is:

```ts
const result$ = pipeValue(
  of(1, 2, 3),
  map(value => value * 10),
  filter(value => value > 10)
);

subscribe({
  next: console.log
})(result$);
```

Output:

```text
20
30
```

This is the first complete RxJS pipeline implemented entirely by the functional runtime.

## M04 creation source — `of`

`of(...values)` creates a lazy Observable that synchronously emits each argument as one value and then completes.

```text
of(a, b, c)
    │
 subscribe
    │
    ├── next(a)
    ├── next(b)
    ├── next(c)
    └── complete()
```

Like RxJS's array-like source loop, it checks the Subscriber's closed state before each next emission. If synchronous downstream cancellation closes the chain, source iteration stops immediately.

`of([1, 2, 3])` emits the array as one value; it does not flatten it.

The deprecated scheduler overload belongs to the later scheduler milestones and is not claimed by M04.

## Operator algebra becomes executable

M04 commits the core operator type:

```ts
type OperatorFunction<A, B> =
  (source: Observable<A>) => Observable<B>;
```

An operator is therefore a unary Observable transformer:

```text
Observable<A>
     │
 operator
     │
     ▼
Observable<B>
```

Operator construction is lazy. Calling `map(project)` or applying the resulting operator to a source does not subscribe to the source.

## Functional replacement for `lift`

The internal `operate` helper constructs a new lazy Observable directly:

```text
operate(init)
    │
    ▼
source => createObservable(destination => init(source, destination))
```

No `Observable.prototype.lift`, Operator object, or class hierarchy is required.

## Functional OperatorSubscriber

RxJS uses `OperatorSubscriber extends Subscriber`. M04 instead creates an ordinary functional Subscriber configured as the upstream participant for an operator.

```text
source Observable
      │
      ▼
operator Subscriber
      │
      ▼
downstream Subscriber
```

The operator Subscriber intercepts source `next` notifications, catches failures from operator callbacks, routes those failures to the downstream error channel, and forwards error/complete notifications.

### Ownership must exist before source execution

The subtle ordering is important:

```text
create operator child Subscriber
             │
             ▼
destination.add(child)
             │
             ▼
subscribe child to source
```

The child is attached to the downstream lifecycle **before** the source starts.

That means a downstream consumer can synchronously unsubscribe during `next`, and cancellation immediately propagates upstream:

```text
of loop
  │
  ├── next(10)
  ├── next(20)
  │       │
  │       └── downstream.unsubscribe()
  │                │
  │                └── closes operator children
  │
  └── source sees child.closed and stops looping
```

M04 differentially tests this through a two-operator chain.

## `map`

`map(project)` creates one transformed output for each accepted source value.

Its mutable index is allocated inside the per-subscription initializer:

```text
pipeline construction           each subscription
---------------------           -----------------
capture project                 index = 0
no execution state              create operator child
                                source executes
```

Two subscriptions to the same mapped Observable therefore each start with index 0.

Projection failures are caught at the operator boundary and sent through `error`, which synchronously tears down the chain.

The deprecated RxJS `thisArg` behavior is preserved with `Reflect.apply`, not prototype binding.

## `filter`

`filter(predicate)` uses the same functional operator mechanism, but only forwards source values for which the predicate returns true.

Its predicate index is also per subscription. Predicate failures enter the downstream error channel and stop the synchronous source.

The deprecated `thisArg` behavior is likewise preserved with `Reflect.apply`.

## Pure functions inside, reactive plumbing outside

M04 already demonstrates the intended programming style:

```ts
const price = (amount: number) => amount * 1.2;
const isLarge = (amount: number) => amount > 100;

const result$ = pipeValue(
  source$,
  map(price),
  filter(isLarge)
);
```

The domain functions know nothing about Observables. `map` and `filter` provide only the reactive plumbing around them.

## M04 differential evidence

Eight new M04 traces match `rxjs@7.8.2`:

1. first `of → map → filter → subscribe` pipeline;
2. map/filter index reset for each subscription;
3. map projection failure behavior;
4. filter predicate failure behavior;
5. synchronous downstream cancellation through an operator chain;
6. `of` value-shape/non-flattening behavior;
7. deprecated map/filter `thisArg` behavior;
8. raw downstream `next` failure through `map`.

The last two lifecycle/error scenarios show that the operator Subscriber is not merely a value transformer; it participates correctly in RxJS subscription topology.

## M04 verification status

Latest verified evidence:

- **32 / 32 unit tests** pass;
- **8 new M04 differential traces** match RxJS 7.8.2;
- **33 / 33 total differential tests** pass;
- architecture gate passes for **12 TypeScript source files**;
- ESM, CommonJS, and declaration builds pass;
- distribution architecture check passes for **24 emitted JavaScript files**;
- RxJS root export parity is **9 / 175 = 5.1%**;
- root parity additions in M04: `of`, `map`, `filter`;
- deliberate functional extensions remain **5**;
- unexpected root exports: **0**.

---

# Functional kernel after M04

```text
                    source factory
                         │
                         ▼
                  Observable function
                         │
               ┌─────────┴─────────┐
               │                   │
            operator            subscribe
               │                   │
               ▼                   ▼
       Observable function      Subscriber
               │                   │
               └──────────┬────────┘
                          ▼
                    Subscription
                       teardown
```

In compact type form:

```ts
type Observable<T> =
  (subscriber: Subscriber<T>) => TeardownLogic;

type OperatorFunction<A, B> =
  (source: Observable<A>) => Observable<B>;
```

The runtime now has enough machinery for most first-order RxJS operators without introducing another object model.

---

# Milestone roadmap

### M00 — Foundation ✅

Behavioral oracle, ES3 reference boundary, architecture gates, differential harness, builds, parity tooling, and canonical documentation.

### M01 — Functional Subscription ✅

Closure-owned teardown lifecycle. Seven differential traces.

### M02 — Functional Sink ✅

Notification participation composed onto lifecycle state. Nine new differential traces.

### M03 — Functional Observable ✅

Lazy Observable execution function and standalone subscription. Eight new differential traces.

### M04 — First Functional RxJS Pipeline ✅

Implemented `of`, `map`, `filter`, the functional operator plumbing, synchronous cancellation propagation, and the first complete pipeline. Eight new differential traces.

### M05 — Projection & Querying — next

Expand the first-order operator vocabulary with `tap`, `scan`, `reduce`, `pairwise`, and the distinct family. M05 will also generalize the functional OperatorSubscriber for custom terminal/finalization policies where required.

### M06 — Selection & Gating

Take/skip families, positional/value/notifier gating, first/last/single/elementAt, and termination behavior.

### M07 — Higher-Order Kernel

Shared inner-subscription execution machinery.

### M08 — Flattening Policies

`mergeMap`, `concatMap`, `switchMap`, `exhaustMap` and flattening relatives as policies over the higher-order kernel.

### M09 — Multi-Source Coordination

Merge/concat/combineLatest/zip/race/forkJoin/withLatestFrom.

### M10 — Functional Subjects

Subject plus BehaviorSubject, ReplaySubject, and AsyncSubject via state policies rather than inheritance.

### M11 — Sharing Topology

Connectable/connect/share/shareReplay and multicast semantics.

### M12 — Error & Resubscription

catchError/retry/retryWhen/repeat/repeatWhen/finalize.

### M13 — Scheduler Kernel

Functional clock/queue/request/cancel/flush policies.

### M14 — Temporal Operators

Timer/interval/delay/debounce/audit/throttle/sample/timeout.

### M15 — Boundary & Collection

Buffer/window/groupBy families.

### M16 — Platform Sources

Events/callbacks/ajax/fetch/WebSocket.

### M17 — Testing Runtime

Virtual time and TestScheduler-equivalent capability.

### M18 — Remaining 7.8.2 Surface

Close uncommon and deprecated-but-public feature gaps.

### M19 — Package Parity

Subpath exports, declarations, ESM/CJS package surfaces, strict package compatibility.

### M20 — Differential Certification

Final behavioral/export parity matrix.

---

# Four implementation sessions

M00 is the foundation outside the 20 runtime milestones.

```text
Session 1  M01-M05   core kernel + first-order operators
Session 2  M06-M10   gating + higher-order + coordination + Subjects
Session 3  M11-M15   sharing + recovery + scheduling + time + boundaries
Session 4  M16-M20   platform + testing + remaining surface + certification
```

---

## Development

```bash
npm ci
npm run oracle:exports:check
npm run verify
```

`npm run verify` executes typecheck, repository lint, architecture validation, unit tests, differential tests, builds, export parity, and distribution architecture checks.

## Reference material

`reference/rxjs-7.8.2-es3/` contains an immutable verified ES3/CommonJS execution-core slice used only as runtime anatomy material.

Original ES3 artifact SHA-256:

```text
b274b8fb3d87c47b96623965abd67cf218a2bd5ec4e0ae856a0455641a5799c9
```

## License

Apache-2.0. RxJS reference material retains its Apache-2.0 notices under `reference/`.
