# Architecture

## Architectural thesis

RxJS 7.8.2 defines the observable behavior. `rxjs-pure-fp` intentionally replaces its historical OO runtime architecture with functional composition.

The project is not a mechanical rewrite of `class` into constructor functions. The ES3 reference exposes runtime responsibilities; those responsibilities are then recomposed from functions, closures, structural values, and explicit policies.

## Target runtime vocabulary

| RxJS responsibility | Pure FP representation |
| --- | --- |
| Observable | lazy execution function / description |
| Observer | structural sink of `next`, `error`, `complete` functions |
| Subscriber | Observer protocol + stop-state + Subscription lifecycle |
| Subscription | lifecycle closure containing teardown state |
| SafeSubscriber / ConsumerObserver | guarded user-consumer adapter |
| Operator | `Observable<A> -> Observable<B>` |
| Subject | multicast closure and observer registry |
| BehaviorSubject | multicast + remembered current value policy |
| ReplaySubject | multicast + replay buffer policy |
| AsyncSubject | multicast + remember-latest + complete-emission policy |
| Scheduler | clock + queue + scheduling/flush policy |

## Construction state and execution state

Pipeline construction must be inert. A pipeline describes a dataflow; it does not execute it.

Each ordinary subscription creates its own execution state. Closure state that belongs to one execution must be allocated when that execution starts, not while the Observable description is constructed.

Shared state is exceptional and explicit. Subject and sharing operators intentionally introduce a topology in which multiple subscribers participate in one execution or multicast hub.

## No disguised OO

Removing the `class` keyword is insufficient. The following architecture is also rejected:

```text
constructor function
+ prototype methods
+ prototype inheritance
```

The target is:

```text
closure state
+ structural records
+ operations over that state
+ higher-order composition
```

The source architecture gate enforces the stronger rule that even type-level `extends` is absent from `src/`; structural type composition uses intersections instead.

## M01 realized kernel — Functional Subscription

M01 established the first concrete runtime representation:

```text
createSubscription(initialTeardown?)
        │
        ├── closure: closed
        ├── closure: parentage
        ├── closure: finalizers
        │
        └── returned structural record
              ├── closed
              ├── add(teardown)
              ├── remove(teardown)
              └── unsubscribe()
```

The returned record is not a constructor instance and has no prototype-owned behavior. `closed`, parent ownership, and finalizer storage live in the lexical environment created by `createSubscription`.

Parent/child subscription coordination uses module-private symbol-keyed functions on the returned structural record. These are private record-to-record coordination hooks, not public API or prototype methods. No module-global registry owns subscription state.

The lifecycle transition is:

```text
open
 │
 ├── add finalizer
 ├── add child subscription
 ├── remove finalizer/child
 │
 └── unsubscribe
       │
       ├── mark closed first
       ├── detach from parents
       ├── run initial teardown
       ├── run all finalizers in order
       ├── aggregate teardown errors
       └── remain permanently closed
```

`unsubscribe()` is idempotent. Adding a finalizer after closure executes it immediately, matching RxJS 7.8.2.

## M02 realized kernel — Functional Sink / Subscriber

RxJS models Subscriber through inheritance:

```text
Subscription
     ▲
     │
 Subscriber
     ▲
     │
SafeSubscriber
```

M02 decomposes this into independent responsibilities:

```text
M01 lifecycle record
      +
notification stop-state
      +
destination forwarding
      =
functional Subscriber
```

More concretely:

```text
createSubscription()
        │
        ▼
structural lifecycle record
        │
        │ enrich same record
        ▼
createSubscriber(destination)
        │
        ├── closure: isStopped
        ├── closure: destination
        ├── next(value)
        ├── error(error)
        ├── complete()
        └── unsubscribe()
```

### Why the same structural record is enriched

M01's parent/child semantics are identity-sensitive: a child subscription removes the exact structural record from its parents when it tears down. Wrapping that lifecycle in a second object would introduce a second identity and complicate those semantics.

M02 therefore enriches the same M01 record with own notification properties. This is localized record mutation, not prototype mutation. The record's lifecycle identity stays stable while its responsibility set grows through composition.

### Two state machines, one execution participant

A Subscriber coordinates two distinct state spaces:

```text
Subscription lifecycle       Notification protocol
----------------------       ---------------------
closed                       isStopped
parentage                    destination
finalizers                   next/error/complete
```

`closed` means lifecycle teardown has occurred. `isStopped` means notifications are no longer accepted. They often transition together but they are not synonyms.

### Terminal notifications

`error` and `complete` first stop notifications, then call the destination, then finalize in `finally`:

```text
active
  │
  ├── error(err)
  │      ├── isStopped = true
  │      ├── destination.error(err)
  │      └── unsubscribe() in finally
  │
  └── complete()
         ├── isStopped = true
         ├── destination.complete()
         └── unsubscribe() in finally
```

This guarantees teardown even if a raw destination's terminal handler throws.

Direct `unsubscribe()` stops notifications and tears down lifecycle without manufacturing a completion notification.

### Destination chaining

If the destination is itself a functional Subscriber/Subscription, M02 uses the already-existing M01 ownership relation:

```text
destination Subscriber
          │
          │ add(child)
          ▼
 child Subscriber
```

Unsubscribing the destination cascades to the child, matching RxJS Subscriber chaining.

## Safe user-consumer boundary

Raw Subscriber forwarding and safe user-callback invocation are separate responsibilities.

```text
partial observer / callbacks
          │
          ▼
createConsumerObserver
  ├── catch next handler errors
  ├── catch error handler errors
  ├── catch complete handler errors
  └── handle missing error handler
          │
          ▼
createSubscriber(...)
```

This avoids recreating `SafeSubscriber extends Subscriber`.

Safe handler errors are reported out of band through `config.onUnhandledError` or the runtime's uncaught-error mechanism, matching RxJS 7.8.2.

Notifications sent to a stopped Subscriber are not forwarded. If `config.onStoppedNotification` is configured, they are reported asynchronously.

## Deprecated context path without prototype binding

RxJS 7.8.2 uses a captured `Function.prototype.bind` for the deprecated next-context compatibility path. The architecture gate correctly rejects copying that mechanism.

M02 instead uses:

```text
handler + context
       │
       ▼
closure(...args)
       │
       ▼
Reflect.apply(handler, context, args)
```

This preserves the compatibility behavior while avoiding prototype mechanics.

## Config as execution policy

M02 introduces the root `config` parity export because Subscriber semantics depend on it. The fields are configuration data, not a class hierarchy.

M02 actively uses and tests the relevant parts:

- `onUnhandledError` — asynchronous safe-consumer error reporting;
- `onStoppedNotification` — asynchronous observation of ignored notifications;
- `useDeprecatedNextContext` — compatibility context path.

`Promise` and the complete deprecated synchronous-error-handling path remain present for RxJS shape compatibility but are not fully behaviorally certified until later execution APIs exist.

## Multi-file source execution

M02 introduced multiple runtime TypeScript modules. Tests execute `.ts` source directly under Node 22, while builds emit JavaScript.

The shared compiler configuration therefore uses:

```json
"rewriteRelativeImportExtensions": true
```

Runtime source can use explicit `.ts` relative specifiers, and TypeScript rewrites them to JavaScript specifiers in emitted builds. This infrastructure applies to all later milestones.

## Realized kernel after M02

The kernel now has two implemented pieces and one planned piece:

```ts
type Subscription = {
  readonly closed: boolean;
  add(teardown: TeardownLogic): void;
  remove(teardown: Finalizer): void;
  unsubscribe(): void;
};

type Observer<T> = {
  next(value: T): void;
  error(error: unknown): void;
  complete(): void;
};

type Subscriber<T> = Subscription & Observer<T> & {
  readonly isStopped: boolean;
};

// M03 will determine the exact representation.
type Observable<T> = /* lazy execution description */ unknown;
```

M01 proved the lifecycle representation. M02 proved the sink/subscriber representation. M03 can now focus on the relationship between a lazy Observable execution description and this functional Subscriber.

## Compatibility policy

Behavioral parity is required. Feature/export parity is required by the final milestones. OO invocation parity is not required.

`Subscription`, `UnsubscriptionError`, and `Subscriber` exist as RxJS parity root names but are ordinary functions rather than constructible classes. `createSubscription` and `createSubscriber` are the canonical functional extensions.

A future compatibility facade may expose additional method-shaped ergonomics, but it must be implemented on top of the functional kernel rather than shaping the kernel itself.
