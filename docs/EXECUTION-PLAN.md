# Execution Plan

## Four-session runtime cadence

M00 is the project foundation. The 20 runtime milestones are grouped into four five-milestone sessions:

```text
Session 1  M01-M05   ✅ complete
Session 2  M06-M10   ✅ complete
Session 3  M11-M15   in progress — M11 ✅ M12 ✅ M13 ✅ M14 ✅
Session 4  M16-M20
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

# Session 3 — M11-M15

- **M11 Sharing topology ✅** — connectable/connect/share/shareReplay.
- **M12 Error & resubscription ✅** — catchError/retry/repeat/finalize + throwError.
- **M13 Scheduler kernel ✅** — timerHost edge + action machine + async/queue/asap policies; observeOn/subscribeOn.
- **M14 Temporal operators ✅** — timer/interval + delay/delayWhen, debounce/audit/throttle/sample and their *Time forms, timeout/timeoutWith/TimeoutError; retry/repeat numeric delays wired.
- **M15 Boundary & collection** — buffer/window/groupBy families.

# Session 4 — M16-M20

- **M16 Platform sources** — events/callbacks/ajax/fetch/WebSocket.
- **M17 Testing runtime** — virtual time/TestScheduler-equivalent behavior.
- **M18 Remaining 7.8.2 surface** — close uncommon/deprecated public gaps.
- **M19 Package parity** — strict subpath/declarations/ESM/CJS compatibility.
- **M20 Differential certification** — final behavioral/export matrix.

# Permanent milestone gates

Every milestone must pass independently:

1. **Architecture** — no classes, inheritance, or disguised prototype OO.
2. **API scope** — promised parity exports and intentional FP extensions are tracked honestly.
3. **Behavior** — differential traces match `rxjs@7.8.2` for every claimed semantic area.

`README.md` remains the canonical public project-page and milestone narrative.
