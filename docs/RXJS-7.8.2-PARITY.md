# RxJS 7.8.2 Parity

## Current milestone: M20 — Differential Certification (Session 7 complete)

Sessions 1 (M01-M05), 2 (M06-M10), 3 (M11-M14), 4 (M15), 5 (M16), 6 (M17),
and 7 (M18-M20) are complete. Between M05 and M06, the F1-F8
functional-deepening work (docs/FP-ROADMAP.md) restructured the source into
`src/kernel/**` and `src/compat/**` without changing behavioral scope. M18
closes the compat surface — the deprecated multicast family, the remaining
scheduler shapes (`Scheduler`, `scheduled`, animation frames, virtual time),
the join-all aliases, every deprecated scheduler argument recorded as a
deferral since M09, and the replay time windows deferred since M10. M19
gives the package RxJS's shape (export map, CommonJS/ESM/declarations, the
`rxjs/operators` subpath). M20 makes export parity strict and derives the
per-name certification matrix from the differential suites.

| Dimension | M20 status |
| --- | --- |
| Behavioral oracle | pinned `rxjs@7.8.2` |
| Architecture gate | passes across 155 TypeScript source files |
| Unit tests | 213 / 213 |
| Differential tests | 314 / 314 total |
| New Session 7 differential traces | 35 (32 M18, 1 M19, 2 M20) |
| RxJS root exports implemented | 175 / 175 = 100% |
| `rxjs/operators` subpath exports | 115 / 115 = 100% |
| Functional root extensions | 20 |
| Unexpected root exports | 0 |
| Distribution architecture | passes across 310 emitted JavaScript files |
| Package parity gate | passes (import / require / ESM file / declarations agree) |
| Certification matrix | every exported name traced (`docs/CERTIFICATION-MATRIX.md`) |

## Root parity exports through M20

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
- `animationFrameScheduler` / `animationFrame`
- `Scheduler`
- `scheduled`
- `animationFrames`
- `VirtualTimeScheduler`
- `VirtualAction`
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
- `ConnectableObservable`
- `multicast`
- `refCount`
- `publish`
- `publishBehavior`
- `publishLast`
- `publishReplay`

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
- `combineLatestAll`
- `combineAll`
- `zipAll`

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

### Package shape

- `__esModule`
- `default`

(The CommonJS interop artifacts of the RxJS-identical export map — see M19.)

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
- `innerFrom`
- `createConnectableObservable`
- `createScheduler`
- `createVirtualTimeScheduler`

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
the deprecated scheduler arguments of `combineLatest`/`concat`/`merge`
landed in M18;
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
time windows landed in M18; subject methods do not
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
- M18: 32 compat-closure traces
- M19: 1 operators-subpath trace
- M20: 2 certification traces

Total: **314 / 314** differential tests.

## M18 certified scope

`ConnectableObservable` / `multicast` / `refCount`: subscribers attach to a
factory-made Subject recreated whenever missing or stopped; idempotent
`connect()` while a connection is open; connection teardown, source
completion, and source error all reset the record (`_teardown` order: the
connection is unsubscribed — so the source tears down — before the subject's
terminal is delivered); a synchronously completing source returns a closed
connection and reconnects on the next `connect()`; a subject instance passed
to `multicast` is reused stopped (late subscribers complete, reconnected
values are dropped); `refCount` (operator and `.refCount()` method) connects
on the first subscriber and disconnects on the last with RxJS's exact
handshake (only the subscriber that observed the connection being made tears
it down); `multicast(subject, selector)` is `connect`. `publish` (with and
without selector), `publishBehavior` (current value on subscribe, no value
after completion), `publishLast` (last value replayed to late subscribers),
`publishReplay` (size window, selector form, deprecated clock in the
selector position). Replay time windows: `ReplaySubject(size, windowTime,
provider)` trimming on every `next` and every subscribe by the provider's
clock (certified on a manual clock), `shareReplay`'s config and positional
`(bufferSize, windowTime, scheduler)` forms, `publishReplay` windows.
`combineLatestAll` / `combineAll` (same reference) / `zipAll`: collected
inner inputs (Observables and arrays) joined on outer completion, with and
without projection, empty outer sources. `Scheduler`: action factory plus
clock (the factory receives the scheduler record and the work; the
`Scheduler.now` static). `scheduled`: every input kind (array, string,
iterable, Observable, promise, async iterable) under the queue trampoline
(synchronous traces) and asap (one element per microtask, interleaved with
other microtasks), iterator throws to the error channel, RxJS's exact
`TypeError` for unconvertible inputs, iterator release on early teardown
(asap path). The deprecated scheduler arguments, all over `scheduled` under
the queue scheduler: `from`, `of` (including `of(scheduler)`), `range`,
`empty`, `pairs`, `generate` (options field, positional after `iterate`,
positional after `resultSelector`), `throwError`, `startWith`, `endWith`,
`concat`, `merge` (with and without `concurrent`; the single-source form
ignores the scheduler, as RxJS does), `combineLatest` (including the
empty-array form); `delayWhen`'s `subscriptionDelay`. Virtual time:
`(frame, index)` execution order with nested schedules,
`now()`/`frame`/`index`/`maxFrames`, reschedule chains through child actions
and their cancellation via the original action, non-finite delays returning
a closed subscription, the `maxFrames` cut-off, work throws unwinding the
queue (remaining actions unsubscribed, error rethrown, frame left at the
failing action), `timer`/`interval` over virtual time, direct `VirtualAction`
construction (`index`, `delay`, `closed` after execution),
`VirtualAction.sortActions`, `VirtualTimeScheduler.frameTimeFactor`.
`animationFrameScheduler` / `animationFrame` (same reference): per-frame
batching (work admitted during a frame runs in the next one), zero-delay
reschedule chains one per frame, pre-frame cancellation, positive delays on
the async path; `animationFrames`: the shared default instance,
`{timestamp, elapsed}` records from a custom provider (deterministic) and
from the frame callback.

**Deviations/deferrals:** `ConnectableObservable`, `Scheduler`,
`VirtualTimeScheduler`, and `VirtualAction` are non-constructible functional
factories carrying the class statics as properties; `refCount` reads an
internal connection-protocol record instead of `_refCount`/`_connection`
fields and rejects non-connectable sources with its own `TypeError`; asap and
animationFrame share one batch machine whose zero-delay action, rescheduled
at a positive delay, returns a fresh async action rather than itself, and a
throwing batch drops (rather than unsubscribes) its remainder; an emptied
animation frame is not cancelled (the flush is a no-op); `scheduleIterable`
releases the iterator on early teardown under every scheduler — RxJS's queue
action loses its scheduler reference when unsubscribed mid-trampoline,
throws inside the flush, and never returns the teardown (a swallowed crash;
certified on the asap path only); a virtual action's `delay` keeps the
absolute frame after unsubscribe (RxJS nulls it); `scheduleAsyncIterable`
keeps RxJS's unhandled rejection of a failing async iterator; replay windows
interleave `[value, expiry]` in one buffer exactly as RxJS, on a subject
record that stays a mutable hub.

## M19 package parity

The package has RxJS 7.8.2's shape: `main`/`module`/`es2015`/`types`, an
export map whose conditions are `types`, `node`, `require`, `es2015`,
`default` in RxJS's order (Node and `require` resolve to the CommonJS build,
bundlers to the ES module build), `./package.json`, and the `./operators`
subpath (`src/operators/index.ts`, generated against the oracle list: the
root operators re-exported plus the seven operator-form names —
`combineLatest`, `concat`, `merge`, `zip`, `race`, `partition`,
`onErrorResumeNext` — from `src/compat/legacy-operators.ts`). The two
remaining oracle names, `__esModule` and `default`, are exactly what this
shape produces: the oracle manifest was captured by importing `rxjs` through
Node, which resolves the `node` condition to CommonJS and exposes the interop
artifacts; this package is measured through the same door
(`tools/export-names.mjs`). `tools/check-package.mjs` gates it: the
export-map shape, and for each implemented subpath the Node import view, the
`require` view, the ES module file's own namespace, and the declaration
file's value exports (through the TypeScript checker, diagnostics included)
must agree. The operator forms are differentially certified
(`operators-subpath` suite). Out of scope, and reported as such by the tools:
`./ajax`, `./fetch`, `./testing`, `./webSocket` — separate feature surfaces
never part of the 175-name mission.

## M20 differential certification

`tools/compare-exports.mjs` is strict: a missing or unexpected export on any
implemented subpath fails `npm run verify`. `tools/certification-matrix.mjs`
derives `docs/CERTIFICATION-MATRIX.md` and `feature-parity-list.md` from the
oracle manifest, Node's view of the built package, and the oracle import
lists of every differential suite, and fails on any exported oracle name no
suite traces; the `certification` suite closes the last twelve (the error
factories' identities and messages, the scheduler alias names, `identity`,
`noop`). Newer Node versions add a `module.exports` name to CommonJS
namespaces; the snapshot and parity tools exclude it as a Node artifact.

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
`startWith`/`endWith` landed in M18 over `scheduled`; `Notification` is a
non-constructible functional
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
`range`, `empty`, `pairs`, and `generate` landed in M18 over `scheduled`; a
function carrying `Symbol.observable` is used as a functional
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
`delayWhen`'s deprecated `subscriptionDelay` argument landed in M18;
`TimeoutError` is a functional factory over
platform `Error` (identity via `name`), like the other parity errors.

## M13 certified scope

Queue trampoline flattening of nested zero-delay work; sync → queue → asap
(microtask) → async (macrotask) ordering; asap flush batching including work
scheduled mid-flush; interval-recycled self-rescheduling with terminal state;
pre-fire cancellation of async and asap actions; `observeOn` asynchronous
re-emission with completion; `subscribeOn` deferred subscription. RxJS's
`this`-bound work signature is adapted to `(state, action)` (recorded
functional deviation); `animationFrameScheduler`, `Scheduler`, `scheduled`,
and virtual time landed in M18, which also closed the asap batch at flush
start (work admitted mid-flush runs in the next microtask, as in RxJS).

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
`retryWhen`/`repeatWhen`/`onErrorResumeNext` landed in M17 and `throwError`'s
scheduler argument in M18.

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
(safe-boundary handler-throw edges not claimed); replay time windows and the
`shareReplay` clock argument landed in M18.

## Interpretation of export parity

The 175/175 score measures root-name coverage: every name exists, and `docs/CERTIFICATION-MATRIX.md` records which differential suites certify each one. It is still not a claim of bit-for-bit equivalence — the recorded deviations stand.

A root export can also have intentionally narrowed overload/interoperability scope. Such gaps are recorded explicitly rather than hidden by the export count.

## Intentional architectural deviations

The canonical kernel does not provide RxJS OO invocation as its architecture:

- no constructible Observable class;
- no Subscriber inheritance;
- no Subscription class hierarchy;
- no prototype operator methods;
- no subclass extension model.

Feature capability and observable behavior are the compatibility target.

## Final policy

Since M19-M20, package/export parity is strict: `npm run verify` fails on any missing or unexpected export of an implemented subpath, on any disagreement between the package's import, require, ES-module, and declaration views, and on any exported oracle name without differential coverage. Every milestone must maintain:

- explicit semantic scope;
- zero accidental unexpected root exports;
- functional extensions tracked separately;
- differential evidence for parity claims.
