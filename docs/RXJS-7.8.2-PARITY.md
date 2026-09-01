# RxJS 7.8.2 Parity

## Current milestone: M17 — Materialization & Operator Tail (Session 6 complete)

Sessions 1 (M01-M05), 2 (M06-M10), 3 (M11-M14), 4 (M15), 5 (M16), and 6
(M17) are complete. Between M05 and M06, the F1-F8 functional-deepening work
(docs/FP-ROADMAP.md) restructured the source into `src/kernel/**` and
`src/compat/**` without changing behavioral scope. M17 lands notifications
as data (`materialize`/`dematerialize` plus the deprecated `Notification`
surface), stream metadata (`timeInterval`/`timestamp`), the deprecated
operator algebra tail, and the M12-deferral resubscription names
(`retryWhen`/`repeatWhen`/`onErrorResumeNext`).

| Dimension | M17 status |
| --- | --- |
| Behavioral oracle | pinned `rxjs@7.8.2` |
| Architecture gate | passes across 145 TypeScript source files |
| Unit tests | 199 / 199 |
| Differential tests | 279 / 279 total |
| New M17 differential traces | 16 |
| RxJS root exports implemented | 156 / 175 = 89.1% |
| Functional root extensions | 17 |
| Unexpected root exports | 0 |
| Distribution architecture | passes across 290 emitted JavaScript files |

## Root parity exports through M17

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
- `TimeoutError`

### Creation

- `of`
- `EMPTY`
- `timer`
- `interval`
- `from`
- `defer`
- `iif`
- `range`
- `generate`
- `using`
- `empty`
- `never`
- `NEVER`
- `pairs`
- `fromEvent`
- `fromEventPattern`
- `bindCallback`
- `bindNodeCallback`

### Interop & consumption

- `observable`
- `isObservable`
- `firstValueFrom`
- `lastValueFrom`

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
- `exhaust` (deprecated `exhaustAll` alias)

### Subjects

- `Subject` (incl. deprecated `Subject.create`)
- `BehaviorSubject`
- `ReplaySubject`
- `AsyncSubject`
- `ObjectUnsubscribedError`

### Schedulers

- `asyncScheduler` / `async`
- `asapScheduler` / `asap`
- `queueScheduler` / `queue`
- `observeOn`
- `subscribeOn`

### Temporal

- `delay`
- `delayWhen`
- `debounce`
- `debounceTime`
- `audit`
- `auditTime`
- `throttle`
- `throttleTime`
- `sample`
- `sampleTime`
- `timeout`
- `timeoutWith`

### Error & resubscription

- `catchError`
- `retry`
- `repeat`
- `finalize`
- `throwError`
- `retryWhen`
- `repeatWhen`
- `onErrorResumeNext`
- `onErrorResumeNextWith`

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

### Boundary

- `buffer`
- `bufferCount`
- `bufferTime`
- `bufferToggle`
- `bufferWhen`
- `window`
- `windowCount`
- `windowTime`
- `windowToggle`
- `windowWhen`

### Grouping & collection

- `groupBy`
- `partition`
- `count`
- `max`
- `min`
- `every`
- `find`
- `findIndex`

### Materialization & metadata

- `materialize`
- `dematerialize`
- `Notification`
- `NotificationKind`
- `timeInterval`
- `timestamp`

### Operator tail

- `startWith`
- `endWith`
- `ignoreElements`
- `mapTo`
- `pluck`
- `toArray`
- `isEmpty`
- `sequenceEqual`

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

**Scope note:** since M16 the `flushes` argument accepts any `ObservableInput`, converted by `innerFrom` at the subscribe boundary.

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

**Scope note:** since M16 notifiers accept any `ObservableInput` (the same
conversion as the `distinct` flush argument).

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

**Scope note:** since M16 projected inners accept any `ObservableInput`,
converted by the flattening machine at inner start.

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

**Scope note:** since M16 inner inputs accept any `ObservableInput`.

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

**Scope notes / deviations:** since M16 inputs accept any `ObservableInput`;
deprecated scheduler arguments deferred to M18;
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
- M13: 7 scheduler traces
- M14: 23 temporal traces
- M15: 42 boundary/collection traces
- M16: 19 creation/interop traces
- M17: 16 materialization/operator-tail traces

Total: **279 / 279** differential tests.

## M17 certified scope

`materialize`: every protocol notification reified as a `next` carrying a
frozen `{ kind, value, error, hasValue }` record — the same own enumerable
fields RxJS's `Notification` constructor assigns — with the result
completing after a terminal record; complete records are one shared
instance. `dematerialize`: replay of any record with a string `kind`
(including plain objects and RxJS instances) — `'N'` next, `'E'` error,
any other string kind completes (RxJS fallthrough); non-string `kind`
throws RxJS's exact validation `TypeError` onto the error channel; certified
round-trip with `materialize` over value and error sources. `Notification`
/ `NotificationKind`: the statics (`createNext`/`createError`/
`createComplete` with its shared instance), the deprecated constructor form
preserving `value`/`error` verbatim for any kind, `observe`/`do`/`accept`
dispatch, `toObservable` (`of`/`throwError`/`EMPTY`), and the string enum's
runtime object. `timeInterval`: elapsed `scheduler.now()` time between
emissions (subscription time first), certified with a deterministic clock.
`timestamp`: value/provider-clock pairs. `startWith`/`endWith`: prefix and
suffix ordering across value, empty, and error sources. `ignoreElements`:
terminals only. `mapTo`/`pluck`: constant and nested-property projections,
including `pluck`'s nullish/`undefined` short-circuit and its synchronous
empty-list throw. `toArray`: per-subscription accumulation, `[]` on empty.
`isEmpty`: first-decisive-event answer. `sequenceEqual`: symmetric buffered
comparison, early `false` on mismatch or on a value after the other side's
empty-backlog completion, verdict on joint completion, custom comparators,
`ObservableInput` `compareTo`. `retryWhen`/`repeatWhen`: lazily created
notifier Subjects fed per terminal, resubscription per notifier emission
including the `syncResub` handshake for synchronous terminals (certified
with scripted run/teardown ordering), notifier completion completing the
result (`repeatWhen` jointly with the source), notifier errors passing
through. `onErrorResumeNext` (creation) / `onErrorResumeNextWith`
(operator): sequential sources with both terminal signals swallowed,
teardown-driven advancement, unconvertible inputs skipped, rest-arguments
and single-array forms. `exhaust`: the same function reference as
`exhaustAll` on both sides.

**Deviations/deferrals:** the deprecated trailing-scheduler forms of
`startWith`/`endWith` ride `scheduled` and are deferred to M18 with the
other scheduler shapes; `Notification` is a non-constructible functional
factory (call form, no `new`), its records are frozen, and its deprecated
methods are non-enumerable own properties rather than prototype methods;
`materialize` emits pure data records — the deprecated method surface lives
on the compat `Notification` factory records, which stay deep-equal to the
materialized data records; the kernel and compat complete singletons are
distinct objects (each internally reference-stable); `timeInterval` emits
plain records, not `TimeInterval` class instances.

## M16 certified scope

`from` / `innerFrom`: conversion of functional Observables (returned by
reference), `Symbol.observable` interop carriers (teardown returned through
the interop subscription), array-likes including strings, promise-likes
(post-unsubscribe settlements ignored; consumer crashes reported through the
runtime environment), iterables (early unsubscribe releases generator
finalizers), async iterables, and readable-stream-likes (reader lock
released in `finally`); RxJS's exact `TypeError` for unconvertible inputs.
`defer`: factory per subscription, factory throws to the error channel.
`iif`: condition per subscription over eagerly created inputs. `range`:
argument shuffle (`range(n)` counts `0..n-1`), shared `EMPTY` for
non-positive counts, closed-loop early stop. `generate`: positional and
options forms, optional condition (infinite loop), result selectors, iterate
throws. `using`: one resource per subscription disposed after downstream
teardown; void factory results subscribe `EMPTY`. `empty()` / `never()`:
the shared `EMPTY` / `NEVER` constants. `pairs`: `Object.entries` order.
`fromEvent`: EventTarget (options passthrough), Node-style, and
jQuery-style registries plus array-like target fan-out; multi-argument
events emitted as argument arrays; the deprecated result selector.
`fromEventPattern`: registration signal passed to removal; teardown-free
without a remove handler. `bindCallback` / `bindNodeCallback`: one callback
invocation per argument application with AsyncSubject replay, RxJS's
sync/async completion dance, error-first splitting (node style), the
deprecated result selector, and the scheduler form over
`subscribeOn`/`observeOn`. `firstValueFrom` / `lastValueFrom`: first-value
early teardown, final-value resolution, `EmptyError` rejections and
`defaultValue` configs, error rejections. `isObservable` / `observable`:
construction-brand predicate and the `Symbol.observable` ponyfill key.

The conversion boundary also retires the M05-M15 deferrals — certified
differentially with array, promise, iterable, and interop inners: flattening
projections (`mergeMap` family, `expand`, `mergeScan`/`switchScan`, the
`*All` flatteners), notifiers (`takeUntil`, `skipUntil`, `buffer`, `window`,
`sample`, `distinct` flushes), duration/closing selectors (`audit`,
`debounce`, `throttle`, `delayWhen`, the toggle/when families, `groupBy`
durations), coordination inputs (`combineLatest`, `concat`, `merge`, `race`,
`zip`, `forkJoin`, `withLatestFrom`, the `*With` operators, `partition`),
recovery/fallback factories (`catchError`, `timeout`/`timeoutWith`,
`retry`/`repeat` delay factories), and `share` reset / `connect` selector
factories.

**Deviations/deferrals:** the deprecated scheduler arguments of `from`,
`range`, `empty`, `pairs`, and `generate` ride `scheduled` and are deferred
to M18; a function carrying `Symbol.observable` is used as a functional
Observable, not an interop carrier (functions are Observables in this
representation); `isObservable` answers the construction brand — the
representational analog of RxJS's `instanceof` check — so raw unbranded
initializer functions are not recognized, exactly as a plain `{subscribe}`
object is not an RxJS Observable; the jQuery-style handler type drops RxJS's
`this: TContext` typing (kernel purity); `firstValueFrom`/`lastValueFrom`
construct platform Promises (gate-allowed since M16).

## M15 certified scope

`buffer` / `window`: notifier-rolled boundaries — emission on each notifier
fire (including empty boundaries), swallowed notifier completion, source
completion flushing the open buffer / completing the open window, source
errors fanned into the open window before the result. `bufferCount` /
`windowCount`: exact, overlapping (`startEvery < size`), and skipping
(`startEvery > size`) boundaries; full boundaries retire in opening order;
completion flushes the remainder. `bufferTime` / `windowTime`: span-closed
boundaries with immediate restart; creation-interval mode with overlapping
boundaries and value drops between them; `maxBufferSize`/`maxWindowSize`
early closes (certified synchronously and against the real clock); the
trailing-scheduler argument shape. `bufferToggle` / `windowToggle`:
per-opening boundaries closed by that opening's selector notifier, free
overlap, completion flushing in opening order, selector throws erroring open
windows before the result. `bufferWhen` / `windowWhen`: selector-cycled
single boundaries, notifier completion also cycling (`windowWhen`), no
leading empty buffer emission. `groupBy`: key demultiplexing with key-stamped
group observables, `element` projection, `duration`-closed groups with key
reopening, `connector` Subjects, key-selector throws fanned to every group,
and reference-counted downstream release (source outlives the result
subscription while any group is subscribed; certified differentially).
`partition`: static two-way `filter` split with independent executions and
the deprecated `thisArg`. `count` / `max` / `min`: reduce algebra including
comparers, predicates, and silent empty completion for `max`/`min`. `every`
/ `find` / `findIndex`: first-failure/first-hit early termination, miss
sentinels (`true` on empty `every`, `undefined`, `-1`), `(value, index,
source)` predicate arity, predicate throws, and the deprecated `thisArg`
compat bindings.

**Deviations/deferrals:** since M16, boundary notifiers, closing selectors,
and group durations accept any `ObservableInput`; `groupBy`'s deprecated positional
`element`/`duration`/`connector` arguments are compat surface normalized
onto the kernel options record.

## M14 certified scope

`timer`: one-shot due times (delays and past/future `Date`s), periodic
continuation through action rescheduling, the scheduler-in-second-position
polymorphic argument, pre-fire cancellation. `interval`: periodic counter as
`timer(p, p)` with negative-period clamping. `delay` / `delayWhen`: uniform
shift as delayWhen-over-one-cold-timer; per-value durations including
reordering; completion held for pending durations; empty-duration value drop
(the v7 semantics change); errors not delayed. `debounce` / `debounceTime`:
latest-value quiet-period emission, per-value duration cancellation,
completion flush, swallowed duration completions. `audit` / `auditTime`:
window opened by the first value only, latest value flushed at window end,
completion deferred while a window is pending, synchronous durations.
`throttle` / `throttleTime`: leading/trailing as policy data, trailing sends
re-opening the window, completion deferred for a pending trailing value,
synchronous durations. `sample` / `sampleTime`: latest value at most once per
notifier tick, swallowed notifier completion. `timeout` / `timeoutWith` /
`TimeoutError`: `first`/`each` deadlines (numbers and `Date`s), per-value
re-arming, `with`-factory switching, `TimeoutError` diagnostics
(`{meta, seen, lastValue}`), synchronous `TypeError`s for missing
deadline/fallback, the deprecated `timeout(due, scheduler)` overload.
`retry` / `repeat`: numeric `delay` options wired through `timer` (closing
the M12 deferral).

**Deviations/deferrals:** since M16, duration selectors, notifiers, and
`with` factories accept any `ObservableInput`;
`delayWhen`'s deprecated `subscriptionDelay` argument deferred to the
remaining-surface milestone; `TimeoutError` is a functional factory over
platform `Error` (identity via `name`), like the other parity errors.

## M13 certified scope

Queue trampoline flattening of nested zero-delay work; sync → queue → asap
(microtask) → async (macrotask) ordering; asap flush batching including work
scheduled mid-flush; interval-recycled self-rescheduling with terminal state;
pre-fire cancellation of async and asap actions; `observeOn` asynchronous
re-emission with completion; `subscribeOn` deferred subscription. RxJS's
`this`-bound work signature is adapted to `(state, action)` (recorded
functional deviation); `animationFrameScheduler`, `Scheduler`, `scheduled`,
`TimestampProvider` inputs, and virtual time are deferred.

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

**Deviations/deferrals:** numeric delays landed with the M14 timer surface;
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

The current 137/175 score measures root-name coverage only. It is not a direct percentage of engineering completion.

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
