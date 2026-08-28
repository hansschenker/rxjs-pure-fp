# RxJS 7.8.2 Parity

## Current milestone: M04 — First Functional RxJS Pipeline

M04 proves the complete functional path from source creation through operator composition to subscription.

| Dimension | M04 status |
| --- | --- |
| Behavioral oracle | pinned `rxjs@7.8.2` |
| Architecture gate | passes across 12 TypeScript source files |
| Unit tests | 32 / 32 |
| Differential tests | 33 / 33 total |
| New M04 differential traces | 8 |
| RxJS root exports implemented | 9 / 175 = 5.1% |
| Functional root extensions | 5 |
| Unexpected root exports | 0 |
| Distribution architecture | passes across 24 emitted JavaScript files |

## Root parity exports through M04

- `Subscription`
- `UnsubscriptionError`
- `Subscriber`
- `config`
- `Observable`
- `pipe`
- `of`
- `map`
- `filter`

## Functional extensions

Tracked separately and never counted toward RxJS parity:

- `createSubscription`
- `createSubscriber`
- `createObservable`
- `subscribe`
- `pipeValue`

## M04 certified scope

### `of`

- synchronous emission order;
- each argument emitted as one value without flattening;
- completion after ordinary emission;
- synchronous source loop observes cancellation via `subscriber.closed`.

The deprecated scheduler overload is not yet certified and belongs to scheduler work.

### `map`

- one projected value per source value;
- projection receives per-subscription index beginning at zero;
- projection failure enters the downstream error channel;
- failure tears down the synchronous upstream chain;
- deprecated `thisArg` behavior is preserved.

### `filter`

- predicate receives per-subscription index beginning at zero;
- only truthy predicate results are forwarded;
- predicate failure enters the downstream error channel;
- deprecated `thisArg` behavior is preserved.

### operator lifecycle

M04 certifies that an operator's upstream child Subscriber is owned by the downstream Subscriber before source execution begins. This provides correct synchronous cancellation propagation through an operator chain.

## M04 differential traces

1. first `of → map → filter → subscribe` pipeline;
2. map/filter index reset on each subscription;
3. map projection error;
4. filter predicate error;
5. synchronous downstream cancellation through the chain;
6. `of` value shape/non-flattening;
7. deprecated map/filter `thisArg` behavior;
8. raw downstream `next` failure through `map`.

All eight match RxJS 7.8.2.

## Previously certified scope

- **M01:** seven Subscription lifecycle traces.
- **M02:** nine Subscriber/safe-consumer traces.
- **M03:** eight Observable execution-boundary traces.
- **M00:** differential harness oracle self-test.

## Interpretation of the 9/175 score

Export count measures package-surface progress, not architectural or semantic effort. M04 adds only three root names, but establishes reusable operator plumbing that later operator milestones can share.

An export being present also does not imply every deprecated overload or related scheduler/platform capability is already certified. The parity document records milestone-specific semantic scope explicitly.

## Intentional deviations

The kernel does not support class construction/subclassing as its canonical API. `Observable`, `Subscriber`, and `Subscription` are functional parity names rather than constructible classes.

## Final parity policy

M19-M20 make full package/export parity strict. Until then, every milestone must keep:

- zero accidental unexpected root exports;
- explicit FP extensions separated from parity exports;
- differential evidence for every semantic claim made by that milestone.
