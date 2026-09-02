# rxjs-pure-fp — how it is built and what it does

A high-level tour of the project for readers who know RxJS and want to
understand how this reimplementation is put together, what it provides, and
how its claims are checked. The detailed per-milestone material lives in
`ARCHITECTURE.md`, `SEMANTICS.md`, `RXJS-7.8.2-PARITY.md`, and
`EXECUTION-PLAN.md`; this document is the map.

## 1. The idea in one paragraph

RxJS 7.8.2 is a reactive runtime written as a class hierarchy: `Observable`,
`Subscriber`, `Subscription`, `Subject` and its subclasses, `Scheduler` and
its action subclasses, and an operator layer built on `lift` and
`OperatorSubscriber`. `rxjs-pure-fp` keeps every behavior of that runtime
and replaces the implementation model. There are no classes, no
inheritance, no prototype methods, and no `new` for anything the project
defines. Everything is a function, a closure, a frozen structural record, or
a policy record passed to a shared machine. RxJS 7.8.2 itself is pinned as
the behavioral oracle, and every feature is proven by running the same
scenario against both libraries and comparing the traces.

> **RxJS 7.8.2 defines the behavior. `rxjs-pure-fp` defines a different
> implementation architecture.**

The result is a package with RxJS's exact public shape: all 175 root export
names, the 115 names of `rxjs/operators`, and the `rxjs/testing` marble
testing surface, each name differentially certified.

## 2. Ground rules and how they are enforced

Runtime code under `src/` may not use:

- project-defined classes, class expressions, `extends`, or `super`;
- `.prototype` manipulation or constructor/prototype OO disguised as functions;
- `new` for project-defined constructors (platform constructors such as
  `Error`, `Map`, `Set`, `Date`, `Promise` are allowed);
- module-global registries for per-execution state.

The pure core (`src/kernel/`) has stricter rules: no `this`, no `Reflect`,
no module-scope `let`/`var`, no `Object.defineProperty`, no method-syntax
type members (property syntax gets full variance checking), no imports from
the compat layer, and no host timer access outside one file (`runtime.ts`).

These are not conventions. `tools/check-no-classes.mjs` parses every source
file with the TypeScript compiler API and fails the build on any violation;
`tools/check-dist.mjs` scans the emitted JavaScript again. The rules are
part of `npm run verify`, so an architectural regression cannot land.

The governing design rule is about state:

> **State belongs to the narrowest lifetime that requires it.**

Pipeline configuration belongs to construction. Per-subscription state lives
inside the subscription's execution closure. Per-inner state lives in the
higher-order execution managing that inner. Shared state exists only in
explicit sharing topologies (Subjects, `share`, `connectable`).

## 3. The four primitives

The whole runtime rests on four structural types:

```ts
type Observable<T> = (subscriber: Subscriber<T>) => TeardownLogic;

type Subscriber<T> = Subscription & Observer<T> & { readonly isStopped: boolean };

type Subscription = {
  readonly closed: boolean;
  readonly add: (teardown: TeardownLogic) => void;
  readonly remove: (teardown: Exclude<TeardownLogic, void>) => void;
  readonly unsubscribe: () => void;
};

type OperatorFunction<A, B> = (source: Observable<A>) => Observable<B>;
```

Read them as responsibilities:

```text
Observable     lazy execution: nothing happens until a subscriber is handed in
Subscriber     notification participation: next / error / complete, once, in order
Subscription   lifetime: teardown ownership and cancellation
Operator       a lazy Observable-to-Observable transformation
```

An Observable *is* a function. `createObservable(fn)` returns the same
function, stamped with a brand symbol so variadic APIs can tell a trailing
source from a trailing selector (both are functions in this representation).
Subjects are branded callable functions too, so a Subject can be used
anywhere an Observable is expected without a wrapper.

Values and ownership flow in opposite directions, and that bidirectionality
is the basis of every operator:

```text
values / notifications      source ─────────► destination
ownership / cancellation    source ◄───────── destination
```

## 4. Source layout

```text
src/
  kernel/          the pure core: primitives, operator machinery, creation, operators,
                   subjects, sharing, schedulers, virtual time, interop
  compat/          the RxJS 7.8.2 surface over the kernel: parity factory names
                   (Observable, Subject, Scheduler, ...), this-bound initializers,
                   the safe consumer boundary, the mutable config, deprecated
                   overloads and scheduler arguments, operator-form aliases
  operators/       the rxjs/operators subpath entry
  testing/         the rxjs/testing subpath: TestScheduler, cold/hot observables, marble parsers
  index.ts         the root entry: the 175 RxJS names plus 20 documented functional extensions

tools/             the gates: architecture check, lint, export parity, package shape,
                   distribution check, certification matrix, oracle snapshot
test/unit/         Vitest-free node:test unit suites, incl. executable algebra laws
test/differential/ the same scenarios run against rxjs@7.8.2 and against this package
reference/         the pinned oracle export manifest and read-only ES3 anatomy material
docs/              architecture, semantics, parity, execution plan, generated matrices
examples/todo-mvu/ a small Model-View-Update application built on the library
examples/shopping-cart/ a business-level sample: pricing rules, cancellable stock checks,
                   checkout with retries, deadline and compensation, marble-tested in virtual time
```

Dependency direction is one-way: compat imports kernel, never the reverse.
The kernel never depends on the RxJS-shaped surface, so a convenience facade
can sit on top of it without the core knowing.

## 5. How one execution runs

Subscribing is a curried standalone function rather than a method:

```ts
const subscription = subscribe(observer)(source);
```

Under the hood:

1. `subscribe` turns a partial observer or callbacks into a *safe
   subscriber* — the consumer boundary that catches consumer throws and
   reports them through the runtime environment.
2. `executeSource(source, subscriber)` runs an optional preflight check
   (how a closed Subject throws synchronously), then calls the Observable
   function inside a guarded region so a synchronous throw from the source
   becomes an `error` notification.
3. The returned teardown is added to the subscriber's lifecycle. When the
   subscriber completes, errors, or is unsubscribed, the lifecycle runs its
   finalizers and detaches from its parents.

Three kernel mechanisms make this functional rather than object-oriented:

- **Lifecycle closure.** `createLifecycleState()` owns `closed`, parentage,
  and the finalizer list in lexical variables. Subscriptions, subscribers,
  scheduler actions, and connectables are frozen records composed over such
  a closure — they spread in a symbol-keyed *protocol* object so parentage
  bookkeeping works across records without a shared base class.
- **Teardown as a monoid.** A teardown is `() => unknown[]`: it runs its
  effect and returns the errors it collected instead of throwing. Empty
  teardown is the identity, combination is associative, and the single
  `UnsubscriptionError` throw happens once at the unsubscribe boundary.
- **Explicit runtime environment.** Subscribers carry a `RuntimeEnv`
  (`onUnhandledError`, `onStoppedNotification`, `defer`). Operator
  subscribers inherit it from their destination. The RxJS `config` object is
  compat surface that backs one live environment; the kernel never reads a
  global.

## 6. How operators are built

Operators never introduce a new object type. They are configurations of the
same operator subscriber, at one of three levels of abstraction:

1. **Sink transformers** (`mapSink`, `filterSink`, `fuseSinkTransformers`).
   The sink is one total function over the notification ADT
   (`{kind: 'N' | 'E' | 'C'}`), and an operator is a contravariant
   transformation of sinks. `map` is literally functor map over the `N`
   case; fusing two transformers is function composition.
2. **Pure step functions** (`statefulOperator`). Stateful first-order
   operators — `scan`, `reduce`, `take`, `takeWhile`, `skip`, `pairwise`,
   `distinctUntilChanged`, `defaultIfEmpty`, and many more — are written as
   `Step<S, T, R> = (state, value, index) => [nextState, Emit<R>]` where
   `Emit` is `none | one(value) | last(value) | done`. One runner owns the
   only mutable state cell; the step is pure and testable in isolation.
3. **Fused operator subscribers** (`createOperatorSubscriber(destination,
   onNext?, onComplete?, onError?, onFinalize?)`). Operators whose state must
   be mutated in place (`distinct`'s `Set`), that need finalization timing
   (`tap`), or that coordinate several sources use the generalized child
   subscriber directly.

Higher-level operators are algebra over lower-level ones wherever RxJS
itself composes them: `first` is `filter → take → defaultIfEmpty/throwIfEmpty`,
`concatAll` is `mergeAll(1)`, `mergeWith` is `merge` over `[source, ...others]`.

## 7. Machines and policies

Where RxJS uses a family of subclasses, this project looks for one machine
plus a policy record. The main instances:

**Flattening.** One machine drives every higher-order operator. Its policy
is data:

```text
FlatteningPolicy = { concurrent, overflow: enqueue | ignore | switch, settle: finalize | complete }

mergeMap    { n, enqueue, finalize }
concatMap   { 1, enqueue, finalize }
switchMap   { 1, switch,  complete }
exhaustMap  { 1, ignore,  complete }
```

The `settle` axis captures a differentially observable RxJS fact: merge and
concat release an inner in its finalize hook, switch and exhaust in its
complete handler. Two hooks recover `mergeScan`/`switchScan` (an
accumulator threaded through inners) and `expand` (values re-enter outer
admission).

**Coordination.** `merge` and `concat` are flattening algebra over
`of(...sources)`. `combineLatest`, `zip`, `race`, `forkJoin`, and
`withLatestFrom` are bespoke topologies over eagerly subscribed sources.

**Subjects.** `buildSubject(policy)` is one multicast hub — an observer list
with a lazily rebuilt broadcast snapshot for RxJS reentrancy semantics — and
the four subject kinds are policies on it: current value
(`BehaviorSubject`), size/time replay window (`ReplaySubject`),
last-on-complete (`AsyncSubject`), delegated observer and source
(`Subject.create`). Subjects are the documented mutable topology, so hub
records are the one thing intentionally not frozen.

**Sharing.** `share` is one connection over a connector Subject plus reset
policies as data (boolean or notifier factory for error, complete, and
ref-count zero). `shareReplay` is `share` with a replay connector.
`connectable`, `ConnectableObservable`, `multicast`, `refCount`, and the
`publish` family are explicit connection records carrying a symbol-keyed
connection protocol — the functional stand-in for RxJS reaching into
`_refCount`/`_connection` fields.

**Error and resubscription.** `catchError`, `retry`, `repeat`, `finalize`,
`retryWhen`, `repeatWhen`, `onErrorResumeNext` — resubscription loops with
RxJS's synchronous-resubscription handshake preserved.

**Scheduler kernel.** All host access (clock, intervals, microtasks,
timeouts, animation frames, the high-resolution clock) flows through one
frozen `timerHost` record in `runtime.ts`. One reschedulable action machine
sits on that edge, and the schedulers are policies over it: `async`
(interval-backed with RxJS's id recycling), `queue` (synchronous
trampoline), `asap` and `animationFrame` (one batch machine over two host
edges). Work receives its action as a parameter, `(state, action) => void`,
instead of RxJS's `this` binding. `Scheduler` is an action factory plus a
clock; `scheduled` carries every deprecated scheduler argument.

**Virtual time.** `VirtualTimeScheduler` is a `(frame, index)`-sorted entry
queue whose clock only advances inside `flush`; reschedules chain through
child actions so unsubscribing the original cancels the chain. Its frame
budget (`maxFrames`) is a live policy rather than a mutable field.

**Marble testing.** `TestScheduler` (`rxjs/testing`) is a record composed
over the virtual-time machine: cold observables are branded Observable
functions and hot observables anonymous Subjects, each carrying a
subscription log; expectations are closures asserted on `flush`. Run mode
installs one delegate on the host edge — where RxJS fills six provider
`delegate` slots — so `asyncScheduler`, `asapScheduler`,
`animationFrameScheduler`, both clocks, and the unhandled-error deferral all
run in virtual time inside `run()`.

## 8. The compat surface

RxJS's class names are exported as **non-constructible functional
factories** that carry the class statics as properties:

```ts
const source = Observable((subscriber) => { subscriber.next(1); subscriber.complete(); });
const subject = Subject();
const replay = ReplaySubject(2, 1000);
const vts = VirtualTimeScheduler();          // VirtualTimeScheduler.frameTimeFactor === 10
const ts = TestScheduler(assertDeepEqual);   // TestScheduler.parseMarbles(...)
```

The compat layer also owns everything that is RxJS-shaped rather than
essential: the `this`-bound initializer contract of `new Observable`, the
safe consumer boundary and `config` flags (`useDeprecatedSynchronousErrorHandling`,
`useDeprecatedNextContext`), `thisArg` overloads of `map`/`filter`,
`resultSelector` overloads of the flattening operators, trailing scheduler
arguments, the `Notification` method surface, and the seven operator-form
names of `rxjs/operators` (`combineLatest`, `concat`, `merge`, `zip`,
`race`, `partition`, `onErrorResumeNext`).

## 9. Package shape

`package.json` mirrors RxJS 7.8.2: `main`/`module`/`es2015`/`types`, an
export map with the conditions `types`, `node`, `require`, `es2015`,
`default` in RxJS's order (Node and `require` resolve to CommonJS, bundlers
to ES modules), `./package.json`, and the subpaths:

```text
rxjs-pure-fp             175 / 175 root names  (+ 20 functional extensions)
rxjs-pure-fp/operators   115 / 115 names
rxjs-pure-fp/testing       3 /   3 names  (TestScheduler + the CommonJS interop artifacts)
```

`./ajax`, `./fetch`, and `./webSocket` are the only oracle subpaths not
provided; they are host I/O surfaces rather than reactive machinery.

## 10. How parity is proven

The project never claims a behavior it has not measured.

- **Oracle.** `rxjs@7.8.2` is a pinned dev dependency. `reference/exports.json`
  is a generated manifest of its public export names, captured through Node's
  own import of the package so both sides carry the same CommonJS interop
  artifacts (`__esModule`, `default`).
- **Differential tests.** Every suite under `test/differential/` defines a
  scenario once and runs it through two adapters — the real RxJS and this
  package — then asserts the traces are equal. Where the two APIs differ in
  shape (methods vs. curried functions, `this`-bound work vs. an action
  parameter), the adapter bridges the shape and nothing else.
- **Gates.** `npm run verify` runs typecheck, repository lint, the
  architecture gate, unit tests, differential tests, the build, strict export
  parity (a missing *or unexpected* export fails), the distribution
  architecture check, the package-shape gate (import, `require`, ES-module
  file, and declaration views of every entry must agree), and the
  certification matrix.
- **Derived certification.** `tools/certification-matrix.mjs` reads the
  oracle import lists of the differential suites and writes
  `docs/CERTIFICATION-MATRIX.md` and `feature-parity-list.md`. A name counts
  as certified only if a suite imports it from the oracle and traces it; an
  exported name without coverage fails the gate. Nothing in those two files
  is typed by hand.

Standing at the close of the mission:

| Gate | Result |
| --- | --- |
| Architecture gate | 161 TypeScript source files |
| Unit tests | 228 / 228 |
| Differential tests | 335 / 335 across 23 suites |
| Export parity | root 175/175, operators 115/115, testing 3/3, unexpected 0 |
| Distribution check | 322 emitted JavaScript files |

## 11. Feature map

Everything RxJS 7.8.2 exports from its root, grouped the way it was built:

```text
Core            Observable  Subscriber  Subscription  UnsubscriptionError  config  pipe  identity  noop
Errors          EmptyError  ArgumentOutOfRangeError  SequenceError  NotFoundError  TimeoutError
                ObjectUnsubscribedError
Creation        of  from  defer  iif  range  generate  using  timer  interval  empty/EMPTY  never/NEVER
                pairs  throwError  fromEvent  fromEventPattern  bindCallback  bindNodeCallback
                scheduled  animationFrames  isObservable  observable  firstValueFrom  lastValueFrom
Projection      map  mapTo  pluck  scan  reduce  tap  pairwise  distinct  distinctUntilChanged
                distinctUntilKeyChanged  filter  ignoreElements
Selection       take  takeLast  takeWhile  takeUntil  skip  skipLast  skipWhile  skipUntil
                first  last  single  elementAt  defaultIfEmpty  throwIfEmpty
Higher-order    mergeMap  concatMap  switchMap  exhaustMap  mergeAll  concatAll  switchAll  exhaustAll
                exhaust  flatMap  mergeMapTo  concatMapTo  switchMapTo  mergeScan  switchScan  expand
Coordination    merge  concat  combineLatest  zip  race  forkJoin  withLatestFrom
                mergeWith  concatWith  combineLatestWith  zipWith  raceWith
                combineAll  combineLatestAll  zipAll
Subjects        Subject  BehaviorSubject  ReplaySubject  AsyncSubject
Sharing         share  shareReplay  connectable  connect  ConnectableObservable  multicast  refCount
                publish  publishBehavior  publishLast  publishReplay
Recovery        catchError  retry  retryWhen  repeat  repeatWhen  finalize
                onErrorResumeNext  onErrorResumeNextWith
Schedulers      asyncScheduler  asapScheduler  queueScheduler  animationFrameScheduler (and aliases)
                Scheduler  VirtualTimeScheduler  VirtualAction  observeOn  subscribeOn
Temporal        delay  delayWhen  debounce  debounceTime  audit  auditTime  throttle  throttleTime
                sample  sampleTime  timeout  timeoutWith
Boundary        buffer  bufferCount  bufferTime  bufferToggle  bufferWhen
                window  windowCount  windowTime  windowToggle  windowWhen
Collection      groupBy  partition  count  max  min  every  find  findIndex  toArray  isEmpty
                sequenceEqual
Materialization materialize  dematerialize  Notification  NotificationKind  timeInterval  timestamp
                startWith  endWith
Testing         TestScheduler (rxjs/testing)
```

## 12. Functional extensions

Twenty names are exported from the root beyond the RxJS list. They are the
kernel's own API and are tracked separately, never counted as parity:

```text
createObservable  createSubscriber  createSubscription  subscribe  pipeValue  innerFrom
createSubject  createBehaviorSubject  createReplaySubject  createAsyncSubject
createConnectableObservable  createScheduler  createVirtualTimeScheduler
mapSink  filterSink  fuseSinkTransformers  liftSinkTransformer
statefulOperator  emitNone  emitOne
```

`pipeValue(source, op1, op2, ...)` is the replacement for `source.pipe(...)`;
`subscribe(observer)(source)` for `source.subscribe(observer)`.

## 13. What is deliberately different

Behavior is the compatibility target; the object model is not. The recorded
deviations are small and listed per milestone in `RXJS-7.8.2-PARITY.md`.
The ones a user meets first:

- parity class names are factories, not constructors (`Observable(fn)`, not
  `new Observable(fn)`); there are no prototype methods, so no `source.pipe`
  or `source.subscribe`;
- records are frozen: `maxFrames`, scheduler actions, subscriptions, and
  subscribers are not assignable after creation;
- a raw unbranded `(subscriber) => ...` function is a valid Observable
  everywhere except as a trailing rest argument of a selector-capable API
  (use the array form there) and as an emitted value a `TestScheduler`
  should materialize;
- `refCount` reads an internal connection protocol rather than private
  fields, and rejects non-connectable sources with its own `TypeError`.

## 14. Using the library

A pipeline:

```ts
import { filter, map, of, pipeValue, subscribe } from 'rxjs-pure-fp';

const source = pipeValue(
  of(1, 2, 3, 4),
  map((n) => n * 10),
  filter((n) => n > 10)
);

subscribe({
  next: (value) => console.log(value),
  complete: () => console.log('done'),
})(source);
```

A custom source with teardown, and a Subject:

```ts
import { Subject, createObservable, pipeValue, subscribe, takeUntil } from 'rxjs-pure-fp';

const ticks = createObservable<number>((subscriber) => {
  let n = 0;
  const id = setInterval(() => subscriber.next(n++), 100);
  return () => clearInterval(id);
});

const stop = Subject<void>();
subscribe((n) => console.log(n))(pipeValue(ticks, takeUntil(stop)));
setTimeout(() => stop.next(), 550);
```

A marble test:

```ts
import assert from 'node:assert/strict';
import { map, pipeValue } from 'rxjs-pure-fp';
import { TestScheduler } from 'rxjs-pure-fp/testing';

const scheduler = TestScheduler((actual, expected) => assert.deepEqual(actual, expected));

scheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
  const source = cold('-a-b|');
  const result = pipeValue(source, map((v) => v.toUpperCase()));
  expectObservable(result).toBe('-A-B|');
  expectSubscriptions(source.subscriptions).toBe('^---!');
});
```

## 15. Where to read next

- `docs/ARCHITECTURE.md` — the mechanisms milestone by milestone.
- `docs/SEMANTICS.md` — the behavioral claims, with their deviations.
- `docs/RXJS-7.8.2-PARITY.md` — certified scope per milestone and the
  status table.
- `docs/EXECUTION-PLAN.md` — how the work was sequenced across eight sessions.
- `docs/FP-ROADMAP.md` — the functional deepening (kernel/compat split, sink
  ADT, pure steps, record composition, teardown monoid, runtime environment,
  type hygiene, executable algebra laws).
- `docs/CERTIFICATION-MATRIX.md` and `feature-parity-list.md` — generated
  evidence, one row per export.
