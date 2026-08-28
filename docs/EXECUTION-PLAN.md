# Execution Plan

## Session grouping

M00 is the project foundation. The 20 runtime milestones are grouped into four five-milestone working sessions:

```text
Session 1  M01-M05
Session 2  M06-M10
Session 3  M11-M15
Session 4  M16-M20
```

## M00-M05: establish and prove the kernel

- **M00 Foundation ✅** — oracle, ES3 reference boundary, architecture gate, differential harness, build and parity tooling.
- **M01 Functional Subscription ✅** — closure-owned teardown state, idempotent cancellation, ownership/removal, structural finalizers, aggregated teardown errors.
- **M02 Functional Sink ✅** — `next/error/complete`, stopped state, raw versus safe consumer boundary, lifecycle chaining, config-driven reports.
- **M03 Functional Observable ✅** — lazy execution function, standalone subscribe, independent execution, source teardown attachment, RxJS-compatible `pipe`.
- **M04 First Functional Pipeline — next** — `of`, `map`, `filter`, data-first composition, end-to-end differential proof.
- **M05 Projection & Querying** — expand to tap/scan/reduce/pairwise/distinct variants and certify family behavior.

## What M03 established for M04

M04 does not need another execution mechanism. It can define creation and operators entirely in terms of the existing kernel:

```text
creation operator
      │
      ▼
Observable execution function
      │
      ▼
operator(source)
      │
      ▼
new Observable execution function
      │
      ▼
subscribe(observer)
```

The permanent M01-M03 assumptions are:

- Observable construction is inert;
- each ordinary subscription executes the source independently;
- Subscriber is the notification boundary;
- Subscription owns all teardown;
- synchronous termination can occur before returned teardown is attached;
- adding teardown to a closed Subscriber executes it immediately;
- cancellation is not completion;
- source exceptions enter the Subscriber error channel;
- an existing Subscriber retains identity.

## M04 acceptance target

The first complete functional pipeline should be expressible as:

```ts
const result$ = pipeValue(
  of(1, 2, 3),
  map(value => value * 10),
  filter(value => value > 10)
);

subscribe({ next: console.log })(result$);
```

Expected values:

```text
20
30
```

The implementation must prove end-to-end parity against RxJS 7.8.2 for value ordering, projection/predicate errors, completion, and cancellation through an operator chain.

## M05-M20: recover the complete RxJS 7.8.2 machine

- **M05 Projection & querying** — map/filter/tap/scan/reduce/pairwise/distinct family.
- **M06 Selection & gating** — take/skip/first/last/single/elementAt and notifier/value variants.
- **M07 Higher-order kernel** — shared inner-subscription execution machinery.
- **M08 Flattening policies** — mergeMap/concatMap/switchMap/exhaustMap and flattening relatives.
- **M09 Multi-source coordination** — merge/concat/combineLatest/zip/race/forkJoin/withLatestFrom.
- **M10 Functional Subjects** — Subject, BehaviorSubject, ReplaySubject, AsyncSubject.
- **M11 Sharing topology** — connectable/connect/share/shareReplay and multicast semantics.
- **M12 Error & resubscription** — catchError/retry/retryWhen/repeat/repeatWhen/finalize.
- **M13 Scheduler kernel** — queue/asap/async/animation-frame policies without scheduler classes.
- **M14 Temporal operators** — timer/interval/delay/debounce/audit/throttle/sample/timeout.
- **M15 Boundary & collection** — buffer/window/groupBy families.
- **M16 Platform sources** — events/callbacks/ajax/fetch/WebSocket.
- **M17 Testing runtime** — virtual time and TestScheduler-equivalent capability.
- **M18 Remaining 7.8.2 surface** — uncommon and deprecated-but-public feature gaps.
- **M19 Package parity** — subpath exports, declarations, ESM/CJS package surfaces.
- **M20 Differential certification** — final behavioral and export parity matrix.

## Milestone gates

Every milestone satisfies three independent gates:

1. **Architecture** — no classes, inheritance, or disguised prototype OO.
2. **API scope** — promised exports/capabilities exist and parity reporting remains honest.
3. **Behavior** — differential traces match `rxjs@7.8.2` for the milestone scenarios.

The README is the canonical public milestone narrative; this document is the execution checklist.
