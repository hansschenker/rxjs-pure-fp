import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ConnectableObservable as RxConnectableObservable,
  Observable as RxObservable,
  ReplaySubject as RxReplaySubject,
  Scheduler as RxScheduler,
  Subject as RxSubject,
  VirtualAction as RxVirtualAction,
  VirtualTimeScheduler as RxVirtualTimeScheduler,
  animationFrame as rxAnimationFrameAlias,
  animationFrameScheduler as rxAnimationFrame,
  animationFrames as rxAnimationFrames,
  asapScheduler as rxAsap,
  asyncScheduler as rxAsync,
  combineAll as rxCombineAll,
  combineLatest as rxCombineLatest,
  combineLatestAll as rxCombineLatestAll,
  concat as rxConcat,
  delayWhen as rxDelayWhen,
  empty as rxEmpty,
  endWith as rxEndWith,
  from as rxFrom,
  generate as rxGenerate,
  interval as rxInterval,
  map as rxMap,
  merge as rxMerge,
  multicast as rxMulticast,
  of as rxOf,
  pairs as rxPairs,
  publish as rxPublish,
  publishBehavior as rxPublishBehavior,
  publishLast as rxPublishLast,
  publishReplay as rxPublishReplay,
  queueScheduler as rxQueue,
  range as rxRange,
  refCount as rxRefCount,
  scheduled as rxScheduled,
  shareReplay as rxShareReplay,
  startWith as rxStartWith,
  take as rxTake,
  throwError as rxThrowError,
  timer as rxTimer,
  zipAll as rxZipAll,
} from 'rxjs';
import { combineLatest, concat, merge } from '../../src/compat/coordination.ts';
import {
  ConnectableObservable,
  publish,
  publishBehavior,
  publishLast,
  publishReplay,
} from '../../src/compat/multicast.ts';
import { subscribe } from '../../src/compat/observable.ts';
import { Scheduler, VirtualAction, VirtualTimeScheduler } from '../../src/compat/scheduler.ts';
import { endWith, of, startWith } from '../../src/compat/scheduler-args.ts';
import { multicast, refCount } from '../../src/kernel/connectable-observable.ts';
import { animationFrames } from '../../src/kernel/creation/animation-frames.ts';
import { empty } from '../../src/kernel/creation/empty.ts';
import { from } from '../../src/kernel/creation/from.ts';
import { generate } from '../../src/kernel/creation/generate.ts';
import { interval } from '../../src/kernel/creation/interval.ts';
import { pairs } from '../../src/kernel/creation/pairs.ts';
import { range } from '../../src/kernel/creation/range.ts';
import { throwError } from '../../src/kernel/creation/throw-error.ts';
import { timer } from '../../src/kernel/creation/timer.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { delayWhen } from '../../src/kernel/operators/delay-when.ts';
import { combineAll, combineLatestAll, zipAll } from '../../src/kernel/operators/join-all.ts';
import { map } from '../../src/kernel/operators/map.ts';
import { take } from '../../src/kernel/operators/take.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { scheduled } from '../../src/kernel/scheduled.ts';
import {
  animationFrameScheduler,
  asapScheduler,
  asyncScheduler,
  queueScheduler,
} from '../../src/kernel/scheduler.ts';
import { shareReplay } from '../../src/kernel/sharing.ts';
import { createReplaySubject, createSubject } from '../../src/kernel/subject.ts';

// Node has no animation frames: both sides resolve `requestAnimationFrame`
// on the host at call time, so one setTimeout-backed polyfill serves both.
// `onFrame` lets a scenario log frame boundaries.
let onFrame = () => {};
globalThis.requestAnimationFrame = (callback) =>
  setTimeout(() => {
    onFrame();
    callback(performance.now());
  }, 16);
globalThis.cancelAnimationFrame = (handle) => clearTimeout(handle);

// Bridge: RxJS work uses `this`-bound actions; ours passes the action as a
// parameter. Both sides expose the same (state, action) shape to scenarios.
const bridgeAction = (self) => ({
  schedule: (state, delay) => self.schedule(state, delay),
  unsubscribe: () => self.unsubscribe(),
  get closed() {
    return self.closed;
  },
});
const wrapRxWork = (work) =>
  function bridge(state) {
    work(state, bridgeAction(this));
  };
const wrapRxScheduler = (scheduler) => ({
  raw: scheduler,
  now: () => scheduler.now(),
  schedule: (work, delay, state) => scheduler.schedule(wrapRxWork(work), delay, state),
  flush: () => scheduler.flush(),
  frame: () => scheduler.frame,
  index: () => scheduler.index,
  maxFrames: scheduler.maxFrames,
});
const wrapOwnScheduler = (scheduler) => ({
  raw: scheduler,
  now: scheduler.now,
  schedule: scheduler.schedule,
  flush: scheduler.flush,
  frame: () => scheduler.frame,
  index: () => scheduler.index,
  maxFrames: scheduler.maxFrames,
});

const adapters = {
  rxjs: {
    create: (initializer) => new RxObservable(initializer),
    subscribe: (observer) => (source) => source.subscribe(observer),
    apply: (source, ...operators) => source.pipe(...operators),
    subject: () => new RxSubject(),
    replaySubject: (size, windowTime, provider) => new RxReplaySubject(size, windowTime, provider),
    connectableObservable: (source, factory) => new RxConnectableObservable(source, factory),
    multicast: rxMulticast,
    refCount: rxRefCount,
    publish: rxPublish,
    publishBehavior: rxPublishBehavior,
    publishLast: rxPublishLast,
    publishReplay: rxPublishReplay,
    shareReplay: rxShareReplay,
    combineLatestAll: rxCombineLatestAll,
    combineAll: rxCombineAll,
    zipAll: rxZipAll,
    of: rxOf,
    from: rxFrom,
    range: rxRange,
    empty: rxEmpty,
    pairs: rxPairs,
    generate: rxGenerate,
    throwError: rxThrowError,
    startWith: rxStartWith,
    endWith: rxEndWith,
    concat: rxConcat,
    merge: rxMerge,
    combineLatest: rxCombineLatest,
    delayWhen: rxDelayWhen,
    map: rxMap,
    take: rxTake,
    timer: rxTimer,
    interval: rxInterval,
    scheduled: rxScheduled,
    queue: rxQueue,
    asap: rxAsap,
    async: rxAsync,
    animationFrame: wrapRxScheduler(rxAnimationFrame),
    animationFrameAliased: rxAnimationFrameAlias === rxAnimationFrame,
    animationFrames: rxAnimationFrames,
    scheduler: (factory, now) =>
      new RxScheduler(function Ctor(scheduler, work) {
        return factory(scheduler, work);
      }, now),
    schedulerNow: RxScheduler.now,
    virtualTime: (maxFrames) =>
      wrapRxScheduler(
        maxFrames === undefined
          ? new RxVirtualTimeScheduler()
          : new RxVirtualTimeScheduler(undefined, maxFrames)
      ),
    virtualAction: (vts, work) => new RxVirtualAction(vts.raw, wrapRxWork(work)),
    sortActions: RxVirtualAction.sortActions,
    frameTimeFactor: RxVirtualTimeScheduler.frameTimeFactor,
  },
  pureFp: {
    create: createObservable,
    subscribe,
    apply: (source, ...operators) => pipeValue(source, ...operators),
    subject: createSubject,
    replaySubject: createReplaySubject,
    connectableObservable: ConnectableObservable,
    multicast,
    refCount,
    publish,
    publishBehavior,
    publishLast,
    publishReplay,
    shareReplay,
    combineLatestAll,
    combineAll,
    zipAll,
    of,
    from,
    range,
    empty,
    pairs,
    generate,
    throwError,
    startWith,
    endWith,
    concat,
    merge,
    combineLatest,
    delayWhen,
    map,
    take,
    timer,
    interval,
    scheduled,
    queue: queueScheduler,
    asap: asapScheduler,
    async: asyncScheduler,
    animationFrame: wrapOwnScheduler(animationFrameScheduler),
    animationFrameAliased: true,
    animationFrames,
    scheduler: Scheduler,
    schedulerNow: Scheduler.now,
    virtualTime: (maxFrames) => wrapOwnScheduler(VirtualTimeScheduler(undefined, maxFrames)),
    virtualAction: (vts, work) => VirtualAction(vts.raw, work),
    sortActions: VirtualAction.sortActions,
    frameTimeFactor: VirtualTimeScheduler.frameTimeFactor,
  },
};

const settle = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));

const coldHarness = (adapter) => {
  const events = [];
  let runs = 0;
  let sourceSubscriber = null;
  const source = adapter.create((subscriber) => {
    runs += 1;
    sourceSubscriber = subscriber;
    events.push(`run:${runs}`);
    return () => events.push(`teardown:${runs}`);
  });
  const observer = (tag) => ({
    next: (value) => events.push(`${tag}:${value}`),
    error: (error) => events.push(`${tag}!${error.message}`),
    complete: () => events.push(`${tag}.`),
  });
  return {
    events,
    source,
    observer,
    push: (value) => sourceSubscriber.next(value),
    settle: (how) =>
      how === 'complete' ? sourceSubscriber.complete() : sourceSubscriber.error(new Error('multicast-boom')),
    runs: () => runs,
  };
};

const collect = (adapter, source) => {
  const log = [];
  adapter.subscribe({
    next: (value) => log.push(value),
    error: (error) => log.push(`E:${error.message}`),
    complete: () => log.push('C'),
  })(source);
  return log;
};

// --- ConnectableObservable / multicast / refCount / publish family ---------

const connectableObservableTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.connectableObservable(h.source, () => adapter.subject());
  adapter.subscribe(h.observer('a'))(shared);
  h.events.push(`pre-connect-runs:${h.runs()}`);
  const c1 = shared.connect();
  const c2 = shared.connect();
  h.push(1);
  adapter.subscribe(h.observer('b'))(shared);
  h.push(2);
  c1.unsubscribe();
  adapter.subscribe(h.observer('c'))(shared);
  shared.connect();
  h.push(3);
  return { events: h.events, runs: h.runs(), idempotent: c1 === c2 };
};

const connectableCompleteTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.connectableObservable(h.source, () => adapter.subject());
  adapter.subscribe(h.observer('a'))(shared);
  const c = shared.connect();
  h.push(1);
  h.settle('complete');
  h.events.push(`connection-closed:${c.closed}`);
  adapter.subscribe(h.observer('late'))(shared);
  const c2 = shared.connect();
  h.push(2);
  h.events.push(`same-connection:${c === c2}`);
  return { events: h.events, runs: h.runs() };
};

const connectableErrorTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.connectableObservable(h.source, () => adapter.subject());
  adapter.subscribe(h.observer('a'))(shared);
  shared.connect();
  h.settle('error');
  adapter.subscribe(h.observer('late'))(shared);
  shared.connect();
  h.push(2);
  return { events: h.events, runs: h.runs() };
};

const connectableSyncCompleteTrace = (adapter) => {
  const events = [];
  let runs = 0;
  const source = adapter.create((subscriber) => {
    runs += 1;
    subscriber.next(`v${runs}`);
    subscriber.complete();
    return () => events.push(`teardown:${runs}`);
  });
  const shared = adapter.connectableObservable(source, () => adapter.subject());
  adapter.subscribe({ next: (v) => events.push(`a:${v}`), complete: () => events.push('a.') })(shared);
  const c1 = shared.connect();
  events.push(`closed:${c1.closed}`);
  const c2 = shared.connect();
  events.push(`closed-again:${c2.closed}`, `runs:${runs}`);
  return events;
};

const refCountOperatorTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.apply(adapter.multicast(() => adapter.subject())(h.source), adapter.refCount());
  const a = adapter.subscribe(h.observer('a'))(shared);
  h.push(1);
  const b = adapter.subscribe(h.observer('b'))(shared);
  h.push(2);
  a.unsubscribe();
  h.push(3);
  b.unsubscribe();
  h.events.push(`runs-after-last:${h.runs()}`);
  adapter.subscribe(h.observer('c'))(shared);
  h.push(4);
  return { events: h.events, runs: h.runs() };
};

const refCountMethodTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.connectableObservable(h.source, () => adapter.subject()).refCount();
  const a = adapter.subscribe(h.observer('a'))(shared);
  h.push(1);
  h.settle('complete');
  h.events.push(`a-closed:${a.closed}`);
  adapter.subscribe(h.observer('b'))(shared);
  h.push(2);
  return { events: h.events, runs: h.runs() };
};

const multicastSubjectReuseTrace = (adapter) => {
  const h = coldHarness(adapter);
  const subject = adapter.subject();
  const shared = adapter.multicast(subject)(h.source);
  adapter.subscribe(h.observer('a'))(shared);
  shared.connect();
  h.push(1);
  h.settle('complete');
  adapter.subscribe(h.observer('late'))(shared);
  shared.connect();
  h.push(9);
  return { events: h.events, runs: h.runs() };
};

const multicastSelectorTrace = (adapter) => {
  const h = coldHarness(adapter);
  const events = [];
  adapter.subscribe({
    next: (value) => events.push(value),
    complete: () => events.push('complete'),
  })(
    adapter.multicast(
      () => adapter.subject(),
      (shared) => adapter.merge(shared, adapter.apply(shared, adapter.map((value) => value * 10)))
    )(h.source)
  );
  h.push(1);
  h.push(2);
  h.settle('complete');
  return { events, sourceEvents: h.events, runs: h.runs() };
};

const publishTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.publish()(h.source);
  adapter.subscribe(h.observer('a'))(shared);
  h.events.push(`runs:${h.runs()}`);
  shared.connect();
  h.push(1);
  h.settle('complete');
  adapter.subscribe(h.observer('late'))(shared);

  const h2 = coldHarness(adapter);
  const selected = [];
  adapter.subscribe({ next: (value) => selected.push(value), complete: () => selected.push('complete') })(
    adapter.publish((shared) => adapter.merge(shared, adapter.apply(shared, adapter.map((value) => `${value}!`))))(
      h2.source
    )
  );
  h2.push('x');
  h2.settle('complete');
  return { events: h.events, selected, selectedRuns: h2.runs() };
};

const publishBehaviorTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.publishBehavior(0)(h.source);
  adapter.subscribe(h.observer('a'))(shared);
  shared.connect();
  h.push(1);
  adapter.subscribe(h.observer('b'))(shared);
  h.settle('complete');
  adapter.subscribe(h.observer('late'))(shared);
  return { events: h.events, runs: h.runs() };
};

const publishLastTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.publishLast()(h.source);
  adapter.subscribe(h.observer('a'))(shared);
  shared.connect();
  h.push(1);
  h.push(2);
  adapter.subscribe(h.observer('b'))(shared);
  h.settle('complete');
  adapter.subscribe(h.observer('late'))(shared);
  return { events: h.events, runs: h.runs() };
};

const publishReplayTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.publishReplay(2)(h.source);
  shared.connect();
  h.push(1);
  h.push(2);
  h.push(3);
  adapter.subscribe(h.observer('a'))(shared);
  h.push(4);
  h.settle('complete');
  adapter.subscribe(h.observer('late'))(shared);

  const h2 = coldHarness(adapter);
  const selected = [];
  adapter.subscribe({ next: (value) => selected.push(value), complete: () => selected.push('complete') })(
    adapter.publishReplay(1, undefined, (shared) =>
      adapter.merge(shared, adapter.apply(shared, adapter.map((value) => value * 100)))
    )(h2.source)
  );
  h2.push(1);
  h2.settle('complete');
  return { events: h.events, runs: h.runs(), selected, selectedRuns: h2.runs() };
};

// --- Replay time windows (ReplaySubject / shareReplay / publishReplay) -----

const replayWindowTrace = (adapter) => {
  let t = 0;
  const clock = { now: () => t };
  const events = [];
  const observer = (tag) => ({
    next: (value) => events.push(`${tag}:${value}`),
    complete: () => events.push(`${tag}.`),
  });
  const subject = adapter.replaySubject(Infinity, 100, clock);
  subject.next(1);
  t = 50;
  subject.next(2);
  t = 120;
  adapter.subscribe(observer('a'))(subject);
  t = 160;
  subject.next(3);
  adapter.subscribe(observer('b'))(subject);
  t = 300;
  adapter.subscribe(observer('c'))(subject);
  subject.complete();
  adapter.subscribe(observer('late'))(subject);

  const sized = adapter.replaySubject(2, 100, clock);
  t = 0;
  sized.next('x');
  sized.next('y');
  sized.next('z');
  t = 50;
  adapter.subscribe(observer('s'))(sized);
  return events;
};

const shareReplayWindowTrace = (adapter) => {
  let t = 0;
  const clock = { now: () => t };
  const h = coldHarness(adapter);
  const shared = adapter.shareReplay({ bufferSize: 5, windowTime: 100, scheduler: clock })(h.source);
  adapter.subscribe(h.observer('a'))(shared);
  h.push(1);
  t = 60;
  h.push(2);
  t = 130;
  adapter.subscribe(h.observer('late'))(shared);

  const h2 = coldHarness(adapter);
  const positional = adapter.shareReplay(1, 100, clock)(h2.source);
  t = 0;
  adapter.subscribe(h2.observer('p'))(positional);
  h2.push('x');
  t = 250;
  adapter.subscribe(h2.observer('expired'))(positional);
  h2.push('y');
  return { events: h.events, positional: h2.events };
};

const publishReplayWindowTrace = (adapter) => {
  let t = 0;
  const clock = { now: () => t };
  const h = coldHarness(adapter);
  const shared = adapter.publishReplay(Infinity, 100, clock)(h.source);
  shared.connect();
  h.push(1);
  t = 80;
  h.push(2);
  t = 150;
  adapter.subscribe(h.observer('a'))(shared);
  return h.events;
};

// --- combineLatestAll / combineAll / zipAll ---------------------------------

const joinAllTrace = (adapter) => ({
  combineLatestAll: collect(
    adapter,
    adapter.apply(adapter.of(adapter.of(1, 2), adapter.of('a', 'b')), adapter.combineLatestAll())
  ),
  combineLatestAllProject: collect(
    adapter,
    adapter.apply(adapter.of(adapter.of(1, 2), adapter.of(10)), adapter.combineLatestAll((x, y) => x + y))
  ),
  combineAllAlias: adapter.combineAll === adapter.combineLatestAll,
  combineLatestAllEmpty: collect(adapter, adapter.apply(adapter.of(), adapter.combineLatestAll())),
  zipAll: collect(adapter, adapter.apply(adapter.of(adapter.of(1, 2, 3), adapter.of('a', 'b')), adapter.zipAll())),
  zipAllProject: collect(
    adapter,
    adapter.apply(adapter.of(adapter.of(1, 2), adapter.of(3, 4)), adapter.zipAll((x, y) => x * y))
  ),
  zipAllEmpty: collect(adapter, adapter.apply(adapter.of(), adapter.zipAll())),
  zipAllArrayInputs: collect(adapter, adapter.apply(adapter.of([1, 2], [3, 4]), adapter.zipAll())),
});

// --- scheduled + the deprecated scheduler arguments ------------------------

const schedulerFormsTrace = (adapter) => {
  const q = adapter.queue;
  const obj = { x: 1, y: 2 };
  return {
    scheduledArray: collect(adapter, adapter.scheduled([1, 2, 3], q)),
    scheduledString: collect(adapter, adapter.scheduled('ab', q)),
    scheduledIterable: collect(adapter, adapter.scheduled(new Set([7, 8]), q)),
    scheduledObservable: collect(adapter, adapter.scheduled(adapter.of('o1', 'o2'), q)),
    fromScheduler: collect(adapter, adapter.from([4, 5], q)),
    ofScheduler: collect(adapter, adapter.of(1, 2, q)),
    ofOnlyScheduler: collect(adapter, adapter.of(q)),
    rangeScheduler: collect(adapter, adapter.range(1, 3, q)),
    emptyScheduler: collect(adapter, adapter.empty(q)),
    pairsScheduler: collect(adapter, adapter.pairs(obj, q)),
    generateOptions: collect(
      adapter,
      adapter.generate({ initialState: 1, condition: (s) => s < 4, iterate: (s) => s + 1, scheduler: q })
    ),
    generatePositionalScheduler: collect(adapter, adapter.generate(1, (s) => s < 3, (s) => s + 1, q)),
    generateSelectorScheduler: collect(
      adapter,
      adapter.generate(1, (s) => s < 3, (s) => s + 1, (s) => s * 10, q)
    ),
    throwErrorScheduler: collect(adapter, adapter.throwError(() => new Error('scheduled-boom'), q)),
    startWithScheduler: collect(adapter, adapter.apply(adapter.of('s'), adapter.startWith('a', 'b', q))),
    endWithScheduler: collect(adapter, adapter.apply(adapter.of('s'), adapter.endWith('y', 'z', q))),
    concatScheduler: collect(adapter, adapter.concat(adapter.of(1), adapter.of(2), q)),
    mergeScheduler: collect(adapter, adapter.merge(adapter.of(1), adapter.of(2), q)),
    mergeConcurrentScheduler: collect(adapter, adapter.merge(adapter.of(1), adapter.of(2), 1, q)),
    mergeSingleScheduler: collect(adapter, adapter.merge(adapter.of(1), q)),
    combineLatestScheduler: collect(adapter, adapter.combineLatest(adapter.of(1, 2), adapter.of('a'), q)),
    combineLatestEmptyScheduler: collect(adapter, adapter.combineLatest([], q)),
  };
};

const scheduledAsapOrderTrace = async (adapter) => {
  const log = [];
  log.push('subscribe');
  adapter.subscribe({ next: (value) => log.push(value), complete: () => log.push('C') })(
    adapter.scheduled([1, 2], adapter.asap)
  );
  Promise.resolve().then(() => log.push('microtask'));
  log.push('sync');
  await settle();
  return log;
};

const scheduledAsyncKindsTrace = async (adapter) => {
  async function* asyncGen() {
    yield 'a1';
    yield 'a2';
  }
  const log = { promise: [], asyncIterable: [], observableAsync: [] };
  adapter.subscribe({ next: (v) => log.promise.push(v), complete: () => log.promise.push('C') })(
    adapter.scheduled(Promise.resolve('p'), adapter.asap)
  );
  adapter.subscribe({ next: (v) => log.asyncIterable.push(v), complete: () => log.asyncIterable.push('C') })(
    adapter.scheduled(asyncGen(), adapter.asap)
  );
  adapter.subscribe({ next: (v) => log.observableAsync.push(v), complete: () => log.observableAsync.push('C') })(
    adapter.scheduled(adapter.of('x'), adapter.async)
  );
  log.observableAsync.push('sync');
  await settle(60);
  return log;
};

// Iterator release is certified on the asap path: under the queue scheduler
// RxJS's action loses its scheduler reference when the take-driven
// unsubscribe closes it mid-trampoline, throws inside the flush, and never
// returns the iterator teardown (a swallowed crash, recorded as a deviation —
// this implementation releases the iterator on both paths).
const scheduledIterableTeardownTrace = async (adapter) => {
  const log = [];
  function* gen() {
    log.push('g-start');
    try {
      yield 1;
      yield 2;
    } finally {
      log.push('g-finally');
    }
  }
  adapter.subscribe({ next: (v) => log.push(`next:${v}`), complete: () => log.push('C') })(
    adapter.apply(adapter.scheduled(gen(), adapter.asap), adapter.take(1))
  );
  await settle();
  return log;
};

const scheduledIterableErrorsTrace = (adapter) => {
  const log = [];
  function* throwing() {
    yield 'ok';
    throw new Error('iter-boom');
  }
  adapter.subscribe({ next: (v) => log.push(`t:${v}`), error: (e) => log.push(`E:${e.message}`) })(
    adapter.scheduled(throwing(), adapter.queue)
  );
  let invalid = null;
  try {
    adapter.scheduled(42, adapter.queue);
  } catch (error) {
    invalid = { name: error.name, message: error.message };
  }
  return { log, invalid };
};

const delayWhenSubscriptionDelayTrace = (adapter) => {
  const log = [];
  const source = adapter.create((subscriber) => {
    log.push('source-run');
    subscriber.next('v');
    subscriber.complete();
  });
  const subscriptionDelay = adapter.create((subscriber) => {
    log.push('delay-run');
    subscriber.next('d1');
    subscriber.next('d2');
    subscriber.complete();
  });
  adapter.subscribe({ next: (value) => log.push(`next:${value}`), complete: () => log.push('C') })(
    adapter.apply(source, adapter.delayWhen(() => adapter.of('x'), subscriptionDelay))
  );
  return log;
};

// --- Scheduler factory shape -------------------------------------------------

const schedulerFactoryTrace = (adapter) => {
  const log = [];
  const scheduler = adapter.scheduler(
    (owner, work) => ({
      schedule(state, delay) {
        log.push(`action:${state}:${delay}:${owner.now()}`);
        work(state);
        return { closed: false, unsubscribe() {}, add() {}, remove() {} };
      },
    }),
    () => 42
  );
  const returned = scheduler.schedule((state) => log.push(`work:${state}`), 5, 'st');
  log.push(`now:${scheduler.now()}`, `returned:${returned.closed}`, `static:${typeof adapter.schedulerNow()}`);
  return log;
};

// --- Virtual time -------------------------------------------------------------

const virtualTimeOrderTrace = (adapter) => {
  const vts = adapter.virtualTime();
  const log = [];
  log.push(`start:${vts.now()}:${vts.frame()}:${vts.index()}`);
  vts.schedule(() => log.push(`c@${vts.now()}`), 30);
  vts.schedule(
    (state) => {
      log.push(`a@${vts.now()}:${state}`);
      vts.schedule(() => log.push(`nested@${vts.now()}`), 5);
    },
    10,
    'A'
  );
  vts.schedule(() => log.push(`b@${vts.now()}`), 20);
  vts.schedule(() => log.push(`same-frame-2@${vts.now()}`), 20);
  log.push(`before-flush:${vts.now()}`);
  vts.flush();
  log.push(`after-flush:${vts.now()}:${vts.frame()}:${vts.index()}:${vts.maxFrames}`);
  return log;
};

const virtualTimeRescheduleTrace = (adapter) => {
  const vts = adapter.virtualTime();
  const log = [];
  vts.schedule(
    (state, action) => {
      log.push(`tick:${state}@${vts.now()}`);
      if (state < 3) {
        action.schedule(state + 1, 10);
      }
    },
    0,
    1
  );
  const original = vts.schedule(
    (state, action) => {
      log.push(`chain:${state}@${vts.now()}`);
      if (state < 5) {
        action.schedule(state + 1, 10);
      }
    },
    1,
    1
  );
  vts.schedule(() => {
    original.unsubscribe();
    log.push(`cancelled@${vts.now()}:${original.closed}`);
  }, 15);
  vts.flush();
  log.push(`end@${vts.now()}`);
  return log;
};

const virtualTimeLimitsTrace = (adapter) => {
  const bounded = adapter.virtualTime(25);
  const log = [];
  bounded.schedule(() => log.push('10'), 10);
  bounded.schedule(() => log.push('30'), 30);
  const never = bounded.schedule(() => log.push('never'), Infinity);
  log.push(`infinite-closed:${never.closed}`);
  bounded.flush();
  log.push(`frame:${bounded.frame()}`, `max:${bounded.maxFrames}`);

  const failing = adapter.virtualTime();
  failing.schedule(() => log.push('first'), 5);
  failing.schedule(() => {
    throw new Error('vt-boom');
  }, 10);
  const later = failing.schedule(() => log.push('later'), 20);
  try {
    failing.flush();
  } catch (error) {
    log.push(`caught:${error.message}`);
  }
  log.push(`later-closed:${later.closed}`, `failing-frame:${failing.frame()}`);
  return log;
};

const virtualTimerTrace = (adapter) => {
  const vts = adapter.virtualTime();
  const log = [];
  adapter.subscribe({ next: (v) => log.push(`t:${v}@${vts.now()}`), complete: () => log.push(`tc@${vts.now()}`) })(
    adapter.timer(100, vts.raw)
  );
  adapter.subscribe({ next: (v) => log.push(`i:${v}@${vts.now()}`), complete: () => log.push(`ic@${vts.now()}`) })(
    adapter.apply(adapter.interval(30, vts.raw), adapter.take(3))
  );
  vts.flush();
  return log;
};

const virtualActionTrace = (adapter) => {
  const vts = adapter.virtualTime();
  const log = [];
  const action = adapter.virtualAction(vts, (state) => log.push(`work:${state}@${vts.now()}`));
  log.push(`index:${action.index}`);
  action.schedule('s', 7);
  log.push(`delay:${action.delay}`, `closed:${action.closed}`, `scheduler-index:${vts.index()}`);
  vts.flush();
  log.push(`after:${action.closed}`);
  const sorted = [
    { delay: 5, index: 2 },
    { delay: 1, index: 9 },
    { delay: 5, index: 1 },
  ]
    .sort(adapter.sortActions)
    .map((entry) => `${entry.delay}/${entry.index}`);
  return [...log, ...sorted, `factor:${adapter.frameTimeFactor}`];
};

// --- animationFrame scheduler / animationFrames ------------------------------

const animationFrameBatchTrace = async (adapter) => {
  const log = [];
  onFrame = () => log.push('frame');
  adapter.animationFrame.schedule(() => {
    log.push('a');
    adapter.animationFrame.schedule(() => log.push('c'));
  });
  adapter.animationFrame.schedule(() => log.push('b'));
  log.push('sync');
  await settle(80);
  onFrame = () => {};
  return log;
};

const animationFrameRescheduleTrace = async (adapter) => {
  const log = [];
  onFrame = () => log.push('frame');
  adapter.animationFrame.schedule(
    (state, action) => {
      log.push(`n:${state}`);
      if (state < 2) {
        action.schedule(state + 1);
      }
    },
    0,
    0
  );
  await settle(100);
  onFrame = () => {};
  return log;
};

const animationFrameCancelAndDelayTrace = async (adapter) => {
  const log = [];
  const pending = adapter.animationFrame.schedule(() => log.push('cancelled-work'));
  pending.unsubscribe();
  adapter.animationFrame.schedule(() => log.push('delayed'), 10);
  log.push('sync', `aliased:${adapter.animationFrameAliased}`, `now:${typeof adapter.animationFrame.now()}`);
  await settle(80);
  return log;
};

const animationFramesTrace = async (adapter) => {
  let t = 0;
  const provider = { now: () => (t += 1) };
  const log = [];
  adapter.subscribe({ next: (frame) => log.push(frame), complete: () => log.push('C') })(
    adapter.apply(adapter.animationFrames(provider), adapter.take(2))
  );
  const shape = [];
  adapter.subscribe({ next: (frame) => shape.push(Object.keys(frame).map((k) => `${k}:${typeof frame[k]}`)) })(
    adapter.apply(adapter.animationFrames(), adapter.take(1))
  );
  await settle(80);
  return { log, shape, sameDefault: adapter.animationFrames() === adapter.animationFrames() };
};

for (const [name, trace] of Object.entries({
  connectableObservableTrace,
  connectableCompleteTrace,
  connectableErrorTrace,
  connectableSyncCompleteTrace,
  refCountOperatorTrace,
  refCountMethodTrace,
  multicastSubjectReuseTrace,
  multicastSelectorTrace,
  publishTrace,
  publishBehaviorTrace,
  publishLastTrace,
  publishReplayTrace,
  replayWindowTrace,
  shareReplayWindowTrace,
  publishReplayWindowTrace,
  joinAllTrace,
  schedulerFormsTrace,
  scheduledIterableErrorsTrace,
  delayWhenSubscriptionDelayTrace,
  schedulerFactoryTrace,
  virtualTimeOrderTrace,
  virtualTimeRescheduleTrace,
  virtualTimeLimitsTrace,
  virtualTimerTrace,
  virtualActionTrace,
})) {
  test(`M18 ${name} matches RxJS 7.8.2`, () => {
    assert.deepEqual(trace(adapters.pureFp), trace(adapters.rxjs));
  });
}

for (const [name, trace] of Object.entries({
  scheduledAsapOrderTrace,
  scheduledAsyncKindsTrace,
  scheduledIterableTeardownTrace,
  animationFrameBatchTrace,
  animationFrameRescheduleTrace,
  animationFrameCancelAndDelayTrace,
  animationFramesTrace,
})) {
  test(`M18 ${name} matches RxJS 7.8.2`, async () => {
    const expected = await trace(adapters.rxjs);
    const actual = await trace(adapters.pureFp);
    assert.deepEqual(actual, expected);
  });
}
