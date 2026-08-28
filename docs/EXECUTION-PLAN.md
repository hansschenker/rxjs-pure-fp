# Execution Plan

## Session grouping

M00 is the project foundation. Runtime work is grouped into four five-milestone sessions:

```text
Session 1  M01-M05
Session 2  M06-M10
Session 3  M11-M15
Session 4  M16-M20
```

## Session 1 — establish the kernel and first-order vocabulary

- **M01 Functional Subscription ✅** — closure-owned lifecycle and teardown ownership.
- **M02 Functional Sink ✅** — notification state composed with lifecycle.
- **M03 Functional Observable ✅** — lazy execution function and standalone subscription.
- **M04 First Functional Pipeline ✅** — `of`, `map`, `filter`, functional operator plumbing, end-to-end pipeline.
- **M05 Projection & Querying — next** — tap/scan/reduce/pairwise/distinct family and generalized terminal/finalization operator policies.

## What M04 established for M05

M05 can build every first-order operator as a policy over the M01-M04 kernel:

```text
source Observable
      │
      ▼
operator child Subscriber
      │
      ▼
destination Subscriber
```

Permanent first-order rules:

1. operator construction is lazy;
2. mutable operator state is allocated per subscription;
3. the operator child is attached to downstream ownership before source execution;
4. operator callback errors enter the downstream error channel;
5. downstream cancellation closes operator children synchronously;
6. synchronous sources observe upstream closure before their next emission;
7. terminal notifications tear down the chain;
8. cancellation never synthesizes completion.

## M05 acceptance target

M05 expands the first-order vocabulary while reusing the same execution topology:

- `tap`
- `scan`
- `reduce`
- `pairwise`
- `distinct`
- `distinctUntilChanged`
- `distinctUntilKeyChanged`

The functional OperatorSubscriber helper may be generalized to support custom error, complete, and finalize policies, but the lifecycle/Observable model must not be redesigned.

M05 must differentially verify state reset per subscription, accumulator/seed behavior, completion-time emission, previous-value memory, distinct Set/key policies, callback failures, and finalization ordering where applicable.

## Remaining sessions

### Session 2 — M06-M10

- **M06 Selection & gating** — take/skip/first/last/single/elementAt and notifier/value variants.
- **M07 Higher-order kernel** — inner-subscription execution machinery.
- **M08 Flattening policies** — mergeMap/concatMap/switchMap/exhaustMap and relatives.
- **M09 Multi-source coordination** — merge/concat/combineLatest/zip/race/forkJoin/withLatestFrom.
- **M10 Functional Subjects** — Subject/BehaviorSubject/ReplaySubject/AsyncSubject.

### Session 3 — M11-M15

- **M11 Sharing topology** — connectable/connect/share/shareReplay.
- **M12 Error & resubscription** — catchError/retry/repeat/finalize families.
- **M13 Scheduler kernel** — queue/asap/async/animation-frame policies.
- **M14 Temporal operators** — timer/interval/delay/debounce/audit/throttle/sample/timeout.
- **M15 Boundary & collection** — buffer/window/groupBy families.

### Session 4 — M16-M20

- **M16 Platform sources** — events/callbacks/ajax/fetch/WebSocket.
- **M17 Testing runtime** — virtual time/TestScheduler-equivalent capability.
- **M18 Remaining 7.8.2 surface** — close uncommon/deprecated public gaps.
- **M19 Package parity** — strict subpath/declaration/ESM/CJS compatibility.
- **M20 Differential certification** — final behavioral/export matrix.

## Milestone gates

Every milestone must satisfy:

1. **Architecture** — no classes, inheritance, or disguised prototype OO.
2. **API scope** — exports/capabilities promised by the milestone are tracked honestly.
3. **Behavior** — differential traces match `rxjs@7.8.2`.

`README.md` is the canonical public milestone narrative; this document is the execution checklist.
