# Architecture

## Architectural thesis

RxJS 7.8.2 defines observable behavior. `rxjs-pure-fp` replaces its historical OO runtime architecture with functions, closures, structural records, and policy composition.

The ES3 reference is anatomy material, not an implementation template.

## Architectural laws

- no project-defined classes;
- no inheritance or `super`;
- no prototype mutation or constructor/prototype OO;
- no module-global registry for per-execution state;
- structural type composition instead of `extends`;
- state belongs to the narrowest lifetime that requires it;
- pipeline construction is inert;
- ordinary subscriptions own independent execution state;
- shared state is introduced only by explicit sharing topology.

---

# Realized runtime through M04

```text
creation source
     │
     ▼
Observable execution function
     │
     ▼
operator child Subscriber
     │
     ▼
downstream Subscriber
     │
     ▼
Subscription lifecycle
```

## M01 — Subscription

`createSubscription()` owns `closed`, parentage, and finalizers in lexical state and returns a structural lifecycle record.

## M02 — Subscriber

`createSubscriber(destination)` enriches the same Subscription record with lexical `isStopped`/destination state and `next/error/complete` functions. Safe user-consumer handling remains a separate adapter.

## M03 — Observable

```ts
type Observable<T> =
  (subscriber: Subscriber<T>) => TeardownLogic;
```

`createObservable(initializer)` returns a lazy execution function. `subscribe(observer)(source)` creates/reuses a Subscriber, executes the source, and attaches returned teardown to its lifecycle.

## M04 — operator layer

M04 commits the permanent first-order operator shape:

```ts
type OperatorFunction<A, B> =
  (source: Observable<A>) => Observable<B>;
```

An operator captures configuration during construction and creates execution state only when its returned Observable is subscribed.

### `operate` replaces `lift`

The internal functional equivalent of RxJS lift plumbing is:

```text
operate(init)
    │
    ▼
source => createObservable(
  destination => init(source, destination)
)
```

No Operator class or `Observable.prototype.lift` is required.

### functional OperatorSubscriber

RxJS models operator participation with `OperatorSubscriber extends Subscriber`. M04 composes it:

```text
createOperatorSubscriber(destination, onNext)
        │
        ├── create ordinary functional Subscriber
        ├── intercept source next notifications
        ├── catch operator-callback failures
        ├── forward error/complete
        └── destination.add(child)
```

The last step happens **before source execution begins**.

This ordering is a permanent operator invariant:

```text
child created
    │
child owned by downstream
    │
source starts
```

It guarantees that synchronous downstream cancellation propagates through the entire upstream operator chain before a synchronous source attempts its next emission.

### per-subscription operator state

Mutable operator state belongs inside the returned Observable initializer:

```text
map(project) construction       mapped$ subscription
-------------------------       --------------------
capture project                 index = 0
no index yet                    create child Subscriber
                                subscribe source
```

The same rule applies to filter indexes and will apply to accumulators, previous-value memory, Sets, and other first-order operator state in M05.

---

# M04 source/operator topology

The first pipeline:

```ts
pipeValue(
  of(1, 2, 3),
  map(value => value * 10),
  filter(value => value > 10)
)
```

constructs a lazy topology conceptually equivalent to:

```text
of execution
     │
 map child Subscriber
     │
filter child Subscriber
     │
user Subscriber
```

At subscription time, ownership is established from downstream to upstream, while values flow from upstream to downstream.

```text
ownership / cancellation  ◄────────
values / notifications    ────────►
```

That opposite direction is central to RxJS execution semantics.

## Error direction

Projection or predicate errors are caught at the corresponding operator child and sent downstream through `error`. Terminal notification then tears down the ownership chain upstream.

## `of` cancellation rule

The synchronous `of` source tests `subscriber.closed` before each next emission. Synchronous cancellation from a downstream `next` therefore stops source iteration without emitting later values or a user-visible completion.

---

# Compact functional kernel

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

After M04 these four abstractions are operational and differentially tested. M05 should extend first-order operator policies, not add another runtime object layer.

## Compatibility policy

Behavioral parity and eventual feature/export parity are required. OO invocation parity is intentionally not required; parity names such as `Observable`, `Subscriber`, and `Subscription` remain functional factories rather than constructible classes.
