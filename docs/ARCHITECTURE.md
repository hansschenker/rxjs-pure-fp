# Architecture

## Architectural thesis

RxJS 7.8.2 defines observable behavior. `rxjs-pure-fp` reconstructs that behavior from functions, closures, structural records, and policy composition rather than classes and inheritance.

## Non-negotiable rules

- no project-defined classes;
- no inheritance or `super`;
- no prototype mutation/constructor-prototype OO;
- no global registry for per-execution state;
- runtime TypeScript uses structural intersections rather than `extends`;
- pipeline construction stays inert;
- mutable execution state is created per subscription unless sharing is explicit.

---

# Realized kernel after Session 1

```text
Observable execution function
          │
          ▼
operator Subscriber policy
          │
          ▼
Subscriber notification machine
          │
          ▼
Subscription lifecycle closure
```

In types:

```ts
type Observable<T> =
  (subscriber: Subscriber<T>) => TeardownLogic;

type Subscriber<T> = Subscription & {
  readonly isStopped: boolean;
  next(value: T): void;
  error(error: unknown): void;
  complete(): void;
};

type OperatorFunction<A, B> =
  (source: Observable<A>) => Observable<B>;
```

## M01 — lifetime

`createSubscription()` owns `closed`, parentage, and finalizers in lexical state.

## M02 — notification participation

`createSubscriber()` enriches the same lifecycle record with destination, stop-state, and the Observer protocol.

## M03 — execution

`createObservable()` produces a lazy execution function; standalone `subscribe` connects source execution to a functional Subscriber and its teardown lifecycle.

## M04 — first-order operator topology

```text
source Observable
      │
      ▼
operator child Subscriber
      │
      ▼
destination Subscriber
```

The child is owned by downstream before source execution begins. Values flow downstream; cancellation ownership points upstream.

---

# M05 — operator behavior as policy

M05 generalizes the functional operator child without introducing a new object type.

```text
createOperatorSubscriber(
  destination,
  onNext?,
  onComplete?,
  onError?,
  onFinalize?
)
```

The same structural Subscriber can now express:

| Policy | Operators |
| --- | --- |
| Transform current value | `map` |
| Gate current value | `filter` |
| Observe notifications | `tap` |
| Accumulate state | `scan`, `reduce` |
| Remember previous value | `pairwise` |
| Remember all keys | `distinct` |
| Remember last emitted key | `distinctUntilChanged`, `distinctUntilKeyChanged` |

This is the central Session 1 architectural result: **operator families differ mainly by closure state and notification policy, not by runtime class type.**

## Internal Subscriber finalization hook

M05's `tap` requires RxJS OperatorSubscriber finalization timing. A late-added teardown is insufficient because synchronous source completion may close the operator child before the source initializer returns its teardown.

M05 therefore adds an internal Subscriber lifecycle hook:

```text
Subscriber unsubscribe
       │
       ├── execute lifecycle finalizers currently owned
       ├── clear destination
       └── run operator onFinalize hook
```

If a synchronous source returns teardown later, M01 add-to-closed semantics execute it afterward. If source teardown was already registered, it runs before the hook. This exactly models the two RxJS timing cases without an OperatorSubscriber subclass.

The public `createSubscriber()` API remains unchanged; the hook-capable constructor is internal operator machinery.

## Accumulation policy

`scan` and `reduce` share one state machine:

```text
closure per subscription
  hasState
  state
  index
```

Policy flags determine emission timing:

```text
scan    emitOnNext = true
        emitBeforeComplete = false

reduce  emitOnNext = false
        emitBeforeComplete = true
```

Seed presence is a call-arity policy, not a value check:

```text
arguments.length >= 2
```

so explicit `undefined` remains a valid seed.

## Memory policies

### adjacency

`pairwise` stores:

```text
previous
hasPrevious
```

### all-history distinctness

`distinct` stores a per-subscription `Set` of selected keys and can clear that state from a functional flush Observable.

### consecutive distinctness

`distinctUntilChanged` stores only:

```text
first
previousKey
```

The previous key is updated before downstream emission to preserve RxJS reentrancy semantics.

`distinctUntilKeyChanged` is built from `distinctUntilChanged`; it is operator algebra, not another state machine.

---

# State ownership after M05

The narrowest-lifetime rule now has concrete examples across the runtime:

| State | Lifetime |
| --- | --- |
| Subscription finalizers/parentage | one Subscription |
| Subscriber `isStopped` / destination | one Subscriber |
| map/filter index | one operator execution |
| scan/reduce accumulator | one operator execution |
| pairwise previous value | one operator execution |
| distinct Set | one operator execution |
| distinctUntilChanged previous key | one operator execution |

No ordinary operator state is stored globally or at operator-definition lifetime.

---

# Directionality

The first-order pipeline has two simultaneous directions:

```text
notifications: source ───────────────► destination
teardown:      source ◄─────────────── destination
```

This bidirectional execution topology remains the basis for M06 gating and, later, the M07-M08 higher-order machinery.

## Compatibility policy

Behavioral parity and eventual feature/export parity are required. Constructibility, prototype methods, and subclassing are not part of the functional kernel contract.

---

# Kernel / compat layering (F1)

Since F1 (`docs/FP-ROADMAP.md`), the source tree separates the pure core from the RxJS 7.8.2 surface:

```text
src/kernel/**   pure core: no this, no Reflect, no module-scope let/var,
                no deprecated overloads; enforced by the architecture gate
src/compat/**   7.8.2 surface: parity factory names, this-bound initializers,
                safe consumer boundary, deprecated flags and overloads,
                thisArg wrappers for map/filter
```

Dependency direction is one-way: compat imports kernel, never the reverse. First-order operators are derived from exported pure step functions (`Step<S, T, R>`) run by a single `statefulOperator` runner, and pure sink transformers (`SinkTransformer<T, R>`) lift into operators via `liftSinkTransformer`; `distinct` and `tap` remain fused.

Since F4/F5, subscription and subscriber records are frozen compositions over a shared kernel-internal lifecycle closure (`createLifecycleState`), and teardown execution is an error-aggregating monoid (`Teardown = () => unknown[]`, folded at the unsubscribe boundary where the single `UnsubscriptionError` throw remains).

Since F6, runtime policy enters the kernel as an explicit `RuntimeEnv` (`kernel/runtime.ts`): subscribers carry their environment, operator subscribers inherit it from their destination, and host timers are confined to `runtime.ts` behind the env's `defer` — the seam the M13 scheduler kernel will turn into policy. The mutable `config` object is compat surface (`compat/config.ts`), backing the parity constructors through the live `configEnv`. No impure residue remains in the kernel.

---

# M06 — Selection & gating

M06's thesis: selection is not a new machine — it is the step-function kernel plus an answer to *when participation ends or begins*.

## Terminal emissions

The F3 emission ADT gains two terminal variants:

```text
Emit<R> = none | one(value) | last(value) | done
```

`last` emits then completes (take's next-then-complete ordering); `done` completes silently. A step that needs the error channel throws, and the runner's operator Subscriber routes the throw downstream (`throwIfEmpty`, `single`).

## Selection policies

| Policy | Operators | Encoding |
| --- | --- | --- |
| positional end | `take` | counter step ending in `last` |
| positional begin | `skip` | `filter` by index (operator algebra) |
| value-driven end | `takeWhile` | predicate step ending in `last`/`done` |
| value-driven begin | `skipWhile` | gate-flag step |
| notifier-driven end | `takeUntil` | fused two-source topology |
| notifier-driven begin | `skipUntil` | fused two-source topology |
| tail selection | `takeLast`, `skipLast` | fused sliding/ring buffers |
| emptiness policy | `defaultIfEmpty`, `throwIfEmpty` | one shared presence step + flush |
| termination semantics | `first`, `last`, `single`, `elementAt` | operator algebra over the rows above |

`first`/`last`/`elementAt` are pure compositions — `filter` → `take`/`takeLast` → `defaultIfEmpty`/`throwIfEmpty` — exactly as in RxJS. `single` is one pure step plus a flush whose error paths are throws (`SequenceError`/`NotFoundError`/`EmptyError`).

## Notifier topology

`takeUntil` subscribes the notifier before the source, so a synchronously firing notifier prevents source execution entirely; notifier completion is swallowed (`noop`); notifier errors are errors of the result. `skipUntil` opens its gate on the first notifier value and drops the notifier subscription at that instant.

---

# M07 — Higher-order kernel

One flattening machine (`kernel/flattening.ts`), concurrency behavior as data:

```text
FlatteningPolicy = {
  concurrent:  how many inner executions may coexist
  overflow:    enqueue | ignore | switch     (outer value at capacity)
  settle:      finalize | complete           (when a finished inner frees its slot)
}
```

The four canonical policies are frozen records, and concat is policy algebra rather than a second machine:

```text
overlapPolicy(n)  { n, enqueue, finalize }   merge family
queuePolicy       overlapPolicy(1)           concat family
latestPolicy      { 1, switch,  complete }   switch family
exhaustPolicy     { 1, ignore,  complete }   exhaust family
```

## The settle axis

Differentially observable RxJS 7.8.2 behavior, promoted to policy data: merge/concat settle a finished inner in its **finalize** hook, so the inner's teardown precedes both downstream completion and the next queued inner's subscription; switch/exhaust settle in the inner's **complete** handler, so downstream completion precedes the inner's teardown.

## Machine invariants

- inner Subscribers are owned by the destination, so downstream cancellation reaches every live inner;
- the outer projection index is consumed only when a value is actually projected: `ignore`d values never advance it, `enqueue`d values advance it in arrival order as they leave the buffer;
- `switch` cancels the active inner before projecting the new value;
- buffer drain and completion checks run under the machine's error boundary, so projection failures during drain become downstream errors.

M07 exposes no new root exports: the machine is kernel-internal until M08 wraps it into the public flattening operators.

---

# M08 — Flattening policies

The public flattening family is policy application plus algebra over the M07 machine — no operator has its own execution machinery:

```text
mergeMap(p, n)   flattenWith(overlapPolicy(n), p)
concatMap(p)     flattenWith(queuePolicy, p)
switchMap(p)     flattenWith(latestPolicy, p)
exhaustMap(p)    flattenWith(exhaustPolicy, p)

mergeAll(n)      mergeMap(identity, n)
concatAll()      mergeAll(1)
switchAll()      switchMap(identity)
exhaustAll()     exhaustMap(identity)
```

Two machine hooks (`FlattenOptions`) recover the flattening relatives:

- `onInnerValue` — mergeScan/switchScan thread a per-subscription accumulator
  through the machine: the projected inner is `accumulator(state, value, index)`
  and every inner value updates the state before its downstream emission;
- `feedback` — expand mode: each projected value is emitted downstream and
  re-enters outer admission, recursing until inners stop producing. Expand
  normalizes `concurrent < 1` to unbounded (RxJS quirk, preserved).

The deprecated surface is compat (`src/compat/flattening.ts`): `resultSelector`
overloads are recovered by mapping the projected inner with
`(innerValue, innerIndex) => selector(outer, inner, outerIndex, innerIndex)` —
RxJS's own implementation strategy — and `flatMap`/`mergeMapTo`/`concatMapTo`/
`switchMapTo` are aliases over the same kernel operators.

---

# M09 — Multi-source coordination

Where possible, coordination is flattening algebra:

```text
merge(sources, n)  =  mergeAll(n) over of(...sources)
concat(sources)    =  concatAll() over of(...sources)
mergeWith / concatWith / combineLatestWith / zipWith / raceWith
                   =  the creation function over [source, ...others]
```

`combineLatest`, `zip`, `race`, `forkJoin`, and `withLatestFrom` are bespoke
topologies (kernel, array-typed): latest-value snapshots with a
first-value gate; per-source queues with drain-aware completion; contenders
where the first value cancels the rest; final-value joins settled in each
source's finalize hook; and companion gating where companion completion is
deliberately ignored. Sources are always subscribed eagerly in argument
order, and `withLatestFrom` subscribes its companions before its source.

The RxJS argument surface — rest arguments, single-array form,
plain-object (dictionary) form, deprecated result selectors, merge's trailing
`concurrent` — is compat (`src/compat/coordination.ts`).

## Observable branding

In this representation an Observable *is* a function, so RxJS's trailing-
selector heuristic (`typeof last === 'function'`) cannot distinguish a
trailing source from a selector. `createObservable` therefore stamps a brand
symbol on the function it returns (same reference — identity is preserved),
and the compat selector-popping logic treats branded functions as sources.
Raw unbranded functions remain valid Observables everywhere except as
trailing rest arguments of the selector-capable compat surfaces — use the
array forms there. Recorded as an intentional deviation. Branding also lets
Subjects be callable hub records that participate as sources anywhere an
Observable is expected.

---

# M10 — Functional Subjects

Multicast is one hub plus state policies (`kernel/subject.ts`):

```text
buildSubject(policy)   observers list + lazily rebuilt broadcast snapshot
Subject                default policies
BehaviorSubject        + current-value policy (register, then emit current)
ReplaySubject          + size-window replay buffer (replay, then finalized statuses)
AsyncSubject           + last-on-complete policy (custom finalized delivery)
AnonymousSubject       + delegate policies (deprecated Subject.create)
```

A Subject is a branded callable hub function — it IS an Observable — carrying
observer methods and live state fields (`closed`, `isStopped`, `hasError`,
`thrownError`, `observed`) maintained as plain data properties at transition
points. Subjects are the documented mutable sharing topology, so the hub
record is intentionally not frozen. Two supporting mechanisms landed with
M10: `setSubscribePreflight` (the functional `_trySubscribe` override point —
a closed subject throws `ObjectUnsubscribedError` synchronously to the
subscribe caller, while nested executions route it to the error channel), and
observer-shape detection in the safe-subscriber boundary (a callable record
with observer methods is an observer, not a next-callback).
