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

# M11 — Sharing Topology

Session 3 opens with explicit sharing over the M10 hub: `share` = one connection + reset behavior as policy data (`resetOnError` / `resetOnComplete` / `resetOnRefCountZero`, each boolean or notifier-factory, with pending resets cancelled on resubscribe); `shareReplay` = `share` with a replay connector and no reset on completion; `connectable` = a branded callable record with an idempotent `connect()`; `connect` = per-subscription multicast for a selector pipeline. The todo-mvu example now uses a real `share()` instead of its manual steps-Subject.

# M11 verification

- **93 / 93 unit tests** and **159 / 159 differential tests** pass (11 new M11 traces);
- architecture gate: **73 source files**; distribution check: **146 emitted files**;
- RxJS root export parity: **73 / 175 = 41.7%**; unexpected exports: **0**.

---

# M12 — Error & Resubscription

Recovery as resubscription policy: `catchError` (selector gets the error *and* the caught observable; synchronous-error switching preserved), `retry` (`count`, `resetOnSuccess`, notifier-factory delays — a delay notifier completing without a value completes the result, an RxJS quirk kept), `repeat` (bounded re-execution with per-attempt teardown), `finalize` (once, after source teardown), and `throwError` (per-subscription error factories). `retry(0)` is the identity operator; `repeat(0)` is `EMPTY`. Numeric delays landed with the M14 timer surface.

# M12 verification

- **95 / 95 unit** and **172 / 172 differential tests** pass (13 new M12 traces);
- RxJS root export parity: **78 / 175 = 44.6%**; unexpected exports: **0**.

---

# M13 — Scheduler Kernel

Execution-time policy, functionally: `runtime.ts` grows a `timerHost` record — the single gate-enforced host edge for clocks, intervals, and microtasks — and `kernel/scheduler.ts` builds one reschedulable action machine over it, with schedulers as frozen policy records: **async** (interval-backed actions with RxJS id recycling, so same-delay self-reschedules keep one ticking interval), **queue** (synchronous trampoline at zero delay), **asap** (one-microtask batching, mid-flush work joins the flush). Work is `(state, action) => void` — the action arrives as a parameter, not `this` — and actions are frozen Subscription records, so cancellation is ordinary unsubscription. `observeOn` and `subscribeOn` ride on top through owned scheduled work.

# M13 verification

- **95 / 95 unit** and **179 / 179 differential tests** pass (7 new async M13 traces: trampoline, ordering, batching, reschedule, cancellation, observeOn, subscribeOn);
- RxJS root export parity: **86 / 175 = 49.1%**; unexpected exports: **0**.

---

# M14 — Temporal Operators

The M13 action machine becomes the public temporal surface. `timer` is the
single time primitive — one reschedulable action emitting a counter — and
most of M14 is algebra over it:

```text
timer(due, interval?)      the primitive
interval(p)              = timer(p, p)
delay(due)               = delayWhen(() => timer(due))
delayWhen(selector)      = mergeMap(v => duration.pipe(take(1), map(() => v)))
debounceTime(t)          = debounce(() => timer(t))
auditTime(t)             = audit(() => timer(t))
throttleTime(t, s, cfg)  = throttle(() => timer(t), cfg)
sampleTime(p)            = sample(interval(p))
timeoutWith(due, alt)    = timeout({ ..., with: () => alt })
```

The four rate-limiting policies are kept distinct because they answer
different questions about a quiet window:

```text
debounce   last value after silence     new value cancels the window
audit      last value per window        first value opens the window
throttle   window edges as policy       leading / trailing as data
sample     last value per notifier tick window is external
```

`throttle`'s `{leading, trailing}` config is policy data over one duration
mechanism; a trailing send re-opens the window itself. Completion interacts
with pending windows differentially: debounce flushes immediately, audit and
a trailing throttle defer completion until the window settles, sample
completes with the source. All of these handshakes are pinned against the
oracle, including synchronous durations.

`timeout` is deadline policy over owned scheduled work — `first` bounds the
initial value, `each` re-arms per value, expiry either switches to the
`with` fallback or throws a `TimeoutError` carrying `{meta, seen, lastValue}`
diagnostics (a functional factory over platform `Error`, like every other
parity error). `retry`/`repeat` numeric `delay` options now route through
`timer`, closing the M12 deferral.

# M14 verification

- **114 / 114 unit** and **202 / 202 differential tests** pass (23 new M14 traces: timer/interval one-shot, Date dues, periodic continuation; delay shifting and undelayed errors; delayWhen reordering and empty-duration drops; debounce/audit/throttle notifier handshakes incl. synchronous durations; sample gating; timeout first/each/fallback/compat; retry/repeat numeric delays);
- RxJS root export parity: **101 / 175 = 57.7%**; unexpected exports: **0**.

---

# M15 — Boundary & Collection

Value boundaries turn the M10 Subject hub and the M14 timer surface into the
buffer and window families. Buffers collect into arrays, windows into emitted
Subjects — each family is one boundary policy in two materializations:

```text
buffer / window              notifier-rolled       one open boundary, rolls per fire
bufferCount / windowCount    count-driven          startEvery overlaps or skips
bufferTime / windowTime      clock-driven          span + creation interval + max size
bufferToggle / windowToggle  toggle-driven         opening value picks its own closer
bufferWhen / windowWhen      selector-cycled       one boundary, re-invoked per cycle
```

Termination fans out: source errors reach every open window before the
result, completion completes open windows before the result; buffers flush
open arrays on completion but drop them on error. The clock-driven pair
rides the M14 scheduler through a repeating `executeSchedule` variant.

`groupBy` demultiplexes into per-key Subjects emitted as key-stamped group
observables, with `element` projection, `duration`-closed groups (the key
can reopen), and `connector` replacement. Its RxJS `shouldUnsubscribe` guard
becomes an explicit reference-counted teardown: while any group still has a
subscriber the source outlives the result subscription, and the last group
teardown releases it. `partition` is the static two-way `filter` split with
independent executions.

The collection queries are reduce/terminal algebra: `count`, `max`/`min`
(seedless reductions; empty sources complete silently), `every` (first
failure emits `false`), `find`/`findIndex` (first hit completes; misses emit
`undefined` / `-1`). Predicates receive `(value, index, source)`; the
deprecated `thisArg` bindings and `groupBy`'s positional arguments live in
`src/compat/collection.ts`.

# M15 verification

- **141 / 141 unit** and **244 / 244 differential tests** pass (42 new M15 traces: notifier/count/time/toggle/when boundaries for both families incl. real-clock spans and creation intervals, max-size early closes, error fan-out; groupBy keys/element/duration/connector/key-throws plus the reference-counted teardown; partition splits; count/max/min/every/find/findIndex incl. thisArg and sentinel cases);
- RxJS root export parity: **119 / 175 = 68.0%**; unexpected exports: **0**.

---

# M16 — Creation & Interop

`innerFrom` is the session's core: one conversion boundary that turns every
RxJS `ObservableInput` into a functional Observable, probing in RxJS's exact
order:

```text
function                     already an Observable — returned by reference
Symbol.observable carrier    subscribed through its interop contract
array-like (incl. strings)   synchronous index loop
promise-like                 resolution emits + completes; rejection errors
async iterable               for-await pump, early-unsubscribe break
iterable                     for-of pump releasing generator finalizers
readable-stream-like         reader pumped as an async generator
```

Anything else throws RxJS's exact `TypeError`. The boundary retires every
"functional Observables only" deferral recorded across M05-M15: flattening
projections, notifiers, duration and closing selectors, group durations,
coordination inputs, recovery/fallback factories, and share reset / connect
selector factories now accept any `ObservableInput` at the same sites where
RxJS converts. Promise-fed consumer crashes report through the F6 runtime
environment (`reportUnhandledError`); `Promise` joined the architecture
gate's allowed platform constructors.

Creation closes over the conversion: `from`, `defer` (factory per
subscription), `iif`, `range` (argument shuffle, shared `EMPTY`), `generate`
(a generator function through `defer`), `using` (resource disposed after
downstream teardown), `pairs`, and deprecated `empty()`/`never()` returning
the shared constants. `fromEvent` probes its four target shapes and
`fromEventPattern` hands the registration signal back to removal;
`bindCallback`/`bindNodeCallback` funnel one callback invocation per
argument application into an AsyncSubject with RxJS's sync/async completion
dance and error-first splitting. `firstValueFrom`/`lastValueFrom` are the
Promise consumption edge (`EmptyError` or `defaultValue` on empty), and
`isObservable`/`observable` are the interop predicates — brand-based, the
representational analog of `instanceof`.

# M16 verification

- **178 / 178 unit** and **263 / 263 differential tests** pass (19 new M16 traces: every `from` input kind incl. interop carriers and identical `TypeError` messages; defer/iif/range/generate/using/pairs incl. shared-constant identities; fromEvent registries, multi-arg events, result selectors; fromEventPattern signals; bindCallback sync/async/replay and bindNodeCallback error-first; firstValueFrom/lastValueFrom settlement incl. `EmptyError`; ObservableInput acceptance through the retired flattening/coordination/notifier/recovery deferrals);
- RxJS root export parity: **137 / 175 = 78.3%**; unexpected exports: **0**.

---

# M17 — Materialization & Operator Tail

Materialization reifies the notification protocol as data. `materialize`
turns every `next`/`error`/`complete` into a `next` carrying a frozen record
with the exact own fields RxJS's deprecated `Notification` class assigns:

```text
{ kind: 'N', value, error: undefined, hasValue: true  }
{ kind: 'E', value: undefined, error, hasValue: false }
{ kind: 'C', value: undefined, error: undefined, hasValue: false }   one shared instance
```

`dematerialize` replays any record with a string `kind` back onto the live
protocol — including RxJS's quirks: unknown string kinds complete, and a
missing `kind` throws the validation `TypeError`. The deprecated
`Notification` surface is a non-constructible functional factory (compat)
carrying the class statics, with `observe`/`do`/`accept`/`toObservable`
attached non-enumerably — the kernel purity gate forbids
`defineProperties`, so the method surface is compat by construction, and
factory records stay deep-equal to materialized data records.

The operator tail is mostly algebra over existing machinery: `startWith`/
`endWith` are `concat`; `mapTo`/`pluck`/`timestamp` are `map`; `toArray` is
a pure accumulation step; `exhaust` is the `exhaustAll` reference itself.
`timeInterval` measures scheduler-clock gaps, `isEmpty` answers on the first
decisive event, and `sequenceEqual` runs symmetric buffered comparison over
any `ObservableInput`. The M12 deferral names close the resubscription
story: `retryWhen`/`repeatWhen` feed terminals into lazily created notifier
Subjects with RxJS's `syncResub` handshake ported exactly, and
`onErrorResumeNext` (creation + `onErrorResumeNextWith` operator) swallows
both terminal signals, advancing through its source list via teardown.

# M17 verification

- **199 / 199 unit** and **279 / 279 differential tests** pass (16 new M17 traces: materialize records incl. the shared complete instance; dematerialize round trips, plain records, unknown kinds, validation TypeErrors; Notification statics/constructor/dispatch/toObservable and NotificationKind; deterministic-clock timeInterval/timestamp; startWith/endWith across terminals; ignoreElements/mapTo/pluck quirks; toArray/isEmpty; sequenceEqual verdicts; retryWhen/repeatWhen scripted run/teardown ordering incl. syncResub; onErrorResumeNext forms incl. skipped unconvertible inputs; exhaust aliasing);
- RxJS root export parity: **156 / 175 = 89.1%**; unexpected exports: **0**.

---

# Root parity after M17

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
  TimeoutError

Creation
  of
  EMPTY
  timer
  interval
  from
  defer
  iif
  range
  generate
  using
  empty
  never
  NEVER
  pairs
  fromEvent
  fromEventPattern
  bindCallback
  bindNodeCallback

Interop / consumption
  observable
  isObservable
  firstValueFrom
  lastValueFrom

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
  mergeAll    concatAll   switchAll   exhaustAll  exhaust
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

Sharing
  share       shareReplay       connectable   connect

Error / resubscription
  catchError  retry       repeat    finalize    throwError
  retryWhen   repeatWhen  onErrorResumeNext     onErrorResumeNextWith

Schedulers
  asyncScheduler  asapScheduler  queueScheduler
  async           asap           queue
  observeOn       subscribeOn

Temporal
  delay       delayWhen
  debounce    debounceTime
  audit       auditTime
  throttle    throttleTime
  sample      sampleTime
  timeout     timeoutWith

Boundary
  buffer      bufferCount   bufferTime   bufferToggle   bufferWhen
  window      windowCount   windowTime   windowToggle   windowWhen

Grouping / collection
  groupBy     partition
  count       max           min
  every       find          findIndex

Materialization / metadata
  materialize   dematerialize
  Notification  NotificationKind
  timeInterval  timestamp

Operator tail
  startWith     endWith
  ignoreElements  mapTo   pluck
  toArray       isEmpty   sequenceEqual
```

That is **156 / 175 = 89.1%** of the root export names.

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

### M11 — Sharing Topology ✅
share/shareReplay with reset policies as data; connectable/connect explicit connections.

### M12 — Error & Resubscription ✅
catchError/retry/repeat/finalize + throwError; resubscription with notifier-factory delay policies.

### M13 — Scheduler Kernel ✅
timerHost edge + one action machine; async/queue/asap as frozen policy records; observeOn/subscribeOn.

### M14 — Temporal Operators ✅
timer/interval as the time primitive; delay/delayWhen, debounce/audit/throttle/sample families as timer algebra + notifier handshakes; timeout/timeoutWith/TimeoutError; retry/repeat numeric delays.

### M15 — Boundary & Collection ✅
buffer/window families as boundary policies over Subjects + timers; groupBy with reference-counted release + partition; count/max/min/every/find/findIndex as reduce/terminal algebra.

### M16 — Creation & Interop ✅
from/innerFrom ObservableInput conversion (retiring the functional-Observables-only deferrals), fromEvent/fromEventPattern, bindCallback/bindNodeCallback, defer/iif/range/generate/using, empty/never/NEVER/pairs, isObservable/observable, firstValueFrom/lastValueFrom.

### M17 — Materialization & Operator Tail ✅
materialize/dematerialize as frozen notification records + the compat Notification factory and NotificationKind; timeInterval/timestamp metadata; startWith/endWith/ignoreElements/mapTo/pluck/toArray/isEmpty/sequenceEqual tail; retryWhen/repeatWhen/onErrorResumeNext(With) closing the M12 deferrals; exhaust alias.

### M18 — Compat Closure (Session 7, 19 features)
ConnectableObservable/multicast/publish family/refCount, combineAll/combineLatestAll/zipAll, Scheduler/scheduled, animationFrame(s)/animationFrameScheduler, VirtualAction/VirtualTimeScheduler, package-shape artifacts.

### M19 — Package Parity
strict subpath/declaration/ESM/CJS compatibility.

### M20 — Differential Certification
final behavioral and export parity matrix.

---

# Implementation sessions

```text
Session 1  M01-M05   ✅ kernel + first-order operator policies
Session 2  M06-M10   ✅ gating + higher-order + flattening + coordination + Subjects
Session 3  M11-M14   ✅ sharing + recovery + scheduling + time
Session 4  M15       ✅ boundary & collection                 → 119/175 (68.0%)
Session 5  M16       ✅ creation & interop                    → 137/175 (78.3%)
Session 6  M17       ✅ materialization & op tail             → 156/175 (89.1%)
Session 7  M18-M20   19 features  compat closure + gates     → 175/175 (100%)
```

Sessions 1-6 are complete (Session 3 re-scoped to close at M14). The
remaining **19 root exports** land in one final feature session — the
per-name allocation lives in `docs/EXECUTION-PLAN.md` and the current
per-export status in `feature-parity-list.md`. Next is **Session 7:
M18 — Compat Closure plus the M19/M20 gates**.

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
