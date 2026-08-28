# RxJS 7.8.2 Parity

## Current milestone: M05 — Projection & Querying

Session 1 (M01-M05) is complete.

| Dimension | M05 status |
| --- | --- |
| Behavioral oracle | pinned `rxjs@7.8.2` |
| Architecture gate | passes across 20 TypeScript source files |
| Unit tests | 48 / 48 |
| Differential tests | 49 / 49 total |
| New M05 differential traces | 16 |
| RxJS root exports implemented | 16 / 175 = 9.1% |
| Functional root extensions | 5 |
| Unexpected root exports | 0 |
| Distribution architecture | passes across 40 emitted JavaScript files |

## Root parity exports through M05

### Runtime/core

- `Observable`
- `Subscriber`
- `Subscription`
- `UnsubscriptionError`
- `config`
- `pipe`

### Creation

- `of`

### Projection/querying

- `map`
- `filter`
- `tap`
- `scan`
- `reduce`
- `pairwise`
- `distinct`
- `distinctUntilChanged`
- `distinctUntilKeyChanged`

## Functional root extensions

Tracked separately and excluded from the RxJS parity numerator:

- `createSubscription`
- `createSubscriber`
- `createObservable`
- `subscribe`
- `pipeValue`

## M05 certified scope

### `tap`

Certified for:

- subscribe/next/error/complete observation;
- exact mirroring of ordinary source values;
- handler failures becoming errors from the tapped Observable;
- explicit unsubscribe hook only on cancellation paths;
- finalize hook on completion, error, and explicit cancellation;
- synchronous-completion ordering where operator finalization can precede source teardown returned later;
- live-source explicit cancellation ordering where already-attached source teardown precedes tap unsubscribe/finalize.

### `scan`

Certified for:

- seed and no-seed state establishment;
- explicit `undefined` as a supplied seed;
- accumulator indexes;
- current-state emission after each source value;
- accumulator failures entering the error channel.

### `reduce`

Certified for:

- shared scan-style accumulation semantics;
- one emission before completion;
- seed/no-seed indexes;
- empty source with no seed (no value);
- empty source with explicit `undefined` seed (emit `undefined`).

### `pairwise`

Certified for:

- no output on first source value;
- `[previous, current]` from second value onward;
- previous-value state reset on each subscription.

### `distinct`

Certified for:

- whole-history Set-based key memory;
- optional key selector;
- per-subscription Set state;
- functional Observable flush source clearing the Set;
- SameValueZero/Set behavior such as NaN de-duplication.

**Scope note:** RxJS accepts any `ObservableInput` as the `flushes` argument. M05 only claims the flush semantics when `flushes` is already a functional Observable. Full `ObservableInput` conversion is deferred to the input/interoperability milestones.

### `distinctUntilChanged`

Certified for:

- first value always emitted;
- default `===` comparator;
- custom comparator;
- key selector invoked for every source value including the first;
- previous-key update before downstream emission;
- reentrant source behavior;
- NaN behavior under `===`.

### `distinctUntilKeyChanged`

Certified for:

- consecutive property-key comparison;
- default equality;
- custom key comparator;
- implementation through `distinctUntilChanged` rather than separate state machinery.

## Differential evidence by milestone

- M00: 1 harness/oracle trace
- M01: 7 lifecycle traces
- M02: 9 Subscriber/safe-consumer traces
- M03: 8 Observable execution traces
- M04: 8 first-pipeline/operator traces
- M05: 16 projection/querying traces

Total: **49 / 49** differential tests.

## Interpretation of export parity

The current 16/175 score measures root-name coverage only. It is not a direct percentage of engineering completion.

A root export can also have intentionally deferred overload/interoperability scope. Such gaps are recorded explicitly rather than hidden by the export count.

## Intentional architectural deviations

The canonical kernel does not provide RxJS OO invocation as its architecture:

- no constructible Observable class;
- no Subscriber inheritance;
- no Subscription class hierarchy;
- no prototype operator methods;
- no subclass extension model.

Feature capability and observable behavior are the compatibility target.

## Final policy

M19-M20 make full package/export parity strict. Until then every milestone must maintain:

- explicit semantic scope;
- zero accidental unexpected root exports;
- functional extensions tracked separately;
- differential evidence for parity claims.
