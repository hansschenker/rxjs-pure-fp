# rxjs-pure-fp

A modern functional reimplementation experiment targeting **RxJS 7.8.2 behavior and feature capability without classes, inheritance, or prototype architecture**.

> **RxJS 7.8.2 defines the behavior. `rxjs-pure-fp` defines a different implementation architecture.**

## Mission

`rxjs-pure-fp` asks whether the complete RxJS 7.8.2 reactive machine can be reconstructed from functions, closures, structural records, and policy composition while preserving its observable semantics.

This is not a smaller Rx-like library. RxJS 7.8.2 is pinned as the behavioral oracle, and every milestone compares the functional runtime against it.

The verified ES3/CommonJS build is used only as anatomy material: it exposes what the historical classes actually do at runtime, but its constructor/prototype architecture is not copied.

## Architectural rules

Runtime code under `src/` must not use:

- project-defined classes;
- inheritance or `super`;
- prototype mutation;
- constructor/prototype OO disguised as functions;
- module-global registries for per-execution state.

The project uses:

- functions over classes;
- composition over inheritance;
- closure-owned state over instance fields;
- structural records over nominal hierarchies;
- higher-order policies over subclass polymorphism;
- standalone functions over prototype methods.

The governing state rule is:

> **State belongs to the narrowest lifetime that requires it.**

An AST gate enforces the architecture. The source rule is intentionally strict enough that even type-level `extends` is absent from runtime TypeScript.

---

# Session 1 complete — M01 through M05 ✅

M00 established the measuring instruments. Session 1 reconstructed the first functional RxJS runtime kernel and then proved that the same kernel can express a useful first-order operator vocabulary.

```text
M00  measurement foundation
 │
M01  Subscription lifecycle
 │
M02  Subscriber / notification participation
 │
M03  Observable / lazy execution
 │
M04  first complete pipeline: of → map → filter
 │
M05  first-order behavioral policies
```

The concrete runtime after M05 is:

```text
creation source
      │
      ▼
Observable execution function
      │
      ▼
operator Subscriber(s)
      │
      ▼
destination Subscriber
      │
      ▼
Subscription lifecycle
```

Values flow downstream while lifecycle ownership and cancellation propagate upstream:

```text
values / notifications      upstream ─────────► downstream
ownership / cancellation    upstream ◄───────── downstream
```

---

# M05 — Projection & Querying

M05 expands the operator layer from `map`/`filter` into four reusable state/behavior policies:

```text
Observe without changing      tap
Accumulate                     scan, reduce
Remember adjacency             pairwise
Remember uniqueness           distinct, distinctUntilChanged,
                              distinctUntilKeyChanged
```

The important result is that **none of these behaviors required another runtime object model**. They are all configurations of the functional Observable + Subscriber + Subscription kernel.

## Generalized functional OperatorSubscriber

M04 needed only an `onNext` interceptor. M05 generalizes the same child Subscriber with optional policies:

```text
createOperatorSubscriber(
  destination,
  onNext?,
  onComplete?,
  onError?,
  onFinalize?
)
```

Conceptually:

```text
source notification
       │
       ▼
functional operator Subscriber
       │
       ├── onNext policy
       ├── onError policy
       ├── onComplete policy
       └── onFinalize policy
       │
       ▼
destination Subscriber
```

No subclass is created. The operator child is still an ordinary structural Subscriber composed from the M02 machinery.

### Finalization is part of Subscriber lifecycle

`tap` exposed a subtle RxJS timing rule that cannot be reproduced by simply registering `finalize` as another late teardown.

For a live/asynchronous source whose teardown is already attached:

```text
explicit unsubscribe
       │
       ├── source teardown
       ├── tap.unsubscribe
       └── tap.finalize
```

But a source can complete synchronously **before it returns its teardown**:

```text
source complete
     │
operator child closes
     │
     ├── tap.complete
     ├── destination.complete
     └── tap.finalize
     │
source initializer continues
     │
source returns teardown
     │
add-to-closed executes teardown
```

So M05 introduces an internal Subscriber finalization hook that runs after the lifecycle work available at the instant of unsubscription. That reproduces both orderings without classes.

---

## `tap` — observe without transforming

`tap` mirrors source notifications while performing side effects.

```text
source value a
     │
     ├── tap.next(a)   side effect
     │
     └───────────────► downstream a
```

M05 supports the RxJS 7.8.2 tap observer lifecycle:

- `subscribe` when source subscription begins;
- `next` before forwarding each value;
- `error` before forwarding source error;
- `complete` before forwarding completion;
- `unsubscribe` only for explicit/unexpected cancellation, not normal error/complete;
- `finalize` for every ordinary finalization path.

Synchronous failures thrown by tap handlers become errors from the tapped Observable, as in RxJS.

`tap()`/`tap(null, null, null)` remains an identity operator.

---

## `scan` and `reduce` — one accumulation machine

RxJS implements `scan` and `reduce` from the same underlying accumulation policy. M05 preserves that architecture functionally.

Shared per-subscription state:

```text
hasState
state
index
```

The policy axes are:

```text
has seed?              yes / no
emit accumulated state on next?     scan = yes
emit accumulated state before complete? reduce = yes
```

### `scan`

Without seed:

```text
source     1 ── 2 ── 3 ──|
state      1    3    6
output     1 ── 3 ── 6 ──|
```

The first source value becomes state without invoking the accumulator. The first accumulator call therefore receives index `1`.

With a seed:

```text
seed = 0
source     1 ── 2 ── 3
index      0    1    2
output     1 ── 3 ── 6
```

### Explicit `undefined` is a real seed

This is an important RxJS API subtlety:

```ts
scan(accumulator)
```

and

```ts
scan(accumulator, undefined)
```

are different calls.

M05 uses `arguments.length >= 2`, exactly because `seed !== undefined` would destroy that distinction.

### `reduce`

`reduce` uses the same machine but emits only once, immediately before completion.

```text
source     1 ── 2 ── 3 ──|
state      1    3    6
output                    6 ──|
```

For an empty source:

- no seed → complete without a value;
- explicit seed, even `undefined` → emit that seed, then complete.

---

## `pairwise` — adjacent memory

`pairwise` needs only two per-subscription variables:

```text
previous
hasPrevious
```

```text
source     a ── b ── c ── d
output         [a,b] [b,c] [c,d]
```

The first value is remembered but not emitted. Every subscription starts with empty previous-value state.

---

# Distinctness family

M05 makes the three different meanings of “distinct” explicit.

## `distinct` — remember all keys

```text
seen = Set()
```

Each selected key is emitted once for the lifetime of one subscription.

```text
source     1  1  2  1  3  2
output     1     2     3
```

A key selector can define identity independently of the emitted value.

`Set` semantics matter: `NaN` is equal to `NaN` under JavaScript Set/SameValueZero semantics, so multiple NaN values produce one distinct emission.

### Flush policy

RxJS allows a second input that clears the internal Set. M05 implements and differentially certifies the behavior for **functional Observable flush sources**:

```text
seen: {1}
source 1 again        blocked
flush emission        seen.clear()
source 1 again        emitted
```

Full RxJS `ObservableInput` conversion for arbitrary flush inputs is not yet claimed; that belongs to the later input/interoperability surface.

## `distinctUntilChanged` — remember only the last emitted key

This operator remembers one key, not the whole history.

```text
source     1  1  2  2  1  1
output     1     2     1
```

Default comparison is JavaScript `===`, which gives a useful contrast with `distinct`:

```text
distinct(NaN, NaN, NaN)               → one NaN

distinctUntilChanged(NaN, NaN, NaN)   → three NaN values
```

### Reentrancy rule

The selected key is stored **before** the downstream value is emitted:

```text
select current key
      │
update previous key
      │
      ▼
destination.next(value)
```

That ordering matters if downstream code re-enters the source synchronously. M05 has a differential reentrancy test for it.

A custom comparator and a key selector are supported, and the key selector runs for the first value too.

## `distinctUntilKeyChanged` — consecutive object-key comparison

This is expressed from `distinctUntilChanged` rather than implemented as a separate state machine:

```text
distinctUntilKeyChanged(key, compare?)
        │
        ▼
distinctUntilChanged(
  compare selected object properties
)
```

This is a direct example of operator implementation through operator algebra rather than class specialization.

---

# M05 verification

Latest verified M05 evidence:

- **48 / 48 unit tests** pass across M00-M05;
- **16 new M05 differential traces** match `rxjs@7.8.2`;
- **49 / 49 total differential tests** pass;
- architecture gate passes across **20 TypeScript source files**;
- ESM, CommonJS, and declaration builds pass;
- distribution architecture check passes across **40 emitted JavaScript files**;
- RxJS root export parity is **16 / 175 = 9.1%**;
- declared functional root extensions remain **5**;
- unexpected root exports: **0**.

The 16 M05 differential scenarios cover:

1. tap synchronous completion/finalize timing;
2. tap explicit-unsubscribe ordering;
3. tap next-handler error behavior;
4. scan without seed;
5. scan with explicit `undefined` seed;
6. scan accumulator failure;
7. reduce seed/no-seed indexes and completion emission;
8. empty reduce seed behavior;
9. pairwise state and per-subscription reset;
10. distinct all-history memory;
11. distinct key selection;
12. live distinct Set flushing;
13. NaN semantics across distinct policies;
14. distinctUntilChanged reentrancy;
15. distinctUntilChanged key selector/comparator;
16. distinctUntilKeyChanged custom key comparison.

---

# Between sessions — the F1-F8 functional deepening

Before Session 2, the roadmap in `docs/FP-ROADMAP.md` was executed in full. The source now separates a **pure kernel** (`src/kernel/**` — no `this`, no `Reflect`, no module-scope mutability, no host timers outside the runtime-env seam, gate-enforced) from the **RxJS 7.8.2 compat surface** (`src/compat/**`). First-order operators are derived from exported pure step functions run by one `statefulOperator` runner; sink transformers give a contravariant operator encoding; teardown is an error-aggregating monoid; runtime policy enters as an explicit `RuntimeEnv`; and the named algebras have executable law tests (`docs/SEMANTICS.md`).

---

# M06 — Selection & Gating

M06 answers a different question than M05: not *how values transform*, but **when participation ends or begins**.

## Terminal emissions

The step-function emission ADT gains two terminal variants:

```text
Emit<R> = none | one(value) | last(value) | done
```

`last` emits then completes (take's next-then-complete ordering); `done` completes silently; steps that need the error channel throw. Selection operators are then mostly pure steps:

```text
positional end        take          counter step ending in `last`
positional begin      skip          filter by index (operator algebra)
value-driven end      takeWhile     predicate step ending in `last`/`done`
value-driven begin    skipWhile     gate-flag step
notifier-driven end   takeUntil     fused two-source topology
notifier-driven begin skipUntil     fused two-source topology
tail selection        takeLast, skipLast    fused sliding/ring buffers
emptiness policy      defaultIfEmpty, throwIfEmpty   one presence step + flush
termination           first, last, single, elementAt operator algebra
```

`first`, `last`, and `elementAt` are pure compositions — `filter` → `take`/`takeLast` → `defaultIfEmpty`/`throwIfEmpty` — exactly as in RxJS itself. `single` is one pure step plus a completion flush whose error paths (`SequenceError`, `NotFoundError`, `EmptyError`) are throws routed downstream by the runner.

## Notifier semantics

`takeUntil` subscribes its notifier **before** the source: a synchronously firing notifier completes the result before the source ever executes. Notifier completion is swallowed; notifier errors are errors of the result. `skipUntil` opens its gate on the first notifier value and drops the notifier subscription at that instant; a silent notifier leaves the gate closed forever.

## Termination errors

`EmptyError`, `ArgumentOutOfRangeError`, `SequenceError`, and `NotFoundError` are functional factories over platform `Error` (identity via `name`, messages matching RxJS 7.8.2 exactly) — no error class hierarchy. `elementAt` with a negative index throws synchronously at call time.

# M06 verification

- **74 / 74 unit tests** pass;
- **21 new M06 differential traces** match `rxjs@7.8.2`;
- **87 / 87 total differential tests** pass;
- architecture gate passes across **44 TypeScript source files**;
- distribution architecture check passes across **88 emitted JavaScript files**;
- RxJS root export parity is **37 / 175 = 21.1%**;
- declared functional root extensions: **12**;
- unexpected root exports: **0**.

---

# M07 — Higher-Order Kernel

M07 builds the machinery beneath RxJS flattening: **one machine, four policies as data**.

```text
FlatteningPolicy = {
  concurrent   how many inner executions may coexist
  overflow     enqueue | ignore | switch
  settle       finalize | complete
}

overlapPolicy(n)   merge family
queuePolicy        concat family   = overlapPolicy(1)
latestPolicy       switch family
exhaustPolicy      exhaust family
```

`concat` is not a second machine — it is merge at concurrency one, as policy algebra. The `settle` axis records a genuinely observable RxJS asymmetry the differential traces pinned: merge/concat settle a finished inner **after its teardown** (so a completed inner tears down before downstream completion and before the next queued inner subscribes), while switch/exhaust settle **in the complete handler** (downstream completion precedes the inner's teardown).

Certified machine invariants: completion only after outer completion + empty queue + no active inners; cancel-before-project for switch; projection indexes consumed only at projection time (exhaust-ignored values never advance them); projection/inner/outer failures all surfacing as result errors; downstream unsubscription tearing down the outer and every live inner.

M07 adds **no root exports** — the machine is kernel-internal until M08 wraps it into `mergeMap`/`concatMap`/`switchMap`/`exhaustMap` and their relatives.

# M07 verification

- **78 / 78 unit tests** pass;
- **15 new M07 differential traces** match `rxjs@7.8.2` (policy instances traced against mergeMap/concatMap/switchMap/exhaustMap);
- **102 / 102 total differential tests** pass;
- architecture gate passes across **45 TypeScript source files**;
- distribution architecture check passes across **90 emitted JavaScript files**;
- root export parity unchanged at **37 / 175 = 21.1%**, unexpected exports **0**.

---

# M08 — Flattening Policies

M08 is the payoff of M07: the entire public flattening family is **policy application plus operator algebra** — no operator owns its own execution machinery.

```text
mergeMap(p, n)  =  machine + overlapPolicy(n)
concatMap(p)    =  machine + queuePolicy
switchMap(p)    =  machine + latestPolicy
exhaustMap(p)   =  machine + exhaustPolicy

mergeAll(n)     =  mergeMap(identity, n)
concatAll()     =  mergeAll(1)
switchAll()     =  switchMap(identity)
exhaustAll()    =  exhaustMap(identity)
```

Two machine hooks recover the relatives: `mergeScan`/`switchScan` thread a per-subscription accumulator through the machine (`onInnerValue` updates state before each downstream emission; under switchScan only the surviving inner contributes), and `expand` runs the machine in feedback mode — every admitted value is emitted then projected, and inner values re-enter outer admission until the recursion drains.

The deprecated surface is compat: `resultSelector` overloads are recovered by mapping the projected inner with the selector (RxJS's own strategy — exact `(outer, inner, outerIndex, innerIndex)` call sequences differentially verified, including inner-index reset across switch cancellation), and `flatMap`/`mergeMapTo`/`concatMapTo`/`switchMapTo` are aliases over the same kernel operators. `flatMap === mergeMap` holds as reference equality, as in RxJS.

# M08 verification

- **83 / 83 unit tests** pass;
- **17 new M08 differential traces** match `rxjs@7.8.2`;
- **119 / 119 total differential tests** pass;
- architecture gate passes across **57 TypeScript source files**;
- distribution architecture check passes across **114 emitted JavaScript files**;
- RxJS root export parity is **52 / 175 = 29.7%**;
- unexpected root exports: **0**.

---

# M09 — Multi-Source Coordination

Coordinating many sources is, where possible, more flattening algebra:

```text
merge(sources, n)  =  mergeAll(n) over of(...sources)
concat(sources)    =  concatAll() over of(...sources)
*With operators    =  the creation function over [source, ...others]
```

`combineLatest`, `zip`, `race`, `forkJoin`, and `withLatestFrom` are bespoke kernel topologies with **termination and subscription ordering as first-class, differentially pinned dimensions**: eager in-order subscription; combineLatest completing only when *all* sources complete (a valueless completed source leaves it silent but pending); zip completing the instant a completed source's queue empties; race settled by the first value *or* error *or* completion, with a synchronously settling contender preventing later contenders from ever subscribing; forkJoin settling in the finalize hook so a valueless source completes the join immediately; withLatestFrom subscribing companions before the source and ignoring their completions.

The RxJS argument surface (rest args, array form, dictionary form, deprecated selectors, merge's trailing `concurrent`) is compat. One representational discovery: since an Observable here *is a function*, RxJS's trailing-selector heuristic is ambiguous — so `createObservable` now brands the functions it returns (same reference, identity preserved), and selector popping treats branded functions as sources. Raw-function observables use the array forms on those surfaces; recorded as an intentional deviation.

# M09 verification

- **88 / 88 unit tests** pass;
- **19 new M09 differential traces** match `rxjs@7.8.2`;
- **138 / 138 total differential tests** pass;
- architecture gate passes across **70 TypeScript source files**;
- distribution architecture check passes across **140 emitted JavaScript files**;
- RxJS root export parity is **64 / 175 = 36.6%**;
- unexpected root exports: **0**.

---

# M10 — Functional Subjects

Session 2's closing proof: **shared topology from functional state and policies, no inheritance**.

```text
buildSubject(policy)   one multicast hub
Subject                default policies
BehaviorSubject        + current-value policy
ReplaySubject          + size-window replay buffer
AsyncSubject           + last-on-complete policy
Subject.create         + delegate policies (deprecated)
```

A Subject is a branded **callable hub function** — it *is* an Observable — carrying observer methods and live state fields (`closed`, `isStopped`, `hasError`, `thrownError`, `observed`) as plain data properties updated at transition points. Subjects are the project's documented mutable sharing topology (deliberately not frozen). Broadcast iterates a lazily rebuilt snapshot, reproducing RxJS reentrancy semantics exactly.

Two mechanisms fell out of the differential work: `setSubscribePreflight`, the functional analogue of RxJS's `_trySubscribe` override (a closed subject throws `ObjectUnsubscribedError` synchronously at the subscribe call site, while nested executions route it to the error channel), and observer-shape detection in the safe-subscriber boundary (a callable record with observer methods is an observer, not a next-callback).

# M10 verification

- **91 / 91 unit tests** and **148 / 148 differential tests** pass (10 new M10 traces);
- architecture gate: **72 source files**; distribution check: **144 emitted files**;
- RxJS root export parity: **69 / 175 = 39.4%**; unexpected exports: **0**.

---

# Root parity after M10

Implemented RxJS 7.8.2 root exports:

```text
Core runtime
  Observable
  Subscriber
  Subscription
  UnsubscriptionError
  config
  pipe
  identity
  noop

Errors
  EmptyError
  ArgumentOutOfRangeError
  SequenceError
  NotFoundError

Creation
  of
  EMPTY

Projection / querying
  map
  filter
  tap
  scan
  reduce
  pairwise
  distinct
  distinctUntilChanged
  distinctUntilKeyChanged

Selection / gating
  take        takeLast    takeWhile   takeUntil
  skip        skipLast    skipWhile   skipUntil
  first       last        single      elementAt
  defaultIfEmpty          throwIfEmpty

Flattening
  mergeMap    flatMap     concatMap   switchMap   exhaustMap
  mergeAll    concatAll   switchAll   exhaustAll
  mergeMapTo  concatMapTo switchMapTo
  mergeScan   switchScan  expand

Coordination
  merge       concat      combineLatest   zip
  race        forkJoin    withLatestFrom
  mergeWith   concatWith  combineLatestWith
  zipWith     raceWith

Subjects
  Subject     BehaviorSubject   ReplaySubject
  AsyncSubject                  ObjectUnsubscribedError
```

That is **69 / 175 = 39.4%** of the root export names.

## Deliberate functional extensions

These are tracked separately and never counted as RxJS parity:

- `createSubscription`
- `createSubscriber`
- `createObservable`
- `subscribe`
- `pipeValue`
- `mapSink`, `filterSink`, `fuseSinkTransformers`, `liftSinkTransformer`
- `statefulOperator`, `emitNone`, `emitOne`

---

# What Session 1 established

The first five runtime milestones suggest a compact functional core beneath RxJS 7.8.2:

```ts
type Subscription = {
  readonly closed: boolean;
  add(teardown: TeardownLogic): void;
  remove(teardown: Exclude<TeardownLogic, void>): void;
  unsubscribe(): void;
};

type Subscriber<T> = Subscription & {
  readonly isStopped: boolean;
  next(value: T): void;
  error(error: unknown): void;
  complete(): void;
};

type Observable<T> =
  (subscriber: Subscriber<T>) => TeardownLogic;

type OperatorFunction<A, B> =
  (source: Observable<A>) => Observable<B>;
```

Everything implemented in M04-M05 is built on those four structural ideas.

```text
Observable = execution
Subscriber = notification participation
Subscription = lifetime
Operator = Observable transformation
```

The operator families differ primarily in the **policy and per-execution state placed inside the operator child Subscriber**.

---

# Milestone roadmap

### M00 — Foundation ✅
Behavioral oracle, ES3 reference, architecture gate, differential harness, builds, parity tooling, documentation.

### M01 — Functional Subscription ✅
Closure-owned cancellation and teardown lifecycle.

### M02 — Functional Sink ✅
Notification participation composed with lifecycle.

### M03 — Functional Observable ✅
Lazy execution function and standalone subscription.

### M04 — First Functional RxJS Pipeline ✅
`of`, `map`, `filter`, functional operator plumbing, end-to-end execution.

### M05 — Projection & Querying ✅
`tap`, `scan`, `reduce`, `pairwise`, and the distinct family. Generalized functional OperatorSubscriber policies and finalization timing.

### M06 — Selection & Gating ✅
take/skip families, first/last/single/elementAt, value/notifier-driven gating, terminal emission ADT, termination errors.

### M07 — Higher-Order Kernel ✅
One flattening machine with overlap/queue/latest/exhaust as frozen policy records; settle-timing asymmetry captured as policy data.

### M08 — Flattening Policies ✅
mergeMap/concatMap/switchMap/exhaustMap as policy applications; *All operators, *MapTo/flatMap compat aliases, mergeScan/switchScan/expand via machine hooks.

### M09 — Multi-Source Coordination ✅
merge/concat as flattening algebra; combineLatest/zip/race/forkJoin/withLatestFrom topologies; *With operators; observable branding for the functional selector ambiguity.

### M10 — Functional Subjects ✅
One multicast hub + current-value/replay/last-on-complete policies; callable hub records; synchronous ObjectUnsubscribedError preflight.

### M11 — Sharing Topology
connectable/connect/share/shareReplay.

### M12 — Error & Resubscription
catchError/retry/repeat/finalize families.

### M13 — Scheduler Kernel
Functional clock/queue/request/cancel/flush policies.

### M14 — Temporal Operators
timer/interval/delay/debounce/audit/throttle/sample/timeout.

### M15 — Boundary & Collection
buffer/window/groupBy families.

### M16 — Platform Sources
events/callbacks/ajax/fetch/WebSocket.

### M17 — Testing Runtime
virtual time and TestScheduler-equivalent capability.

### M18 — Remaining 7.8.2 Surface
close uncommon and deprecated-but-public gaps.

### M19 — Package Parity
strict subpath/declaration/ESM/CJS compatibility.

### M20 — Differential Certification
final behavioral and export parity matrix.

---

# Four implementation sessions

```text
Session 1  M01-M05   ✅ kernel + first-order operator policies
Session 2  M06-M10   ✅ gating + higher-order + flattening + coordination + Subjects
Session 3  M11-M15      sharing + recovery + scheduling + time + boundaries
Session 4  M16-M20      platform + testing + remaining surface + certification
```

Sessions 1 and 2 are complete. The next working session starts at **M11 — Sharing Topology**.

---

## Development

```bash
npm ci
npm run oracle:exports:check
npm run verify
```

`npm run verify` runs typecheck, repository lint, architecture validation, unit tests, differential tests, builds, export parity, and distribution architecture checks.

## Reference material

`reference/rxjs-7.8.2-es3/` is immutable anatomy material from the verified ES3/CommonJS experiment.

Original artifact SHA-256:

```text
b274b8fb3d87c47b96623965abd67cf218a2bd5ec4e0ae856a0455641a5799c9
```

## License

Apache-2.0. RxJS reference material retains its corresponding Apache-2.0 notices under `reference/`.
