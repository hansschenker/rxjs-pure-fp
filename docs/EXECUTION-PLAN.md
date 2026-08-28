# Execution Plan

## M00-M04: prove the kernel

- **M00 Foundation ✅** — oracle, reference material, architecture gate, differential harness, build and parity tooling.
- **M01 Functional Subscription ✅** — closure-owned teardown state, idempotent cancellation, nested ownership, explicit removal, structural unsubscribables, aggregated teardown errors.
- **M02 Functional Sink ✅** — Subscriber notification protocol, stopped state, destination chaining, safe consumer adaptation, asynchronous error/stopped reporting.
- **M03 Functional Observable — next** — lazy execution description, standalone subscription, execution ownership, source teardown integration.
- **M04 First Vertical Slice** — `of` plus representative `map`/`filter` pipeline end-to-end with differential evidence.

M00-M04 are deliberately reviewed one at a time because they determine the exact functional kernel.

## What M01 established

M01 made cancellation an independent functional service rather than something Subscriber must inherit.

The lifecycle contract includes:

- `closed` becomes true before teardown runs;
- unsubscription is idempotent;
- initial teardown precedes added finalizers;
- children can belong to multiple parents and self-detach;
- removing a child removes ownership without cancelling it;
- finalizers added after closure execute immediately;
- all finalizers are attempted even when earlier teardown throws;
- nested unsubscription errors flatten into one aggregate error.

## What M02 established

M02 composes notification behavior onto the same M01 lifecycle record.

The sink/subscriber contract now includes:

- `next(value)` forwards only while the Subscriber is active;
- `error(error)` is terminal, sets stop-state before delivery, and finalizes in `finally`;
- `complete()` is terminal, sets stop-state before delivery, and finalizes in `finally`;
- direct unsubscription stops notifications without synthesizing completion;
- `closed` and `isStopped` are separate state concepts;
- a Subscriber destination owns the child Subscriber lifecycle through M01 `add` semantics;
- raw destination handler failures preserve RxJS synchronous behavior;
- safe user-callback failures are reported asynchronously;
- missing safe error handlers report the source error asynchronously;
- notifications to stopped Subscribers are not delivered and may be asynchronously observed through `config.onStoppedNotification`;
- deprecated next-context behavior can be represented with context + closure + `Reflect.apply`, without prototype binding.

M02 also established a reusable multi-file TypeScript strategy: source modules may use explicit `.ts` relative specifiers, with `rewriteRelativeImportExtensions` converting them to emitted JavaScript paths during builds.

## M03 — Functional Observable

M03 can now focus on the actual Observable responsibility instead of re-solving lifecycle or consumer safety.

The milestone must determine the exact representation of a lazy Observable execution description and prove these invariants:

1. Constructing an Observable does not execute source work.
2. Each ordinary subscription creates independent execution state.
3. `subscribe` creates or accepts the M02 functional Subscriber boundary.
4. Source teardown is added to the M01 lifecycle correctly.
5. Synchronous source emissions preserve RxJS 7.8.2 ordering.
6. Synchronous source errors route through the Subscriber protocol.
7. Completion finalizes exactly once.
8. Explicit cancellation stops source work without manufacturing completion.
9. A source that returns another subscription/unsubscribable participates in lifecycle ownership correctly.
10. No `Observable` class, `lift`, prototype method, or inheritance hierarchy is required by the kernel.

M03 should initially stay narrow. It should establish the Observable execution boundary before M04 adds creation and transformation operators.

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

Export presence alone is not semantic certification. Each behavioral claim must be backed by milestone-scoped differential evidence.
