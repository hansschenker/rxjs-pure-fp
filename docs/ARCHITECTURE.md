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

## Kernel direction

The planned conceptual kernel is:

```ts
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

These are directional design types, not an M00 API commitment. M01-M04 will determine the exact representation by implementing and differentially testing lifecycle semantics.

## Compatibility policy

Behavioral parity is required. Feature/export parity is required by the final milestones. OO invocation parity is not required.

A future compatibility facade may expose familiar method-shaped ergonomics, but it must be implemented on top of the functional kernel rather than shaping the kernel itself.
