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

# Root parity after Session 1

Implemented RxJS 7.8.2 root exports:

```text
Core runtime
  Observable
  Subscriber
  Subscription
  UnsubscriptionError
  config
  pipe

Creation
  of

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
```

That is **16 / 175 = 9.1%** of the root export names.

The number should not be read as “9.1% of the engineering is done.” M01-M05 establish reusable runtime machinery that many later exports can share.

## Deliberate functional extensions

These are tracked separately and never counted as RxJS parity:

- `createSubscription`
- `createSubscriber`
- `createObservable`
- `subscribe`
- `pipeValue`

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

### M06 — Selection & Gating — next session
Implement take/skip families plus first/last/single/elementAt and value/notifier-driven gating.

### M07 — Higher-Order Kernel
Build reusable inner-subscription execution machinery.

### M08 — Flattening Policies
Implement mergeMap/concatMap/switchMap/exhaustMap and flattening relatives as policies over M07.

### M09 — Multi-Source Coordination
Merge/concat/combineLatest/zip/race/forkJoin/withLatestFrom.

### M10 — Functional Subjects
Subject plus BehaviorSubject/ReplaySubject/AsyncSubject through state policies instead of inheritance.

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
Session 2  M06-M10      gating + higher-order + coordination + Subjects
Session 3  M11-M15      sharing + recovery + scheduling + time + boundaries
Session 4  M16-M20      platform + testing + remaining surface + certification
```

The next working session starts at **M06** and finishes at **M10**.

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
