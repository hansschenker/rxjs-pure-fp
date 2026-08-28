# Architecture

## Architectural thesis

RxJS 7.8.2 defines the observable behavior. `rxjs-pure-fp` intentionally replaces its historical OO runtime architecture with functional composition.

The project is not a mechanical rewrite of `class` into constructor functions. The ES3 reference is used to expose runtime responsibilities; those responsibilities are then recomposed from functions, closures, and structural values.

## Target runtime vocabulary

| RxJS responsibility | Pure FP representation |
| --- | --- |
| Observable | lazy execution function / description |
| Observer | structural sink of `next`, `error`, `complete` functions |
| Subscriber | sink protocol + lifecycle guards + subscription ownership |
| Subscription | lifecycle closure containing teardown state |
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
+ operations over that state
+ higher-order composition
```

The source architecture gate currently enforces the stronger rule that even type-level `extends` is absent from `src/`; structural type composition uses intersections instead.

## M01 realized kernel — Functional Subscription

M01 establishes the first concrete runtime representation:

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

Parent/child subscription coordination needs a small amount of private cross-record communication. M01 implements this with module-private symbol-keyed functions on the returned structural record. These symbols are not public API, are not prototype methods, and do not require a module-global registry of subscription state. Each subscription still owns its state in its own closure.

The lifecycle state transition is:

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

`unsubscribe()` is idempotent. Adding a finalizer after closure executes that finalizer immediately, matching RxJS 7.8.2.

`Subscription` and `UnsubscriptionError` are retained as root parity names, but they are arrow-function factories rather than constructible classes. `createSubscription` is the canonical functional API.

## Kernel direction

With M01 established, the conceptual kernel is now:

```ts
type Subscription = {
  readonly closed: boolean;
  add(teardown: TeardownLogic): void;
  remove(teardown: Finalizer): void;
  unsubscribe(): void;
};

type Teardown = () => void;

type Sink<T> = {
  next(value: T): void;
  error(error: unknown): void;
  complete(): void;
};

type Observable<T> = (sink: Sink<T>) => TeardownLike;

type OperatorFunction<A, B> =
  (source: Observable<A>) => Observable<B>;
```

Only the Subscription part is committed runtime API at M01. M02-M04 will determine the exact Sink and Observable representations through implementation and differential testing.

## Compatibility policy

Behavioral parity is required. Feature/export parity is required by the final milestones. OO invocation parity is not required.

A future compatibility facade may expose familiar method-shaped ergonomics, but it must be implemented on top of the functional kernel rather than shaping the kernel itself.
