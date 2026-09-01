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

M07 scope note: since M16 projected inners are any `ObservableInput`,
converted by the machine at inner start.

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

M08 scope note: since M16 inner inputs are any `ObservableInput`.

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

M09 deviations and scope notes: since M16 all inputs are any
`ObservableInput`; deprecated scheduler arguments are deferred to M18; and
because Observables are functions here, trailing rest
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
supports the size window only (time windows still unwired, though clocks
landed in M13/M14); subject methods do
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

## Error & resubscription (M12)

- `finalize` registers its callback after connecting the source, so it runs
  exactly once after the source's own teardown on complete, error, or
  unsubscribe.
- `catchError` hands the selector the error and the caught observable
  (retry-forever composition); selector throws become downstream errors; a
  synchronously erroring source switches to the handled observable after
  connect returns.
- `retry` counts errors (`resetOnSuccess` zeroes the count on any value) and
  re-errors when exhausted; `retry(0)` is the identity operator. `repeat`
  counts completions; `repeat(0)` is `EMPTY`. Each attempt tears the previous
  subscription down before resubscribing.
- Delay policies accept notifier factories: resubscription happens on the
  first notifier value, and a notifier completing without a value completes
  the result (RxJS quirk, preserved).
- `throwError` treats a function argument as an error factory invoked per
  subscription.

M12 scope notes: numeric delays landed with the timer surface (M14); deprecated
`retryWhen`/`repeatWhen`/`onErrorResumeNext` and the scheduler argument of
`throwError` are deferred to the remaining-surface milestone.

## Scheduler kernel (M13)

- All host clock/interval/microtask access lives in `runtime.ts`'s
  `timerHost`; the scheduler kernel consumes only that edge (gate-enforced).
- Work receives its action as a parameter — `(state, action) => void` — and
  reschedules via `action.schedule(state, delay)`; actions are frozen
  Subscription records, so unsubscription cancels pending work.
- `asyncScheduler` recycles a same-delay reschedule's interval (periodic
  ticking); an action not rescheduled during its work releases its timer.
- `queueScheduler` at zero delay is a synchronous trampoline: nested
  schedules run after the current work, before control returns.
- `asapScheduler` at zero delay batches into one microtask; work scheduled
  during a flush joins that flush. Positive delays delegate to async.
- `observeOn` re-emits each notification through owned actions;
  `subscribeOn` defers the act of subscription itself.

M13 scope notes: `animationFrameScheduler`, the deprecated `Scheduler` class
shape, `scheduled`, and virtual time are deferred (M18 compat-closure
surfaces);
work-throw propagation follows the host timer's uncaught path.

## Temporal operators (M14)

- `timer` is the single time primitive: one reschedulable action emitting a
  counter. A `Date` due is `+due - scheduler.now()` clamped at zero; a
  scheduler in the interval position selects execution policy instead
  (RxJS's polymorphic argument).
- Timer algebra: `interval(p)` ≡ `timer(p, p)` (negative periods clamp);
  `delay(due)` ≡ `delayWhen(() => timer(due))`; `delayWhen(selector)` ≡
  `mergeMap((v, i) => selector(v, i)` piped through `take(1)`, `map(() => v))`
  — the RxJS 7 construction, so a duration completing without a value drops
  that value and errors are never delayed.
- Rate limiting is four distinct window policies: `debounce` cancels the
  pending duration on every new value and flushes on completion; `audit`
  opens one window per quiet period (first value) and emits the latest at
  window end; `throttle` carries `{leading, trailing}` as policy data and a
  trailing send re-opens the window itself; `sample` emits the latest at most
  once per external notifier tick and ignores notifier completion.
- Completion handshakes are part of the semantics: debounce flushes
  immediately, audit and a trailing throttle defer completion while a window
  is pending, sample completes with the source. The `*Time` forms are the
  same operators over `timer`/`interval`.
- `timeout` arms `first`/`each` deadlines as owned scheduled work; expiry
  unsubscribes the source and switches to the `with` observable, or throws a
  `TimeoutError` carrying `{meta, seen, lastValue}` diagnostics. A missing
  deadline is a synchronous `TypeError` at call time.
- `retry`/`repeat` numeric `delay` options are `timer(delay)` notifiers.

M14 scope notes: since M16 duration selectors, notifiers, and `with`
factories take any `ObservableInput`; `delayWhen`'s deprecated
`subscriptionDelay` argument is deferred to the remaining-surface milestone.

## Boundary & collection (M15)

- Buffers collect into arrays, windows into emitted Subjects; each family is
  the same boundary policy in two materializations. Windows are delivered as
  `asObservable()` views; buffer/window closing notifiers have swallowed
  completions except `bufferWhen`/`windowWhen`, where notifier completion
  also cycles.
- Boundary shapes: notifier-driven (`buffer`/`window`: one open boundary,
  rolls on each notifier fire, source completion flushes/completes it),
  count-driven (`bufferCount`/`windowCount`: `startEvery` opens overlapping
  or skipping boundaries; full boundaries close in opening order), clock-
  driven (`bufferTime`/`windowTime`: without a creation interval exactly one
  boundary is open and each close restarts; with one, boundaries open on a
  repeating schedule and may overlap; `max*Size` closes early), toggle-driven
  (`bufferToggle`/`windowToggle`: an opening value plus that value's closing
  notifier bound one boundary; overlap is free), and selector-cycled
  (`bufferWhen`/`windowWhen`: one boundary at a time, the closing selector is
  re-invoked per cycle).
- Termination fan-out: source errors reach every open window before the
  result; completion completes open windows before the result. Buffers flush
  open arrays on completion in opening order, but an error drops them.
- `groupBy` demultiplexes into per-key Subjects (`connector` replaces them)
  emitted as key-stamped observables. A group `duration` notifier's first
  emission or completion completes just that group and forgets the key, so
  the same key can reopen. Downstream release is reference-counted: the
  source outlives the result subscription while any group is still
  subscribed, and the last group teardown releases it (RxJS
  `shouldUnsubscribe` behavior as an explicit guard teardown).
- `partition(source, predicate)` is two independent `filter`ed subscriptions
  over the same source — each half runs its own execution with its own index
  sequence.
- Collection queries are `reduce`/terminal-emission algebra: `count`
  reduces a running total; `max`/`min` are seedless reductions over the
  native ordering or a comparer (empty sources complete without emitting);
  `every` emits `false` at the first failure or `true` at completion;
  `find`/`findIndex` emit the first hit (value or index) and complete, or
  the miss sentinel (`undefined` / `-1`) at completion. Predicates receive
  `(value, index, source)`.

M15 scope notes: since M16 boundary notifiers, closing selectors, and group
durations take any `ObservableInput`; the deprecated `thisArg` bindings (`every`/`find`/`findIndex`/`partition`)
and `groupBy`'s positional `element`/`duration`/`connector` arguments are
compat surface (`src/compat/collection.ts`).

## Creation & interop (M16)

- `innerFrom` converts every RxJS `ObservableInput` in RxJS's probe order:
  function (already an Observable — returned unchanged), `Symbol.observable`
  carrier, array-like (strings included), promise-like, async iterable,
  iterable, readable-stream-like; anything else throws RxJS's exact
  `TypeError`. `from` is `innerFrom` with the deprecated scheduler overload
  deferred (M18, `scheduled`).
- Promise sources ignore post-unsubscribe settlements; a consumer crash in
  `next`/`complete` is reported on a later tick through the runtime
  environment's `onUnhandledError` (`reportUnhandledError`, F6).
- Iterable sources check `closed` after each `next` and leave the loop by
  early return, releasing generator finalizers; stream readers release their
  lock in a `finally`.
- `defer` invokes its factory per subscription (throws reach the error
  channel); `iif` is `defer` over eagerly created branches; `generate` is a
  generator function through `defer` (optional condition loops forever);
  `using` disposes its per-subscription resource after downstream teardown
  and subscribes `EMPTY` for void factory results.
- `range(n)` shuffles to `(0, n)`; non-positive counts return the shared
  `EMPTY`; `empty()`/`never()` return the shared `EMPTY`/`NEVER`; `pairs`
  is `from(Object.entries(obj))`.
- `fromEvent` probes EventTarget (options passthrough) → Node-style →
  jQuery-style registries and fans array-like targets through the flattening
  kernel; multi-argument events emit argument arrays. `fromEventPattern`
  passes the registration return value to the remove handler.
- `bindCallback`/`bindNodeCallback` funnel one callback invocation per
  argument application into an AsyncSubject (late subscribers replay), keep
  RxJS's `isAsync`/`isComplete` completion dance, split error-first results
  (node style), pass the call-site `this` through, and ride
  `subscribeOn`/`observeOn` for the scheduler form.
- `firstValueFrom` resolves the first value and unsubscribes; `lastValueFrom`
  resolves the final value at completion; empty sources reject with
  `EmptyError` unless a `defaultValue` config is given.
- `isObservable` answers the construction brand (the representational analog
  of `instanceof Observable`); `observable` is `Symbol.observable` or the
  `'@@observable'` ponyfill key.
- The conversion boundary retires the M05-M15 functional-Observables-only
  scope notes: projections, notifiers, duration/closing selectors,
  coordination inputs, recovery/fallback factories, and share reset /
  connect selector factories accept any `ObservableInput` at the same sites
  where RxJS converts.

M16 scope notes: deprecated scheduler arguments of
`from`/`range`/`empty`/`pairs`/`generate` ride `scheduled` (deferred to
M18); a function carrying `Symbol.observable` is taken as a functional
Observable, not an interop carrier; the jQuery-style handler type drops the
`this: TContext` typing (kernel purity).

## Materialization & operator tail (M17)

- `materialize` reifies the protocol as data: each `next`/`complete`/`error`
  becomes a `next` carrying a frozen record `{ kind, value, error, hasValue }`
  — the same own enumerable fields RxJS's `Notification` constructor assigns
  — and the result completes after a terminal record. Complete records are
  one shared instance (RxJS's `completeNotification` singleton parity).
- `dematerialize` replays any record with a string `kind` through
  `observeNotification`: `'N'` → next, `'E'` → error, any other string kind
  completes (RxJS's fallthrough); a non-string `kind` throws RxJS's
  validation `TypeError` onto the error channel.
- `Notification` is a non-constructible functional factory (compat) carrying
  the class statics `createNext`/`createError`/`createComplete`; its records
  add the deprecated `observe`/`do`/`accept`/`toObservable` methods
  non-enumerably, as prototype methods are, so factory records and
  materialized data records stay deep-equal. `createComplete` returns one
  shared record. `NotificationKind` is the string enum's runtime object.
- `timeInterval` pairs each value with elapsed `scheduler.now()` time since
  the previous emission (subscription time for the first); `timestamp` pairs
  each value with the provider clock. Both emit plain records.
- `startWith`/`endWith` are `concat` algebra over `[values, source]` /
  `[source, of(...values)]`; `ignoreElements` forwards only terminals;
  `mapTo` and `pluck` are `map` projections — `pluck` preserves RxJS's
  short-circuit (any nullish hop or `undefined` property value projects
  `undefined`) and throws synchronously on an empty property list.
- `toArray` accumulates per subscription and always emits on completion
  (empty sources yield `[]`); `isEmpty` answers on the first decisive event.
- `sequenceEqual` buffers both sides symmetrically, emits `false` on the
  first mismatch (or on a value after the other side completed with an empty
  backlog) and the final verdict when both complete; `compareTo` is any
  `ObservableInput`.
- `retryWhen`/`repeatWhen` (deprecated M12 tail): terminal signals feed a
  Subject created lazily on the first error/completion and handed to the
  notifier once; each notifier emission resubscribes the source, with RxJS's
  `syncResub` handshake for terminals that arrive while the attempt is still
  being wired. `retryWhen` completes when its notifier completes;
  `repeatWhen` completes only when both source and notifier have completed
  (`checkComplete`), and notifier errors pass through in both.
- `onErrorResumeNext` (creation; operator form `onErrorResumeNextWith`) runs
  sources sequentially and swallows both terminal signals — only exhausting
  the list completes, nothing ever errors. Advancing rides teardown
  (`add` on a just-closed subscriber runs immediately), and inputs that fail
  `innerFrom` conversion are skipped like errored sources.
- `exhaust` is the deprecated alias: the same function reference as
  `exhaustAll`.

M17 scope notes: the deprecated trailing-scheduler forms of
`startWith`/`endWith` ride `scheduled` (deferred to M18 with the other
scheduler shapes); materialized records are pure data — the deprecated
notification methods live on the compat `Notification` factory records, and
the kernel and compat complete singletons are distinct (each internally
reference-stable).

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

Each semantic claim is backed by scenario traces against `rxjs@7.8.2`. By the end of M05 the suite contained 49 passing differential tests spanning lifecycle, notification, execution, first pipeline, and stateful first-order operator policies; the F-work added kernel-operator suites, M06 added 21 selection/gating traces, M07 added 15 flattening-machine traces, M08 added 17 flattening-operator traces, M09 added 19 coordination traces, M10 added 10 subject traces, M11 added 11 sharing traces, M12 added 13 error/resubscription traces, M13 added 7 scheduler traces, M14 added 23 temporal traces, M15 added 42 boundary/collection traces, M16 added 19 creation/interop traces, and M17 adds 16 materialization/operator-tail traces for a current total of 279 differential tests.
