# RxJS 7.8.2 Parity

## Current milestone: M03 — Functional Observable

M03 establishes the first complete execution skeleton: lazy Observable execution functions compose with the M02 Subscriber notification machine and the M01 Subscription lifecycle.

| Dimension | M03 status |
| --- | --- |
| Behavioral oracle | pinned `rxjs@7.8.2` |
| Architecture gate | passes across 8 TypeScript runtime files |
| Unit tests | 24 / 24 |
| Differential tests | 25 / 25 total |
| New M03 differential traces | 8 |
| RxJS root exports implemented | 6 / 175 = 3.4% |
| Functional root extensions | 5 |
| Unexpected root exports | 0 |
| Distribution architecture | passes across 16 emitted JavaScript files |

## Root parity exports implemented through M03

- `Subscription`
- `UnsubscriptionError`
- `Subscriber`
- `config`
- `Observable`
- `pipe`

An export name being present is not by itself a claim that every historical method-shaped capability attached to the corresponding RxJS class has already been reimplemented. Semantic certification remains milestone-scoped.

For example, M03 certifies the Observable execution/subscription boundary, not yet every RxJS `Observable.prototype` convenience such as `forEach` or interop methods. Those capabilities are recovered functionally when their feature milestones arrive.

## Functional root extensions

The deliberate FP-only root additions are tracked separately in `reference/functional-exports.json`:

- `createSubscription`
- `createSubscriber`
- `createObservable`
- `subscribe`
- `pipeValue`

These extensions never count toward RxJS export parity.

## M03 certified semantic scope

The functional Observable matches RxJS 7.8.2 for the tested execution boundary:

1. construction is lazy;
2. independent subscriptions execute independently;
3. synchronous `next` / terminal ordering is preserved;
4. a teardown returned after synchronous completion executes immediately;
5. source exceptions are routed through the Subscriber error channel;
6. manual unsubscription runs source teardown without synthesizing completion;
7. an existing Subscriber is reused rather than wrapped;
8. a returned child Subscription becomes owned teardown work;
9. initializer `this` refers to the Observable representation;
10. root `pipe` preserves RxJS unary-function composition behavior.

The eight M03 differential tests group those properties into reusable traces and all match `rxjs@7.8.2`.

## Previously certified scope

### M01 — Subscription

Seven differential lifecycle traces certify idempotent unsubscribe, parent/child ownership, explicit removal, structural finalizers, add-after-close behavior, and nested teardown-error aggregation.

### M02 — Subscriber / safe consumer

Nine differential traces certify active/stopped notification behavior, direct unsubscribe, Subscriber destination chaining, raw destination failures, safe user-handler error reporting, missing error-handler reporting, and stopped-notification reporting.

## Intentional architectural deviations

The functional kernel does not promise OO invocation compatibility:

- `new Subscription()` is not canonical and is intentionally unsupported;
- `new Subscriber()` is intentionally unsupported;
- `new Observable()` is intentionally unsupported;
- prototype methods and subclassing are intentionally absent.

The target is feature capability and observable semantics through a functional API.

## Export-parity policy

`reference/exports.json` is generated from the pinned RxJS 7.8.2 package. `npm run parity:exports` reports:

- implemented RxJS root exports;
- missing RxJS root exports;
- declared functional extensions;
- accidental unexpected exports.

Full strict export/package parity becomes an M19-M20 gate. Behavioral parity is enforced incrementally from the first runtime milestone onward.
