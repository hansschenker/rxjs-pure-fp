# Architecture

## Architectural thesis

RxJS 7.8.2 defines observable behavior. `rxjs-pure-fp` reconstructs that behavior from functions, closures, structural records, and policy composition rather than classes and inheritance.

## Non-negotiable rules

- no project-defined classes;
- no inheritance or `super`;
- no prototype mutation/constructor-prototype OO;
- no global registry for per-execution state;
- runtime TypeScript uses structural intersections rather than `extends`;
- pipeline construction stays inert;
- mutable execution state is created per subscription unless sharing is explicit.

---

# Realized kernel after Session 1

```text
Observable execution function
          │
          ▼
operator Subscriber policy
          │
          ▼
Subscriber notification machine
          │
          ▼
Subscription lifecycle closure
```

In types:

```ts
type Observable<T> =
  (subscriber: Subscriber<T>) => TeardownLogic;

type Subscriber<T> = Subscription & {
  readonly isStopped: boolean;
  next(value: T): void;
  error(error: unknown): void;
  complete(): void;
};

type OperatorFunction<A, B> =
  (source: Observable<A>) => Observable<B>;
```

## M01 — lifetime

`createSubscription()` owns `closed`, parentage, and finalizers in lexical state.

## M02 — notification participation

`createSubscriber()` enriches the same lifecycle record with destination, stop-state, and the Observer protocol.

## M03 — execution

`createObservable()` produces a lazy execution function; standalone `subscribe` connects source execution to a functional Subscriber and its teardown lifecycle.

## M04 — first-order operator topology

```text
source Observable
      │
      ▼
operator child Subscriber
      │
      ▼
destination Subscriber
```

The child is owned by downstream before source execution begins. Values flow downstream; cancellation ownership points upstream.

---

# M05 — operator behavior as policy

M05 generalizes the functional operator child without introducing a new object type.

```text
createOperatorSubscriber(
  destination,
  onNext?,
  onComplete?,
  onError?,
  onFinalize?
)
```

The same structural Subscriber can now express:

| Policy | Operators |
| --- | --- |
| Transform current value | `map` |
| Gate current value | `filter` |
| Observe notifications | `tap` |
| Accumulate state | `scan`, `reduce` |
| Remember previous value | `pairwise` |
| Remember all keys | `distinct` |
| Remember last emitted key | `distinctUntilChanged`, `distinctUntilKeyChanged` |

This is the central Session 1 architectural result: **operator families differ mainly by closure state and notification policy, not by runtime class type.**

## Internal Subscriber finalization hook

M05's `tap` requires RxJS OperatorSubscriber finalization timing. A late-added teardown is insufficient because synchronous source completion may close the operator child before the source initializer returns its teardown.

M05 therefore adds an internal Subscriber lifecycle hook:

```text
Subscriber unsubscribe
       │
       ├── execute lifecycle finalizers currently owned
       ├── clear destination
       └── run operator onFinalize hook
```

If a synchronous source returns teardown later, M01 add-to-closed semantics execute it afterward. If source teardown was already registered, it runs before the hook. This exactly models the two RxJS timing cases without an OperatorSubscriber subclass.

The public `createSubscriber()` API remains unchanged; the hook-capable constructor is internal operator machinery.

## Accumulation policy

`scan` and `reduce` share one state machine:

```text
closure per subscription
  hasState
  state
  index
```

Policy flags determine emission timing:

```text
scan    emitOnNext = true
        emitBeforeComplete = false

reduce  emitOnNext = false
        emitBeforeComplete = true
```

Seed presence is a call-arity policy, not a value check:

```text
arguments.length >= 2
```

so explicit `undefined` remains a valid seed.

## Memory policies

### adjacency

`pairwise` stores:

```text
previous
hasPrevious
```

### all-history distinctness

`distinct` stores a per-subscription `Set` of selected keys and can clear that state from a functional flush Observable.

### consecutive distinctness

`distinctUntilChanged` stores only:

```text
first
previousKey
```

The previous key is updated before downstream emission to preserve RxJS reentrancy semantics.

`distinctUntilKeyChanged` is built from `distinctUntilChanged`; it is operator algebra, not another state machine.

---

# State ownership after M05

The narrowest-lifetime rule now has concrete examples across the runtime:

| State | Lifetime |
| --- | --- |
| Subscription finalizers/parentage | one Subscription |
| Subscriber `isStopped` / destination | one Subscriber |
| map/filter index | one operator execution |
| scan/reduce accumulator | one operator execution |
| pairwise previous value | one operator execution |
| distinct Set | one operator execution |
| distinctUntilChanged previous key | one operator execution |

No ordinary operator state is stored globally or at operator-definition lifetime.

---

# Directionality

The first-order pipeline has two simultaneous directions:

```text
notifications: source ───────────────► destination
teardown:      source ◄─────────────── destination
```

This bidirectional execution topology remains the basis for M06 gating and, later, the M07-M08 higher-order machinery.

## Compatibility policy

Behavioral parity and eventual feature/export parity are required. Constructibility, prototype methods, and subclassing are not part of the functional kernel contract.
