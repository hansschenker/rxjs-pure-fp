# RxJS 7.8.2 Parity

## Current milestone: M02 — Functional Sink

M02 implements the Subscriber notification responsibility by composing the M01 Subscription lifecycle with lexical stop/destination state and structural `next/error/complete` functions.

| Dimension | M02 status |
| --- | --- |
| Behavioral oracle pinned | `rxjs@7.8.2` |
| Architecture gate | passes with no class, `extends`, `super`, prototype mutation, or project-defined `new` |
| TypeScript runtime source files checked | 6 |
| Unit tests | 16 / 16 pass across M00-M02 |
| M01 differential lifecycle traces | 7 match RxJS 7.8.2 |
| M02 differential sink traces | 9 match RxJS 7.8.2 |
| Total differential tests | 17 / 17 pass including M00 oracle self-test |
| RxJS root exports implemented | `Subscription`, `UnsubscriptionError`, `Subscriber`, `config` |
| Functional root extensions | `createSubscription`, `createSubscriber` |
| Root export parity | 4 / 175 = 2.3% |
| Unexpected root exports | 0 |
| Distribution architecture | 12 emitted JavaScript files verified class/prototype-free |

## M01 semantic parity retained

The functional Subscription continues to match RxJS 7.8.2 for:

- open → closed lifecycle transition;
- idempotent `unsubscribe()`;
- initial teardown before registered finalizers;
- function and structural `{ unsubscribe() }` finalizers;
- immediate execution when a finalizer is added after closure;
- duplicate finalizers and one-at-a-time `remove()` behavior;
- child ownership and cascading teardown;
- explicit child removal without cancelling the child;
- child self-detachment from multiple parents;
- continued finalization after teardown errors;
- nested unsubscription-error flattening;
- compatible `UnsubscriptionError` name, message, and `errors` payload.

## M02 semantic parity scope

Nine M02 differential scenarios match RxJS 7.8.2.

### 1. Notification and terminal ordering

`next` notifications reach an active raw destination in order. `complete` stops the Subscriber and triggers lifecycle teardown. Later `next/error/complete` calls do not reach the destination.

### 2. Direct unsubscription

Direct `unsubscribe()` sets the Subscriber to stopped and closes the M01 lifecycle. It does not synthesize `complete`. Later notifications are ignored by the destination.

### 3. Destination Subscriber chaining

If a Subscriber is the destination of another Subscriber, the destination owns the child's lifecycle. Unsubscribing the destination cascades cancellation to the child, matching RxJS constructor chaining.

### 4. Raw `next` handler errors

A raw destination `next` handler that throws propagates that error synchronously. The Subscriber is not automatically stopped or closed by that thrown `next` handler.

### 5. Raw terminal-handler errors

A raw destination `error` handler may throw synchronously, but the Subscriber still finalizes in `finally`. The same implementation policy is used for completion finalization.

### 6. Safe callback adaptation

The deprecated `Subscriber.create(next, error, complete)` parity helper is retained as a functional adapter. It creates the safe user-consumer boundary without a `SafeSubscriber` subclass.

### 7. Safe user-handler errors

Errors thrown from safe user callbacks are reported asynchronously through `config.onUnhandledError` when configured, matching RxJS 7.8.2.

### 8. Missing safe error handler

An `error` notification with no supplied safe error handler closes the Subscriber immediately and reports the source error asynchronously.

### 9. Stopped notifications

Notifications arriving after the Subscriber has stopped do not reach the destination. With `config.onStoppedNotification` configured, those ignored notifications are reported asynchronously with the stopped Subscriber.

## Config parity scope

`config` is now present as an RxJS root parity export because Subscriber behavior depends on it.

M02 behaviorally exercises:

- `onUnhandledError`;
- `onStoppedNotification`;
- `useDeprecatedNextContext` in unit coverage.

The RxJS-shaped fields `Promise` and `useDeprecatedSynchronousErrorHandling` are also present. Their complete observable-level semantics are not claimed by M02. They will be certified when later milestones implement the execution paths that consume them.

## Functional API versus parity names

Canonical functional APIs after M02:

```ts
createSubscription(initialTeardown?)
createSubscriber(destination?)
```

RxJS root parity names implemented so far:

```text
Subscription
UnsubscriptionError
Subscriber
config
```

`Subscription`, `UnsubscriptionError`, and `Subscriber` are ordinary non-constructible functions in the functional kernel. OO invocation forms such as `new Subscriber()` are intentional architectural deviations.

`reference/functional-exports.json` records deliberate FP additions so the parity reporter distinguishes implemented RxJS exports, functional extensions, and accidental unexpected exports.

## Export parity is not yet feature certification

The 4/175 number measures root-name presence, not complete library feature equality. In particular, `config` is present because M02 requires part of its behavior, but not every future consumer of every config field exists yet.

Behavioral claims are milestone-scoped and require differential evidence. Full feature/export certification remains the M19/M20 target.

## Intentional architectural deviations

The project does not promise OO invocation compatibility such as `new Observable()`, inheritance, or prototype methods as its canonical API. It targets observable behavior and feature capability through a functional runtime.
