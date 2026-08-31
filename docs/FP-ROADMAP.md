# FP Roadmap

Status: F1-F8 are all landed. This document sequences
the functional-style deepening of the kernel against `docs/EXECUTION-PLAN.md`. It
does not change behavioral scope: RxJS 7.8.2 remains the behavioral oracle, and
every item must pass the existing differential gates unchanged.

Landed state:

- `src/kernel/**` is the pure core (notification, subscription, sink, observable,
  operator, pipe, config, sink-transformer, stateful-operator, operators, creation).
  The architecture gate enforces kernel purity: no `this`, no `this`-parameter
  types, no `Reflect`, no module-scope `let`/`var`, no imports from compat.
- `src/compat/**` is the RxJS 7.8.2 surface: `Observable`/`Subscriber`/
  `Subscription`/`UnsubscriptionError` parity factories, `this`-bound initializers,
  the safe consumer boundary with unhandled-error policy, `useDeprecatedNextContext`,
  the deprecated synchronous error context, callback `subscribe` overloads, and the
  `thisArg` wrappers for `map`/`filter`.
- The former experimental F2/F3 modules are promoted: kernel `map`, `filter`,
  `scan`, `reduce`, `pairwise`, and `distinctUntilChanged` are derived from exported
  pure step functions over `statefulOperator`; `accumulation.ts` supersedes
  `scanInternals`. `distinct` and `tap` stay fused (`Set` mutation and observer
  lifecycle callbacks respectively). The F2/F3 API is exported from the package
  root as declared functional extensions (`reference/functional-exports.json`).
- Certification: `test/differential/fp-kernel.test.mjs` (kernel operators and fused
  sink pipelines ≡ rxjs@7.8.2, including reentrancy and index-timing scenarios) and
  `test/unit/fp-kernel.test.mjs` (functor laws, fusion, step purity).
- F4: subscription and subscriber records are frozen compositions. The lifecycle
  closure state is factored into a kernel-internal `createLifecycleState`
  (`subscription.ts`) exposing its operations plus an opaque internal-protocol
  object to spread; the composed record registers itself via `setSelf` as the
  parentage identity. Notification records and `EMPTY_OBSERVER` are frozen too.
  The gate now also forbids `Object.defineProperty`/`defineProperties` in the
  kernel.
- F5: teardown is an error-aggregating monoid in `subscription.ts` —
  `Teardown = () => unknown[]` (kernel-internal exports `emptyTeardown`,
  `toTeardown`, `combineTeardown`). Errors-as-values is a deliberate deviation
  from the `() => void` sketch below: it is what makes `emptyTeardown` a lawful
  identity, since RxJS wraps finalizer errors in one `UnsubscriptionError` at
  the unsubscribe boundary, not per finalizer. `unsubscribe` folds the stored
  finalizers through the monoid lazily, so `remove`-by-identity is untouched.
  Monoid laws are unit-tested in `test/unit/fp-kernel.test.mjs`.
- F6: runtime policy is an explicit environment. `kernel/runtime.ts` defines
  `RuntimeEnv` (`onUnhandledError`, `onStoppedNotification`, `defer`) plus the
  silent `defaultEnv`; kernel `createSubscriber(destination?, env?)` takes the
  env, subscriber records carry theirs, and operator subscribers inherit it from
  their destination. The mutable `config` singleton moved to
  `src/compat/config.ts`, where `configEnv` backs it with live getters so
  dispatch-time reads stay lazy; the public `createSubscriber` is the compat,
  config-backed wrapper, and compat unhandled-error reporting goes through
  `configEnv.defer`. The gate forbids host timer access in the kernel outside
  `runtime.ts` — `defer` is the seam the M13 scheduler kernel turns into policy.
  No kernel residue remains.
- Kernel `createObservable` is the identity (no `this` binding); the initializer
  `this` contract lives only on the compat `Observable` factory.
- F7: all kernel protocol types use readonly property syntax
  (`readonly next: (value: T) => void`) for full `strictFunctionTypes`
  contravariance checking, enforced by a gate rule forbidding method-syntax
  type members in the kernel. Observer-record-only kernel subscribe was already
  delivered by F1 (`executeSource`; callback overloads are compat). The
  optional recursive-tuple variadic `pipe` was evaluated and deliberately not
  taken: tuple-validation signatures degrade contextual inference of inline
  arrows, so the fixed overloads remain the better DX — revisit if TypeScript
  inference improves.
- F8: `SEMANTICS.md` gained the "Algebraic structures" chapter naming the
  functor/contramap/monoid/operator-algebra laws — each executable in
  `test/unit/algebra-laws.test.mjs` (plus the F2/F5 laws in
  `test/unit/fp-kernel.test.mjs`) — and the pre-M07/M08 record that the
  Observable "monad" is a policy family (mergeMap/concatMap/switchMap/
  exhaustMap as four chains distinguished only by inner-subscription policy).

## Premise

Session 1 removed classes. The remaining gap is that parts of the runtime are
class-free but still OO-shaped:

- `this`-bound initializers and `Reflect.apply` (`observable.ts`, `map`, `filter`);
- records enriched in place via `Object.defineProperties` (`sink.ts`);
- a mutable module-level `config` singleton read at call time;
- module-level mutable error context (`error-context.ts`);
- symbol-keyed "private methods" acting as encapsulated OO members;
- each stateful operator hand-rolling its own `let` state and try/catch policy.

The proposals are numbered F1-F8. F-numbers are style/architecture work; M-numbers
remain behavioral milestones.

---

## F1 — Kernel / compat split

Create an explicit boundary:

```text
src/kernel/**   pure functional core: no this, no Reflect, no module-scope let,
                no deprecated flags, no thisArg
src/compat/**   RxJS 7.8.2 surface: parity names, deprecated overloads,
                this-bound initializers, mutable config singleton
```

Impurities that exist only for 7.8.2 surface parity move to compat:

- `thisArg` overloads of `map`/`filter` (deprecated in RxJS 7 itself);
- `ObservableInitializer`'s `this` binding — kernel initializers are plain
  `(subscriber) => TeardownLogic`;
- `useDeprecatedNextContext` and its `Object.create`/rebinding machinery;
- the three-callback `subscribe(next, error, complete)` overload (deprecated in 7);
- the mutable `config` object as a *default environment* (see F6).

Consequence: kernel `createObservable` becomes the identity (plus optional type
branding). Under `Observable<T> = (subscriber) => TeardownLogic`, any such function
already *is* an Observable; only the compat layer needs a constructor-shaped wrapper.

This is rule 20 of `AGENTS.md` (facade only on top of the kernel) applied to
impurities rather than to OO convenience.

## F2 — Sink as a total function over the notification ADT

`ObservableNotification<T>` already exists as a discriminated union but is only used
for stopped notifications. Make it the internal wire format:

```ts
type Sink<T> = (notification: ObservableNotification<T>) => void;
```

The three-method `Observer` record becomes one interpretation of the ADT at the
boundary. The payoff is that operators become **contravariant sink transformers**:

```ts
type SinkTransformer<T, R> = (downstream: Sink<R>) => Sink<T>;

const mapSink = <T, R>(f: (t: T) => R): SinkTransformer<T, R> =>
  (down) => (n) => down(n.kind === 'N' ? nextNotification(f(n.value)) : n);
```

`createOperatorSubscriber(destination, onNext?, onComplete?, onError?, onFinalize?)`
is this contramap encoded as four optional positional callbacks. Reifying it:

- makes operator composition function composition (`map(f) ∘ map(g)` fuses into one
  sink);
- collapses the triplicated try/catch in `createOperatorSubscriber` into a single
  guard around one function call;
- gives a law-friendly core (functor laws become checkable equations, F8).

Lifecycle stays effectful: child ownership (`destination.add`), stop-state, and the
M05 finalize-timing hook remain in the runner that lifts a pure `SinkTransformer`
into an `OperatorFunction`. Prior art: the Callbag signal encoding and most.js sinks.

## F3 — Centralized operator state: one runner, pure step functions

M05's own result — "operator families differ mainly by closure state and
notification policy" — restated as code:

```ts
type Emit<R> = { readonly kind: 'none' } | { readonly kind: 'one'; readonly value: R };

type Step<S, T, R> = (state: S, value: T, index: number) => readonly [S, Emit<R>];

const statefulOperator: <S, T, R>(initial: S, step: Step<S, T, R>) => OperatorFunction<T, R>;
```

`pairwise`, `distinctUntilChanged`, `distinct`, `scan`, and indexed `filter` become
pure, property-testable step functions; the single `let state` lives in one audited
runner. The reentrancy rule currently documented in `distinctUntilChanged`
("state is updated before emission") is satisfied structurally: the runner commits
the returned state before interpreting `Emit`.

Performance policy: where a fused hand-written implementation is kept for hot paths,
the pure step function remains the executable specification and the differential
harness asserts `fused ≡ derived`.

## F4 — Record composition instead of in-place enrichment

`createSubscriberWithHooks` currently mutates the lifecycle record with
`Object.defineProperties`. Build a new delegating record instead:

```ts
const subscriber: Subscriber<T> = {
  get closed() { return lifecycle.closed; },
  add: lifecycle.add,
  remove: lifecycle.remove,
  get isStopped() { return isStopped; },
  next, error, complete, unsubscribe,
  [subscriptionMarker]: true,
};
```

Then freeze every public record (subscriptions, subscribers, notifications) with
`Object.freeze`. The compatibility policy already excludes prototype-patching
consumers, so freezing is free and turns "the record is a view over closure state"
from convention into enforcement.

Identity caveat: internal symbol markers must land on the new record so
`isInternalSubscription` and parentage bookkeeping keep working, and the record that
is `add`ed downstream must be the same reference later `remove`d.

## F5 — Teardown as a monoid

`TeardownLogic = Subscription | Unsubscribable | (() => void) | void` forces
`execFinalizer` case analysis throughout `subscription.ts`. Internally canonicalize
at the boundary:

```ts
type Teardown = () => void;
const emptyTeardown: Teardown;
const toTeardown: (t: TeardownLogic) => Teardown;
const combineTeardown: (a: Teardown, b: Teardown) => Teardown;
```

The finalizer list becomes a fold over a monoid. The union survives only at the
compat surface. Care point: `remove` requires identity, so the original reference
stays the key when canonicalizing (pair storage or a Map).

## F6 — Explicit runtime environment

Three globals become one reader-style parameter:

```ts
type RuntimeEnv = {
  readonly onUnhandledError: ((error: unknown) => void) | null;
  readonly onStoppedNotification: OnStoppedNotification | null;
  readonly defer: (task: () => void) => void; // today: globalThis.setTimeout
};
```

Kernel functions take an `env`; the compat shell supplies a default env backed by
the mutable `config` object for parity, and `errorContext`'s deprecated
synchronous-error state lives entirely in compat. Benefits: the kernel is
referentially transparent with respect to configuration, tests stop sharing a
singleton, and `defer` is exactly the seam M13's scheduler kernel needs — timers
become a policy behind the same interface.

## F7 — Type-level hygiene

- Method syntax → property syntax on protocol types (`next(v: T): void` becomes
  `next: (v: T) => void`): method members are bivariant in TypeScript; property
  members get full `strictFunctionTypes` contravariance checking.
- `readonly` on all public record fields.
- Kernel `subscribe` accepts observer records only; callback overloads are compat.
- Optional: variadic `pipe` via recursive tuple types instead of fixed overloads.

## F8 — Documented algebra with law tests

Add a `SEMANTICS.md` chapter naming the structures already present, each law wired
into the property/differential harness:

```text
map                    Functor (identity, composition)
Sink                   contravariant functor (contramap)
Teardown               monoid (associativity, identity)
distinctUntilKeyChanged  operator algebra over distinctUntilChanged (existing)
reduce                 scan policy variant (existing, scanInternals)
```

Record before M07/M08: "the" Observable monad is ambiguous — `mergeMap`,
`concatMap`, and `switchMap` are three `chain`s distinguished only by
inner-subscription policy. That is the flattening-machine-plus-policy heuristic of
`FUNCTIONAL-RUNTIME.md` stated algebraically.

---

## Sequencing against the execution plan

F1-F3 multiply through the higher-order machinery; they should land before M07.

| Window | Work | Rationale |
| --- | --- | --- |
| Before/with M06 | F1 kernel/compat split, F7 types | M06 adds many operators; add them on the clean boundary rather than migrating them later |
| Before M07 | F2 sink transformers, F3 stateful runner | M07-M08 flattening machinery multiplies whatever encoding it is built on |
| With M07-M08 | F8 (monad-ambiguity note, functor laws) | laws become differential dimensions for the flattening family |
| Any time | F4 record composition, F5 teardown monoid | local refactors behind existing tests |
| Before M13 | F6 runtime env | `defer` is the scheduler seam; M13 turns it into policy |
| M10-M11 | re-check F4 freezing against Subject surface | subjects expose observer + subscription on one record |

## Architecture gate extensions

Extend the AST gate (`tools/check-no-classes.mjs` family) as F1 lands, kernel only:

- no `this` expressions and no `ThisParameter` types;
- no `Reflect.apply` / `Function.prototype.bind`-style rebinding;
- no `Object.defineProperty`/`defineProperties`;
- no module-scope `let`/`var`;
- no imports from `src/compat/**` (dependency direction: compat → kernel only).

## Non-goals

Per-subscription mutable closures stay. Push-based delivery with RxJS's synchronous
timing guarantees cannot thread immutable state through callbacks without paying in
parity or performance; the narrowest-lifetime rule already places this state
correctly. The goal of F3 is to *centralize* that mutation into one audited runner,
not to eliminate it. Likewise, `void`-returning sinks are the honest type of an
effectful boundary — the FP claim of this project is pure construction and explicit
effects at the edges, not the absence of effects.
