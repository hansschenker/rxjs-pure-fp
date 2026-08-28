# Execution Plan

## M00-M04: prove the kernel

- **M00 Foundation ✅** — oracle, reference material, architecture gate, differential harness, build and parity tooling.
- **M01 Functional Subscription ✅** — closure-owned teardown state, idempotent cancellation, nested ownership, explicit removal, structural unsubscribables, aggregated teardown errors.
- **M02 Functional Sink — next** — `next/error/complete`, stopped state, guarded forwarding, finalization.
- **M03 Functional Observable** — lazy execution description, standalone subscription, standalone pipeline composition.
- **M04 First Vertical Slice** — `of` plus representative `map`/`filter` pipeline end-to-end with differential evidence.

M00-M04 are deliberately reviewed one at a time because they determine the exact functional kernel.

### What M01 established for M02

M02 can now treat cancellation as an independent functional service rather than inheriting lifecycle behavior from a Subscriber class. A sink can own or compose a `Subscription` record without becoming that record through inheritance.

The established lifecycle contract includes:

- `closed` becomes true before teardown runs;
- unsubscription is idempotent;
- initial teardown precedes added finalizers;
- children can belong to multiple parents and self-detach;
- removing a child removes ownership without cancelling it;
- finalizers added after closure execute immediately;
- all finalizers are attempted even when earlier teardown throws;
- nested unsubscription errors flatten into one aggregate error.

These invariants become assumptions for M02's sink/stopped-state design.

## M05-M20: recover the RxJS 7.8.2 machine

- **M05 Projection & querying** — map/filter/tap/scan/reduce/pairwise/distinct family.
- **M06 Selection & gating** — take/skip/first/last/single/elementAt and notifier variants.
- **M07 Higher-order kernel** — inner-subscription execution machinery.
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
- **M18 Remaining 7.8.2 surface** — uncommon and deprecated-but-public functionality needed for feature equality.
- **M19 Package parity** — subpath exports, declarations, ESM/CJS package surfaces.
- **M20 Differential certification** — final export and behavioral parity matrix.

## Milestone gates

Every milestone must satisfy three independent gates:

1. **Architecture** — no classes, inheritance, or disguised prototype OO.
2. **API scope** — the exports promised by that milestone exist and are tracked.
3. **Behavior** — differential traces match `rxjs@7.8.2` for the milestone scenarios.
