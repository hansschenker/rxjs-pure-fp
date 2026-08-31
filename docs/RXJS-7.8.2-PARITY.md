# RxJS 7.8.2 Parity

## Current milestone: M12 — Error & Resubscription (Session 3 in progress)

Session 1 (M01-M05) is complete; Session 2 is in progress. Between M05 and
M06, the F1-F8 functional-deepening work (docs/FP-ROADMAP.md) restructured the
source into `src/kernel/**` and `src/compat/**` without changing behavioral
scope. M07 introduced the shared flattening machine; M08 wrapped it into the
public flattening family; M09 adds the multi-source coordination surface.

| Dimension | M12 status |
| --- | --- |
| Behavioral oracle | pinned `rxjs@7.8.2` |
| Architecture gate | passes across 78 TypeScript source files |
| Unit tests | 95 / 95 |
| Differential tests | 172 / 172 total |
| New M12 differential traces | 13 |
| RxJS root exports implemented | 78 / 175 = 44.6% |
| Functional root extensions | 16 |
| Unexpected root exports | 0 |
| Distribution architecture | passes across 156 emitted JavaScript files |

## Root parity exports through M06

### Runtime/core

- `Observable`
- `Subscriber`
- `Subscription`
- `UnsubscriptionError`
- `config`
- `pipe`
- `identity`
- `noop`

### Errors

- `EmptyError`
- `ArgumentOutOfRangeError`
- `SequenceError`
- `NotFoundError`

### Creation

- `of`
- `EMPTY`

### Projection/querying

- `map`
- `filter`
- `tap`
- `scan`
- `reduce`
- `pairwise`
- `distinct`
- `distinctUntilChanged`
- `distinctUntilKeyChanged`

### Selection/gating

- `take`
- `takeLast`
- `takeWhile`
- `takeUntil`
- `skip`
- `skipLast`
- `skipWhile`
- `skipUntil`
- `first`
- `last`
- `single`
- `elementAt`
- `defaultIfEmpty`
- `throwIfEmpty`

### Flattening

- `mergeMap`
- `flatMap`
- `concatMap`
- `switchMap`
- `exhaustMap`
- `mergeAll`
- `concatAll`
- `switchAll`
- `exhaustAll`
- `mergeMapTo`
- `concatMapTo`
- `switchMapTo`
- `mergeScan`
- `switchScan`
- `expand`

### Subjects

- `Subject` (incl. deprecated `Subject.create`)
- `BehaviorSubject`
- `ReplaySubject`
- `AsyncSubject`
- `ObjectUnsubscribedError`

### Error & resubscription

- `catchError`
- `retry`
- `repeat`
- `finalize`
- `throwError`

### Sharing

- `share`
- `shareReplay`
- `connectable`
- `connect`

### Coordination

- `merge`
- `concat`
- `combineLatest`
- `zip`
- `race`
- `forkJoin`
- `withLatestFrom`
- `mergeWith`
- `concatWith`
- `combineLatestWith`
- `zipWith`
- `raceWith`

## Functional root extensions

Tracked separately and excluded from the RxJS parity numerator:

- `createSubscription`
- `createSubscriber`
- `createObservable`
- `createSubject`
- `createBehaviorSubject`
- `createReplaySubject`
- `createAsyncSubject`
- `subscribe`
- `pipeValue`
- `mapSink`
- `filterSink`
- `fuseSinkTransformers`
- `liftSinkTransformer`
- `statefulOperator`
- `emitNone`
- `emitOne`

## M05 certified scope

### `tap`

Certified for:

- subscribe/next/error/complete observation;
- exact mirroring of ordinary source values;
- handler failures becoming errors from the tapped Observable;
- explicit unsubscribe hook only on cancellation paths;
- finalize hook on completion, error, and explicit cancellation;
- synchronous-completion ordering where operator finalization can precede source teardown returned later;
- live-source explicit cancellation ordering where already-attached source teardown precedes tap unsubscribe/finalize.

### `scan`

Certified for:

- seed and no-seed state establishment;
- explicit `undefined` as a supplied seed;
- accumulator indexes;
- current-state emission after each source value;
- accumulator failures entering the error channel.

### `reduce`

Certified for:

- shared scan-style accumulation semantics;
- one emission before completion;
- seed/no-seed indexes;
- empty source with no seed (no value);
- empty source with explicit `undefined` seed (emit `undefined`).

### `pairwise`

Certified for:

- no output on first source value;
- `[previous, current]` from second value onward;
- previous-value state reset on each subscription.

### `distinct`

Certified for:

- whole-history Set-based key memory;
- optional key selector;
- per-subscription Set state;
- functional Observable flush source clearing the Set;
- SameValueZero/Set behavior such as NaN de-duplication.

**Scope note:** RxJS accepts any `ObservableInput` as the `flushes` argument. M05 only claims the flush semantics when `flushes` is already a functional Observable. Full `ObservableInput` conversion is deferred to the input/interoperability milestones.

### `distinctUntilChanged`

Certified for:

- first value always emitted;
- default `===` comparator;
- custom comparator;
- key selector invoked for every source value including the first;
- previous-key update before downstream emission;
- reentrant source behavior;
- NaN behavior under `===`.

### `distinctUntilKeyChanged`

Certified for:

- consecutive property-key comparison;
- default equality;
- custom key comparator;
- implementation through `distinctUntilChanged` rather than separate state machinery.

## M06 certified scope

### `take` / `takeLast` / `skip` / `skipLast`

Certified for:

- take's next-then-complete ordering and synchronous upstream cancellation;
- `take(0)`/negative counts and `takeLast(0)` never executing the source;
- takeLast sliding-tail buffering incl. under-count and empty sources;
- `skip` as index gating; over-count skip completing empty;
- `skipLast(0)` returning the identity (same source reference);
- skipLast ring-buffer delay semantics.

### `takeWhile` / `skipWhile`

Certified for:

- exclusive and inclusive takeWhile termination;
- first-value predicate failure;
- predicate indexes;
- predicate failures entering the error channel;
- skipWhile gate opening on first predicate failure (that value emitted);
- never-failing skipWhile completing empty.

### `takeUntil` / `skipUntil`

Certified for:

- notifier-before-source subscription order (synchronously firing notifier
  prevents source execution entirely);
- notifier value completing / opening the gate, with teardown ordering;
- notifier completion being ignored (takeUntil) or closing the gate forever
  (skipUntil);
- notifier errors becoming errors of the result.

**Scope note:** notifiers must already be functional Observables; RxJS
`ObservableInput` conversion is deferred to the interoperability milestones
(same policy as the `distinct` flush argument).

### `first` / `last` / `single` / `elementAt` / `defaultIfEmpty` / `throwIfEmpty`

Certified for:

- first/last as operator algebra with optional predicate
  (`(value, index, source)` including source identity) and optional default;
- `EmptyError` on empty/no-match without default;
- single's four outcomes: the single value, `SequenceError`, `NotFoundError`,
  `EmptyError`;
- elementAt found/out-of-range/default, plus the synchronous
  `ArgumentOutOfRangeError` throw for negative indexes at call time;
- defaultIfEmpty/throwIfEmpty emptiness policies incl. custom error factories.

## M07 certified scope

The flattening machine is certified — via policy instances traced against
rxjs `mergeMap`/`concatMap`/`switchMap`/`exhaustMap` — for:

- overlapping inner execution with interleaved values (merge);
- bounded concurrency with buffering, drain order, and drain-time projection
  indexes (merge with `concurrent`);
- one-at-a-time queueing where the completed inner's teardown precedes the
  next inner's subscription (concat);
- cancel-previous-keep-latest replacement, including cancel-before-project
  ordering (switch);
- ignore-while-busy admission where ignored values never consume a projection
  index (exhaust);
- the settle asymmetry: teardown-then-complete for merge/concat versus
  complete-then-teardown for switch/exhaust;
- completion only after outer completion + empty queue + no active inners;
- projection throws (including during buffer drain), inner errors, and outer
  errors as result errors;
- downstream unsubscription tearing down outer and live inners;
- empty inners and fully synchronous flattening.

**Scope note:** projected inners must already be functional Observables; RxJS
`ObservableInput` conversion is deferred to the interoperability milestones.

## M08 certified scope

### `mergeMap` / `concatMap` / `switchMap` / `exhaustMap`

Core policy semantics were certified in M07 via the machine. M08 additionally
certifies the public surface:

- the `concurrent` argument (including in `resultSelector` position);
- deprecated `resultSelector` overloads with exact
  `(outerValue, innerValue, outerIndex, innerIndex)` call sequences,
  including inner-index reset across switch cancellation;
- `flatMap` as the same function object as `mergeMap`.

### `mergeAll` / `concatAll` / `switchAll` / `exhaustAll`

Certified for identity-projection flattening under each policy: bounded
concurrency with buffering (mergeAll(1)), cancellation (switchAll), and
busy-ignore where the ignored inner Observable is never executed (exhaustAll).

### `mergeMapTo` / `concatMapTo` / `switchMapTo`

Certified for per-outer-value re-execution of one cold inner Observable and
for the deprecated `resultSelector` overload.

### `mergeScan` / `switchScan`

Certified for seed establishment, per-subscription state, state updates from
every inner value before downstream emission (latest-inner-only under
switchScan), accumulator indexes, and multi-value inners.

### `expand`

Certified for recursive feedback (each admitted value emitted before
projection, inner values re-entering admission), empty sources, bounded
concurrency with buffered feedback, and the `concurrent < 1 → Infinity`
normalization.

**Scope note:** inner inputs must already be functional Observables; RxJS
`ObservableInput` conversion is deferred to the interoperability milestones.

## M09 certified scope

### `merge` / `concat` (creation) and `mergeWith` / `concatWith`

Certified for: eager parallel subscription vs. sequential lazy subscription,
trailing `concurrent` for merge, single-source reference identity
(`merge(a) === a`), empty merge completing, error short-circuiting concat,
and teardown ordering.

### `combineLatest`

Certified for: array, dictionary, and deprecated selector forms; first-value
gating; fresh snapshot arrays per emission; completion only when all sources
complete (a valueless completed source leaves the result pending); empty
input completing immediately.

### `zip`

Certified for: per-source queues with index-aligned tuples; completion when a
completed source's queue empties (at completion or on a draining emission);
array and selector forms.

### `race` / `raceWith`

Certified for: first value/error/completion settling the race; rival
unsubscription; synchronous settlement preventing later contenders from
subscribing; single-source and no-companion identity.

### `forkJoin`

Certified for: final-value arrays and dictionaries; immediate valueless
completion when any source completes without emitting; error propagation.

### `withLatestFrom`

Certified for: companion-before-source subscription order; gating until all
companions have emitted; ignored companion completions; project overload.

**Scope notes / deviations:** inputs must be functional Observables
(`ObservableInput` deferred); deprecated scheduler arguments deferred to M13;
trailing rest sources must be branded (kernel-created) Observables on the
selector-capable compat surfaces because Observables are functions in this
representation — array forms carry raw-function sources.

## M10 certified scope

### `Subject`

Certified for: multicast with the lazily rebuilt broadcast snapshot
(reentrant subscribe misses the in-flight value); `observed`/`closed`/
`isStopped`/`hasError`/`thrownError` state transitions; terminal drains and
immediate terminal delivery to late subscribers; post-terminal `next` as a
silent no-op; `ObjectUnsubscribedError` thrown synchronously by
`next`/`error`/`complete`/direct subscribe after `unsubscribe()`; subjects as
observers (safe-boundary wrapped); `asObservable()`; deprecated
`Subject.create` delegate semantics.

### `BehaviorSubject` / `ReplaySubject` / `AsyncSubject`

Certified for: current-value emission on registration and none after
termination, `getValue()` contract incl. throwing the terminal error;
replay-all and size-window trimming, buffer replay before terminal delivery
for late subscribers on completed and errored subjects; async last-on-complete
delivery, empty completion, error suppression of the held value, and late
subscriber delivery.

**Deviations:** `BehaviorSubject.value` is a live snapshot data property
(non-throwing; `getValue()` carries the throwing contract); `ReplaySubject`
time windows are deferred until clocks land; subject methods do not
participate in the deprecated synchronous error context; subjects are mutable
hub records (the documented sharing topology) and are not frozen.

## Differential evidence by milestone

- M00: 1 harness/oracle trace
- M01: 7 lifecycle traces
- M02: 9 Subscriber/safe-consumer traces
- M03: 8 Observable execution traces
- M04: 8 first-pipeline/operator traces
- M05: 16 projection/querying traces
- F2/F3: 17 kernel-operator traces
- M06: 21 selection/gating traces
- M07: 15 flattening-machine traces
- M08: 17 flattening-operator traces
- M09: 19 coordination traces
- M10: 10 subject traces
- M11: 11 sharing traces
- M12: 13 error/resubscription traces

Total: **172 / 172** differential tests.

## M12 certified scope

`finalize`: once-only callback after source teardown on complete/error/
unsubscribe. `catchError`: recovery, retry-forever via the caught argument,
selector throws as downstream errors, synchronous-error switching. `retry`:
count exhaustion re-erroring, recovery mid-sequence, `resetOnSuccess`,
notifier-factory delays (fire → resubscribe with teardown ordering; notifier
completion → result completion), `retry(0)` identity. `repeat`: bounded
repetition with per-attempt teardown, `repeat(0)` as EMPTY, notifier-factory
delays with repeat counts. `throwError`: per-subscription factory invocation
and plain-value form.

**Deviations/deferrals:** numeric delays await M14 timers;
`retryWhen`/`repeatWhen`/`onErrorResumeNext` and `throwError`'s scheduler
argument deferred to the remaining-surface milestone.

## M11 certified scope

`share`: single connection per shared application; multicast with late
subscribers; refCount-zero reset (default) vs keep-alive
(`resetOnRefCountZero: false`) vs notifier-delayed reset incl. cancellation
on resubscribe; resetOnComplete/resetOnError defaults and opt-outs (settled
subjects serving late subscribers without re-running the source).
`shareReplay`: buffer replay to late and re-subscribing consumers, keep-alive
default, `refCount: true` teardown, post-complete replay without re-run.
`connectable`: silent subscribers before `connect()`, idempotent connect,
disconnect teardown, fresh-subject reconnect. `connect`: one source run
multicast into a selector pipeline using the shared view twice.

**Deviations:** connection/notifier observers are raw kernel subscribers
(safe-boundary handler-throw edges not claimed); replay time windows and
scheduler arguments deferred until clocks land.

## Interpretation of export parity

The current 16/175 score measures root-name coverage only. It is not a direct percentage of engineering completion.

A root export can also have intentionally deferred overload/interoperability scope. Such gaps are recorded explicitly rather than hidden by the export count.

## Intentional architectural deviations

The canonical kernel does not provide RxJS OO invocation as its architecture:

- no constructible Observable class;
- no Subscriber inheritance;
- no Subscription class hierarchy;
- no prototype operator methods;
- no subclass extension model.

Feature capability and observable behavior are the compatibility target.

## Final policy

M19-M20 make full package/export parity strict. Until then every milestone must maintain:

- explicit semantic scope;
- zero accidental unexpected root exports;
- functional extensions tracked separately;
- differential evidence for parity claims.
