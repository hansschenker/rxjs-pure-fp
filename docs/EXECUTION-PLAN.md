# Execution Plan

## Session cadence

M00 is the project foundation. Sessions 1-3 carried the runtime kernel through
M14 (Session 3 re-scoped to close at M14). The remaining **74 RxJS 7.8.2 root
exports** are planned as four feature sessions of 18 / 18 / 19 / 19, one
re-scoped milestone each, with the M19/M20 gates closing the final session:

```text
Session 1  M01-M05   ✅ complete
Session 2  M06-M10   ✅ complete
Session 3  M11-M14   ✅ complete (M15 moved to Session 4)
Session 4  M15       ✅ complete   boundary & collection      → 119/175 (68.0%)
Session 5  M16       ✅ complete   creation & interop         → 137/175 (78.3%)
Session 6  M17       ✅ complete   materialization & op tail  → 156/175 (89.1%)
Session 7  M18-M20   19 features   compat closure + gates     → 175/175 (100%)
```

# Session 1 — M01-M05 ✅

- **M01 Functional Subscription ✅** — closure-owned lifecycle, teardown ownership, error aggregation.
- **M02 Functional Sink ✅** — notification state, safe consumer boundary, lifecycle composition.
- **M03 Functional Observable ✅** — lazy execution function, standalone subscribe, source teardown attachment.
- **M04 First Functional Pipeline ✅** — `of`, `map`, `filter`, functional operator Subscriber, synchronous cancellation.
- **M05 Projection & Querying ✅** — `tap`, shared accumulation policy, `pairwise`, distinctness family, generalized operator terminal/finalize policies.

## Session 1 kernel

```text
Observable<T> = Subscriber<T> -> TeardownLogic

Operator<A,B> = Observable<A> -> Observable<B>
```

The concrete responsibilities are:

```text
Subscription   lifetime / teardown ownership
Subscriber     notification participation
Observable     lazy execution
Operator       lazy Observable transformation
```

First-order operator variation is expressed primarily through per-subscription closure state and configured notification handlers.

# Session 2 — M06-M10

## M06 — Selection & Gating ✅

Implement the selection families on the established first-order kernel:

- positional take/skip variants;
- value-driven takeWhile/skipWhile;
- notifier-driven takeUntil/skipUntil;
- first/last/single/elementAt and related termination/error semantics.

The main concern is no longer transformation but **when participation ends or begins**.

## M07 — Higher-Order Kernel ✅

Introduce reusable machinery for source values that create inner Observables:

```text
outer value
    │
 project
    ▼
inner Observable
    │
    ▼
inner Subscription lifecycle
```

Track active inner identity, completion, cancellation, and outer/inner termination interaction.

## M08 — Flattening Policies ✅

Express the four canonical concurrency policies over M07:

```text
mergeMap    allow overlap
concatMap   queue while busy
switchMap   cancel previous / keep latest
exhaustMap  ignore new while busy
```

Also recover the corresponding `*All` and related flattening exports where appropriate.

## M09 — Multi-Source Coordination ✅

Implement source coordination and joining:

- merge
- concat
- combineLatest
- zip
- race
- forkJoin
- withLatestFrom

Termination and subscription ordering are first-class test dimensions.

## M10 — Functional Subjects ✅

Implement multicast participation without inheritance:

```text
Subject          multicast hub
BehaviorSubject  hub + current value policy
ReplaySubject    hub + replay buffer policy
AsyncSubject     hub + last-on-complete policy
```

M10 closes Session 2 by proving that shared topology can also be expressed from functional state/policies.

# Session 3 — M11-M14 ✅

- **M11 Sharing topology ✅** — connectable/connect/share/shareReplay.
- **M12 Error & resubscription ✅** — catchError/retry/repeat/finalize + throwError.
- **M13 Scheduler kernel ✅** — timerHost edge + action machine + async/queue/asap policies; observeOn/subscribeOn.
- **M14 Temporal operators ✅** — timer/interval + delay/delayWhen, debounce/audit/throttle/sample and their *Time forms, timeout/timeoutWith/TimeoutError; retry/repeat numeric delays wired.

# Sessions 4-7 — the remaining 74 root exports

Each session is one re-scoped milestone with an exact feature list; every name
below is a missing `rxjs@7.8.2` root export from `feature-parity-list.md`.

## Session 4 — M15 Boundary & Collection (18) ✅

Value boundaries over Subjects + timers, and reduce-style aggregation:

```text
buffer   bufferCount   bufferTime   bufferToggle   bufferWhen
window   windowCount   windowTime   windowToggle   windowWhen
groupBy  partition
count    max   min   every   find   findIndex
```

Landed as planned: window/groupBy emit inner Subjects (M10),
bufferTime/windowTime ride the M14 timer surface via a repeating
`executeSchedule` variant, and groupBy's downstream release is
reference-counted (the functional replacement for RxJS's
`shouldUnsubscribe` guard). Notifiers, closing selectors, and group
durations remain functional-Observables-only until M16's `ObservableInput`
conversion.

## Session 5 — M16 Creation & Interop (18) ✅

`from`/`innerFrom` ObservableInput conversion is the session's core: it also
retires the "functional Observables only" deferrals recorded across
M05-M14 (flattening projections, notifiers, duration selectors, `with`
factories). Promise-consuming/producing surfaces add `Promise` to the
architecture gate's allowed platform constructors.

```text
from   fromEvent   fromEventPattern   bindCallback   bindNodeCallback
defer  iif   range   generate   using
empty  never   NEVER   pairs
isObservable   observable
firstValueFrom lastValueFrom
```

Landed as planned: `innerFrom` probes in RxJS's exact case order (function =
Observable by reference, interop carrier, array-like, promise, async
iterable, iterable, readable stream) and now converts at every kernel
boundary that takes user inputs — the M05-M15 functional-Observables-only
scope notes are retired. `Promise` joined the architecture gate's allowed
constructors for `firstValueFrom`/`lastValueFrom`; promise-fed consumer
crashes report through the F6 environment (`reportUnhandledError`).
Deprecated scheduler arguments of `from`/`range`/`empty`/`pairs`/`generate`
ride `scheduled` and moved to M18; `bindCallback`'s scheduler form landed on
`subscribeOn`/`observeOn`.

## Session 6 — M17 Materialization & Operator Tail (19) ✅

Notifications as data, stream metadata, and the deprecated operator algebra
tail (closing the M12 deferral names):

```text
materialize   dematerialize   Notification   NotificationKind
timeInterval  timestamp
startWith     endWith
ignoreElements   mapTo   pluck
toArray       isEmpty   sequenceEqual
retryWhen     repeatWhen   onErrorResumeNext   onErrorResumeNextWith
exhaust
```

Landed as planned: materialized notifications are frozen pure-data records
matching the class constructor's own fields, with the deprecated
`observe`/`do`/`accept`/`toObservable` methods attached non-enumerably on
the compat `Notification` factory records (kernel purity forbids
`defineProperties`, so the method surface is compat by construction).
`retryWhen`/`repeatWhen` port RxJS's `syncResub` handshake exactly —
synchronous sources complete `repeatWhen(take(2))` after the second run,
matching the oracle. `onErrorResumeNext` advances via teardown (`add` on a
closed subscriber runs immediately). The deprecated trailing-scheduler
forms of `startWith`/`endWith` joined the M18 `scheduled` deferrals.

## Session 7 — M18 Compat Closure + M19/M20 gates (19)

Deprecated multicast surface, the remaining scheduler shapes (an rAF edge
joins `timerHost` in runtime.ts; virtual time reuses the M13 action machine),
join-all aliases, and the package-shape artifacts:

```text
ConnectableObservable   multicast   refCount
publish   publishBehavior   publishLast   publishReplay
combineAll   combineLatestAll   zipAll
Scheduler   scheduled
animationFrame   animationFrames   animationFrameScheduler
VirtualAction   VirtualTimeScheduler
__esModule   default
```

Then the closing gates, which add no export names:

- **M19 Package parity** — strict subpath/declarations/ESM/CJS compatibility.
- **M20 Differential certification** — final behavioral/export matrix.

# Permanent milestone gates

Every milestone must pass independently:

1. **Architecture** — no classes, inheritance, or disguised prototype OO.
2. **API scope** — promised parity exports and intentional FP extensions are tracked honestly.
3. **Behavior** — differential traces match `rxjs@7.8.2` for every claimed semantic area.

`README.md` remains the canonical public project-page and milestone narrative.
