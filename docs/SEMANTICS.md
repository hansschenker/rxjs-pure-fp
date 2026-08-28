# Semantic Invariants

RxJS 7.8.2 is the behavioral oracle for this project.

## Laziness

Observable and operator construction are inert. Source execution starts only on subscription.

## Cold independence

Unless sharing is explicit, every subscription owns independent execution and operator state.

Examples of per-subscription state now include:

- map/filter indexes;
- scan/reduce accumulator state;
- pairwise previous value;
- distinct Set;
- distinctUntilChanged previous key.

## Notification protocol

An execution emits zero or more `next` notifications followed by at most one `error` or `complete` terminal notification. Cancellation is not a terminal notification and must not synthesize completion.

## Value direction / ownership direction

```text
notifications      upstream ─────────► downstream
teardown ownership upstream ◄───────── downstream
```

Operator children are owned by downstream before their sources execute so synchronous cancellation can reach upstream immediately.

## Operator callbacks

Failures thrown by operator-owned callbacks are caught at the operator Subscriber boundary and sent downstream through `error`.

This applies to projections, predicates, accumulators, key selectors/comparators, and tap callbacks according to the corresponding RxJS operator semantics.

## Operator finalization timing

Operator finalization belongs to the Subscriber unsubscribe transition, not merely to a teardown appended after source subscription.

Two valid RxJS timing shapes exist.

### source teardown already registered

```text
unsubscribe
   │
   ├── source teardown
   └── operator finalize hook
```

### source completed synchronously before returning teardown

```text
source complete
   │
operator Subscriber finalizes
   │
operator finalize hook
   │
source returns teardown later
   │
add-to-closed executes source teardown
```

M05's internal Subscriber finalization hook preserves both shapes.

## Accumulation seed presence

For `scan`/`reduce`, seed presence is determined by call arity:

```text
arguments.length >= 2
```

Explicit `undefined` is therefore a supplied seed. Value-based tests such as `seed !== undefined` are semantically incorrect.

## Accumulator index

The accumulation index increments for every source value, including a first unseeded value that becomes state without calling the accumulator. Therefore the first accumulator call of an unseeded scan/reduce receives index 1.

## Reduce termination

`reduce` emits accumulated state only before successful completion:

- empty + no seed → no value, complete;
- empty + seed → seed, complete;
- source error/cancellation → no completion-time accumulation emission.

## Adjacent memory

`pairwise` stores the current source value as `previous` and emits only once a previous value exists. State resets with every subscription.

## Distinct Set semantics

`distinct` uses JavaScript Set semantics for selected keys. This includes SameValueZero behavior such as `NaN` matching `NaN`.

A flush emission clears the Set but does not itself emit a source value or complete the destination. A flush-source error is still an error of the resulting Observable.

## Consecutive distinctness

`distinctUntilChanged`:

1. always selects/emits the first value;
2. applies the key selector to every value including the first;
3. compares new key against the key of the previous **emitted** value;
4. updates the stored key before downstream `next` to preserve reentrancy correctness.

Its default comparator is `===`, not Set/SameValueZero semantics. Consequently consecutive NaN values are considered changed.

## `distinctUntilKeyChanged`

This is semantically derivable from `distinctUntilChanged` by comparing one property of consecutive emitted objects. No separate state policy is required.

## Higher-order execution

Future inner subscriptions are execution resources. Their creation, coexistence, replacement, queueing, cancellation, completion, and errors must remain explicit and differentially tested.

Canonical flattening policies:

- `mergeMap`: allow overlap;
- `concatMap`: queue while busy;
- `switchMap`: cancel previous / keep latest;
- `exhaustMap`: ignore new work while busy.

## Sharing

Sharing changes execution topology and must be explicit. Ordinary Observables remain independently executed until Subject/connectable/share semantics are intentionally introduced.

## Time

Time enters through source clocks and schedulers. Temporal operators must preserve RxJS ordering and cancellation behavior rather than introducing unrelated Promise timing.

## Differential evidence

Each semantic claim is backed by scenario traces against `rxjs@7.8.2`. By the end of M05 the suite contains 49 passing differential tests spanning lifecycle, notification, execution, first pipeline, and stateful first-order operator policies.
