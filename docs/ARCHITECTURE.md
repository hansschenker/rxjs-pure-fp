# Architecture

## Architectural thesis

RxJS 7.8.2 defines observable behavior. `rxjs-pure-fp` intentionally replaces its historical OO runtime architecture with functional composition.

The project is not a mechanical `class`-to-function rewrite. The ES3 reference exposes runtime responsibilities; those responsibilities are then recomposed from functions, closures, structural records, and policies.

## Target runtime vocabulary

| RxJS responsibility | Pure FP representation |
| --- | --- |
| Observable | lazy execution function |
| Observer | structural `next/error/complete` sink |
| Subscriber | Observer protocol + stop-state + Subscription lifecycle |
| Subscription | lifecycle closure containing teardown state |
| Operator | `Observable<A> -> Observable<B>` |
| Subject | multicast closure and observer registry |
| Scheduler | clock + queue + scheduling/flush policies |

## No disguised OO

Forbidden runtime architecture includes:

```text
class
constructor function + prototype methods
prototype inheritance
subclass polymorphism hidden behind functions
```

The target form is:

```text
closure state
+ structural operations
+ higher-order composition
```

The source architecture gate also rejects type-level `extends`; structural TypeScript composition uses intersections.

---

# Realized kernel after M03

```text
Observable execution function
          │
          ▼
Subscriber notification record
          │
          ▼
Subscription lifecycle closure
```

The layers have distinct responsibilities and compose directly.

## M01 — Subscription

```text
createSubscription(initialTeardown?)
        │
        ├── closure: closed
        ├── closure: parentage
        ├── closure: finalizers
        │
        └── structural record
              ├── closed
              ├── add(teardown)
              ├── remove(teardown)
              └── unsubscribe()
```

Subscription state belongs to one lifecycle. Parent/child coordination uses private symbol-keyed hooks on returned records, never prototype state or a global registry.

## M02 — Subscriber / Sink

```text
M01 Subscription record
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

The same record owns both notification participation and lifecycle. There is no second wrapper object and no `Subscriber extends Subscription` relationship.

The safe consumer boundary remains separate: callback/partial-observer failures are caught and reported according to RxJS 7.8.2 config semantics, while raw Subscriber destinations retain raw forwarding behavior.

## M03 — Observable

The concrete M03 representation is:

```ts
type Observable<T> =
  (subscriber: Subscriber<T>) => TeardownLogic;
```

`createObservable(initializer)` returns a lazy function. Construction does not allocate ordinary execution state and does not call the initializer.

Standalone subscription composes the existing layers:

```text
subscribe(observer)(source)
        │
        ├── create/reuse M02 Subscriber
        ├── execute M03 source
        └── add returned teardown to M01 lifecycle
```

This composition explains the important synchronous-completion case naturally:

```text
source completes synchronously
        │
Subscriber closes
        │
source returns teardown
        │
subscriber.add(teardown)
        │
M01 add-to-closed executes teardown immediately
```

No Observable-specific workaround is required.

## Observable initializer context

RxJS calls a constructor initializer with the Observable instance as `this`. M03 preserves the relationship without creating an instance:

```text
initializer this === returned Observable execution function
```

This is implemented with `Reflect.apply`.

## Composition API

RxJS root `pipe` keeps its RxJS 7.8.2 semantics: unary-function composition returning one unary function.

The project's direct data-first form is a separate functional extension:

```ts
pipeValue(value, fn1, fn2, ...)
```

Separating the names prevents an architectural convenience from being mislabeled as RxJS export parity.

---

# State ownership rule

**State belongs to the narrowest lifetime that requires it.**

- pipeline construction state is inert;
- ordinary source execution state is created per subscription;
- Subscriber stop-state belongs to one Subscriber;
- Subscription teardown state belongs to one lifecycle;
- shared state will be introduced only by explicit sharing topologies such as Subject/connectable/share.

## Construction versus execution

```text
construct Observable / compose operators
              │
              │ no source work
              ▼
        execution description
              │
          subscribe
              ▼
       per-subscription state
```

This distinction is a permanent semantic invariant.

---

# Kernel direction after M03

The first functional kernel is now operational:

```ts
type Subscription = {
  readonly closed: boolean;
  add(teardown: TeardownLogic): void;
  remove(teardown: Exclude<TeardownLogic, void>): void;
  unsubscribe(): void;
};

type Subscriber<T> = Subscription & {
  readonly isStopped: boolean;
  next(value: T): void;
  error(error: unknown): void;
  complete(): void;
};

type Observable<T> =
  (subscriber: Subscriber<T>) => TeardownLogic;

type OperatorFunction<A, B> =
  (source: Observable<A>) => Observable<B>;
```

M04-M05 should extend this kernel with sources and operators rather than redesigning its lifecycle or notification model.

## Compatibility policy

Behavioral parity is required. Feature/export parity is required by the final milestones. OO invocation parity is intentionally not required.

Parity names such as `Observable`, `Subscriber`, and `Subscription` are ordinary functions in the functional runtime; `new`-based construction is not part of the kernel.
