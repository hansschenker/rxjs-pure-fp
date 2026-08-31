# Semantic Invariants

RxJS 7.8.2 is the behavioral oracle for this project.

## Laziness

Observable and operator construction are inert. Source execution starts only on subscription.

## Cold independence

Unless sharing is explicit, every subscription owns independent execution and operator state.

Examples of per-subscription state now include:

- map/filter indexes;
- scan/reduce accumulator state;
- pairwise previous value;
- distinct Set;
- distinctUntilChanged previous key.

## Notification protocol

An execution emits zero or more `next` notifications followed by at most one `error` or `complete` terminal notification. Cancellation is not a terminal notification and must not synthesize completion.

## Value direction / ownership direction

```text
notifications      upstream ─────────► downstream
teardown ownership upstream ◄───────── downstream
```

Operator children are owned by downstream before their sources execute so synchronous cancellation can reach upstream immediately.

## Operator callbacks

Failures thrown by operator-owned callbacks are caught at the operator Subscriber boundary and sent downstream through `error`.

This applies to projections, predicates, accumulators, key selectors/comparators, and tap callbacks according to the corresponding RxJS operator semantics.

## Operator finalization timing

Operator finalization belongs to the Subscriber unsubscribe transition, not merely to a teardown appended after source subscription.

Two valid RxJS timing shapes exist.

### source teardown already registered

```text
unsubscribe
   │
   ├── source teardown
   └── operator finalize hook
```

### source completed synchronously before returning teardown

```text
source complete
   │
operator Subscriber finalizes
   │
operator finalize hook
   │
source returns teardown later
   │
add-to-closed executes source teardown
```

M05's internal Subscriber finalization hook preserves both shapes.

## Accumulation seed presence

For `scan`/`reduce`, seed presence is determined by call arity:

```text
arguments.length >= 2
```

Explicit `undefined` is therefore a supplied seed. Value-based tests such as `seed !== undefined` are semantically incorrect.

## Accumulator index

The accumulation index increments for every source value, including a first unseeded value that becomes state without calling the accumulator. Therefore the first accumulator call of an unseeded scan/reduce receives index 1.

## Reduce termination

`reduce` emits accumulated state only before successful completion:

- empty + no seed → no value, complete;
- empty + seed → seed, complete;
- source error/cancellation → no completion-time accumulation emission.

## Adjacent memory

`pairwise` stores the current source value as `previous` and emits only once a previous value exists. State resets with every subscription.

## Distinct Set semantics

`distinct` uses JavaScript Set semantics for selected keys. This includes SameValueZero behavior such as `NaN` matching `NaN`.

A flush emission clears the Set but does not itself emit a source value or complete the destination. A flush-source error is still an error of the resulting Observable.

## Consecutive distinctness

`distinctUntilChanged`:

1. always selects/emits the first value;
2. applies the key selector to every value including the first;
3. compares new key against the key of the previous **emitted** value;
4. updates the stored key before downstream `next` to preserve reentrancy correctness.

Its default comparator is `===`, not Set/SameValueZero semantics. Consequently consecutive NaN values are considered changed.

## `distinctUntilKeyChanged`

This is semantically derivable from `distinctUntilChanged` by comparing one property of consecutive emitted objects. No separate state policy is required.

## Higher-order execution (M07)

Inner subscriptions are execution resources. Their creation, coexistence, replacement, queueing, cancellation, completion, and errors are explicit and differentially tested against the four canonical policies:

- `mergeMap`: allow overlap;
- `concatMap`: queue while busy;
- `switchMap`: cancel previous / keep latest;
- `exhaustMap`: ignore new work while busy.

M07-certified invariants of the shared machine:

- the result completes only when the outer source has completed AND no inner is
  active AND the queue is empty;
- merge/concat settle a finished inner after its teardown: the completed
  inner's teardown precedes downstream completion, and for concat precedes the
  next queued inner's subscription;
- switch/exhaust settle in the inner's complete handler: downstream completion
  precedes that inner's teardown;
- `switch` cancels the active inner before projecting the replacement value;
- projection indexes are consumed at projection time: exhaust-ignored values
  never advance the index; buffered values advance it in arrival order;
- projection failures — including during buffer drain — and inner/outer errors
  all surface as errors of the result;
- downstream unsubscription tears down the outer and every live inner.

M07 scope note: projected inners must be functional Observables;
`ObservableInput` conversion is deferred to the interoperability surface.

## Flattening operators (M08)

- `mergeAll`/`concatAll`/`switchAll`/`exhaustAll` are projection by `identity`;
  `concatAll` is `mergeAll(1)`.
- The deprecated `resultSelector` receives
  `(outerValue, innerValue, outerIndex, innerIndex)`; the inner index counts
  per inner subscription and resets with each new inner (observable under
  switch cancellation). Selector semantics are recovered by `map` composition
  over the projected inner.
- `flatMap` is the same function object as `mergeMap`.
- `*MapTo` subscribes the one given inner Observable once per admitted outer
  value (a cold inner re-executes each time).
- `mergeScan`/`switchScan` hold one accumulation state per subscription; every
  inner value updates it before the downstream emission, so the next
  accumulator call sees the latest emitted inner value. Under `switchScan`
  only the surviving inner contributes state updates.
- `expand` emits every value it admits (source and inner alike) before
  projecting it, feeds inner values back through outer admission, and
  completes when the recursion drains. `concurrent < 1` is normalized to
  unbounded, unlike `mergeMap` where it stalls admission.

M08 scope note: inner inputs must be functional Observables; `ObservableInput`
conversion is deferred to the interoperability surface.

## Multi-source coordination (M09)

- Sources are subscribed eagerly in argument order; `withLatestFrom`
  subscribes its companions before its source.
- `merge([a])` and `race([a])` return the source itself; `merge([])` is
  `EMPTY`; `race([])` never settles; `raceWith()` is the identity operator.
- `combineLatest` emits a fresh snapshot array once every source has a first
  value; it completes only when all sources complete — a source completing
  without a value leaves the result silent but pending, as in RxJS 7.8.2.
- `zip` queues every source and emits index-aligned tuples; it completes as
  soon as any completed source's queue is empty, whether at its completion or
  when a later tuple drains it.
- `race` is settled by the first value, error, or completion; the winner's
  rivals are unsubscribed, and a synchronously settling contender prevents
  later contenders from ever subscribing.
- `forkJoin` emits one final-value array when all sources complete; a source
  completing without a value completes the result immediately with no
  emission (settled in the finalize hook).
- `withLatestFrom` gates source values until every companion has emitted;
  companion completions are ignored, companion errors propagate.
- Deprecated result selectors receive the combined values spread as
  arguments.

M09 deviations and scope notes: all inputs must be functional Observables
(`ObservableInput` conversion deferred); deprecated scheduler arguments are
deferred to M13; and because Observables are functions here, trailing rest
sources must be branded (kernel-created) Observables for the selector-capable
compat surfaces — raw-function sources should use the array forms.

## Sharing

Sharing changes execution topology and must be explicit. Ordinary Observables remain independently executed until Subject/connectable/share semantics are intentionally introduced.

## Time

Time enters through source clocks and schedulers. Temporal operators must preserve RxJS ordering and cancellation behavior rather than introducing unrelated Promise timing.

## Selection & gating (M06)

- `take(n)` emits the nth value before completing (next-then-complete) and
  cancels upstream synchronously on completion; `take(0)`/negative counts never
  execute the source.
- `takeWhile` excludes the failing value unless `inclusive`; either way the
  failing value ends participation.
- `skipWhile` consults the predicate only until its first failure; the failing
  value is the first one taken.
- `takeUntil` subscribes its notifier before the source, so a synchronously
  firing notifier completes the result before the source ever runs. Notifier
  completion is ignored; notifier errors are errors of the result.
- `skipUntil` opens its gate on the first notifier value and drops the notifier
  subscription at that instant; a notifier that completes without a value
  leaves the gate closed forever.
- Termination errors carry RxJS 7.8.2 identities: `EmptyError`
  (`no elements in sequence`) for first/last/single on empty sources;
  `NotFoundError` (`No matching values`) and `SequenceError`
  (`Too many matching values`) for single; `ArgumentOutOfRangeError` for
  elementAt misses. `elementAt` with a negative index throws synchronously at
  call time, before any subscription exists.
- `first`/`last`/`elementAt` are operator algebra
  (`filter` → `take`/`takeLast` → `defaultIfEmpty`/`throwIfEmpty`); their
  predicates receive `(value, index, source)`.

M06 scope note: `takeUntil`/`skipUntil` notifiers must be functional
Observables. `ObservableInput` conversion is deferred to the interoperability
surface, matching the `distinct` flush policy.

## Subjects (M10)

- Broadcast iterates a lazily rebuilt snapshot: observers subscribing during
  an emission miss it; observers removed during it receive a stopped no-op.
- Termination drains observers; late subscribers receive the terminal state
  immediately (Replay first replays its buffer, even when stopped).
- After `unsubscribe()`, `next`/`error`/`complete`/direct subscribe throw
  `ObjectUnsubscribedError` — the subscribe throw is synchronous at the call
  site (preflight), while subscribing through a wrapping observable routes it
  to the error channel, as in RxJS.
- AsyncSubject quirks preserved: `next` after unsubscribe is a silent no-op;
  `complete` on an unsubscribed subject throws.
- BehaviorSubject: registration precedes the current-value emission;
  `getValue()` throws the terminal error or `ObjectUnsubscribedError`; a
  completed subject still answers `getValue()`.

Deviations: `BehaviorSubject.value` is a live snapshot data property (it does
not throw; use `getValue()` for the throwing contract); `ReplaySubject`
supports the size window only until clocks land (M13/M14); subject methods do
not participate in the deprecated synchronous error context; subjects are
mutable hub records and therefore not frozen.

## Sharing topology (M11)

- `share` holds one connection per shared-source application: the connector
  Subject is created on first demand, subscribers attach to it before the
  source is connected, and reset behavior is policy data (`resetOnError`,
  `resetOnComplete`, `resetOnRefCountZero` — each `true`/`false`/notifier
  factory). A pending reset notifier is cancelled when a subscriber arrives
  before it fires.
- `shareReplay` is `share` with a replay connector, `resetOnComplete: false`,
  and ref-count reset only when requested — so a completed shareReplay serves
  late subscribers from the buffer without re-running the source.
- `connectable` subscribers attach to the connector Subject and receive
  nothing until `connect()`, which is idempotent while the connection is
  open; disconnecting swaps in a fresh Subject by default.
- `connect` multicasts the source through a per-subscription connector for
  the selector's pipeline, subscribing the selector result before connecting
  the source.

M11 deviations: connection and reset-notifier observers use raw kernel
subscribers rather than the safe consumer boundary (handler-throw edge cases
are not claimed); replay time windows remain deferred until clocks land.

## Algebraic structures (F8)

Several kernel structures are named algebras. Every law below is executable:
`test/unit/algebra-laws.test.mjs` and `test/unit/fp-kernel.test.mjs`.

| Structure | Carrier | Laws / equations |
| --- | --- | --- |
| `map` | Observable | functor identity and composition |
| `mapSink` | NotificationSink (contravariant) | contramap identity and composition; fusion |
| `filterSink` | NotificationSink | gate conjunction: `p` then `q` ≡ `p && q`, including call order |
| `Teardown` | `() => unknown[]` | monoid identity and associativity (errors as values) |
| `reduce` | accumulation policy | on non-empty sources, `reduce` ≡ last `scan` emission |
| `pairwise` | operator algebra | ≡ `scan` over an adjacency pair + index `filter` |
| `distinctUntilKeyChanged` | operator algebra | ≡ `distinctUntilChanged` over one key |

Boundary conditions are laws too: the empty seeded source is exactly where
`reduce` (emits the seed before complete) and `scan` (emits nothing) diverge,
and the divergence is pinned by a test.

### The Observable "monad" is a policy family

`of` is a lawful `pure`. But there is no single `chain`: each flattening policy
induces a different composition of `project value into inner Observable`:

```text
mergeMap    chain up to interleaving   inner executions overlap
concatMap   sequential (list-like)     source order preserved by queueing
switchMap   latest-wins                earlier inners are cancelled
exhaustMap  first-wins                 later outers are ignored while busy
```

Monad-law claims must therefore be stated per policy. `concatMap` is the
sequential monad; `mergeMap` satisfies the laws only up to emission
reordering; `switchMap` and `exhaustMap` trade associativity for cancellation
semantics — which inner survives depends on outer timing, so regrouping
changes behavior.

This is recorded ahead of M07/M08 deliberately: the flattening machinery is
one machine plus these four policies (`FUNCTIONAL-RUNTIME.md`), not four
unrelated operators, and the differential suite for M08 should test each
policy's algebra separately.

## Differential evidence

Each semantic claim is backed by scenario traces against `rxjs@7.8.2`. By the end of M05 the suite contained 49 passing differential tests spanning lifecycle, notification, execution, first pipeline, and stateful first-order operator policies; the F-work added kernel-operator suites, M06 added 21 selection/gating traces, M07 added 15 flattening-machine traces, M08 added 17 flattening-operator traces, M09 added 19 coordination traces, M10 added 10 subject traces, and M11 adds 11 sharing traces for a current total of 159 differential tests.
