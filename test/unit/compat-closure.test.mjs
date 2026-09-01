import assert from 'node:assert/strict';
import test from 'node:test';

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
import { endWith, of, popScheduler, startWith } from '../../src/compat/scheduler-args.ts';
import { ReplaySubject } from '../../src/compat/subject.ts';
import {
  createConnectableObservable,
  multicast,
  refCount,
} from '../../src/kernel/connectable-observable.ts';
import { animationFrames } from '../../src/kernel/creation/animation-frames.ts';
import { empty } from '../../src/kernel/creation/empty.ts';
import { from } from '../../src/kernel/creation/from.ts';
import { range } from '../../src/kernel/creation/range.ts';
import { isObservable } from '../../src/kernel/interop.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { combineAll, combineLatestAll, zipAll } from '../../src/kernel/operators/join-all.ts';
import { take } from '../../src/kernel/operators/take.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { scheduled } from '../../src/kernel/scheduled.ts';
import {
  animationFrameScheduler,
  asapScheduler,
  createScheduler,
  dateTimestampProvider,
  isScheduler,
  queueScheduler,
} from '../../src/kernel/scheduler.ts';
import { shareReplay } from '../../src/kernel/sharing.ts';
import { createReplaySubject, createSubject } from '../../src/kernel/subject.ts';
import {
  createVirtualAction,
  createVirtualTimeScheduler,
  sortVirtualActions,
} from '../../src/kernel/virtual-time.ts';

const collect = (source) => {
  const events = [];
  subscribe({
    next: (value) => events.push({ next: value }),
    error: (error) => events.push({ error: error instanceof Error ? error.message : error }),
    complete: () => events.push('complete'),
  })(source);
  return events;
};

const cold = (log) => {
  let runs = 0;
  return createObservable((subscriber) => {
    runs += 1;
    log.push(`run:${runs}`);
    subscriber.next(runs);
    return () => log.push(`teardown:${runs}`);
  });
};

test('M18 ConnectableObservable is a branded callable record with connect/refCount', () => {
  const log = [];
  const shared = ConnectableObservable(cold(log), () => createSubject());
  assert.equal(isObservable(shared), true);
  assert.equal(typeof shared.connect, 'function');
  assert.equal(typeof shared.refCount, 'function');
  const seen = [];
  subscribe({ next: (value) => seen.push(value) })(shared);
  assert.deepEqual(log, []);
  const connection = shared.connect();
  assert.equal(shared.connect(), connection);
  assert.deepEqual(log, ['run:1']);
  assert.deepEqual(seen, [1]);
  connection.unsubscribe();
  assert.deepEqual(log, ['run:1', 'teardown:1']);
  assert.equal(createConnectableObservable(cold([]), () => createSubject()).connect().closed, false);
});

test('M18 refCount requires a connectable source and drives the connection by count', () => {
  assert.deepEqual(collect(refCount()(createObservable(() => undefined))), [
    { error: 'refCount() requires a ConnectableObservable source' },
  ]);
  const log = [];
  const shared = pipeValue(multicast(() => createSubject())(cold(log)), refCount());
  const one = subscribe({})(shared);
  const two = subscribe({})(shared);
  one.unsubscribe();
  assert.deepEqual(log, ['run:1']);
  two.unsubscribe();
  assert.deepEqual(log, ['run:1', 'teardown:1']);
});

test('M18 multicast tells a subject record from a factory by observer shape', () => {
  const subject = createSubject();
  const viaInstance = multicast(subject)(createObservable(() => undefined));
  const viaFactory = multicast(() => createSubject())(createObservable(() => undefined));
  assert.equal(typeof viaInstance.connect, 'function');
  assert.equal(typeof viaFactory.connect, 'function');
  const seen = [];
  subscribe({ next: (value) => seen.push(value) })(viaInstance);
  subject.next('through-the-instance');
  assert.deepEqual(seen, ['through-the-instance']);
});

test('M18 publish family produces connectables and selector forms', () => {
  const log = [];
  assert.equal(typeof publish()(cold(log)).connect, 'function');
  assert.equal(typeof publishBehavior(0)(cold(log)).connect, 'function');
  assert.equal(typeof publishLast()(cold(log)).connect, 'function');
  assert.equal(typeof publishReplay(1)(cold(log)).connect, 'function');
  assert.equal(typeof publish((shared) => shared)(cold(log)).connect, 'undefined');
  assert.equal(typeof publishReplay(1, undefined, (shared) => shared)(cold(log)).connect, 'undefined');
  assert.deepEqual(log, []);
});

test('M18 ReplaySubject time windows trim by the provider clock', () => {
  let now = 0;
  const clock = { now: () => now };
  const subject = ReplaySubject(Infinity, 100, clock);
  subject.next('a');
  now = 90;
  subject.next('b');
  now = 120;
  assert.deepEqual(collect(subject).map((event) => event.next), ['b']);
  const sized = createReplaySubject(1, 100, clock);
  sized.next(1);
  sized.next(2);
  assert.deepEqual(collect(sized).map((event) => event.next), [2]);
});

test('M18 shareReplay accepts the window config and the positional form', () => {
  let now = 0;
  const clock = { now: () => now };
  const log = [];
  const shared = shareReplay(1, 50, clock)(cold(log));
  subscribe({})(shared);
  now = 100;
  assert.deepEqual(collect(shared), []);
  const configured = shareReplay({ bufferSize: 1, windowTime: 50, scheduler: clock })(cold(log));
  subscribe({})(configured);
  assert.deepEqual(collect(configured).map((event) => event.next), [1]);
});

test('M18 scheduled iterables release the iterator on early teardown, queue scheduler included', () => {
  const log = [];
  function* gen() {
    try {
      yield 1;
      yield 2;
    } finally {
      log.push('finally');
    }
  }
  subscribe({ next: (value) => log.push(value), complete: () => log.push('complete') })(
    pipeValue(scheduled(gen(), queueScheduler), take(1))
  );
  assert.deepEqual(log, [1, 'complete', 'finally']);
});

test('M18 join-all operators are toArray + join algebra', () => {
  assert.equal(combineAll, combineLatestAll);
  assert.deepEqual(collect(combineLatestAll()(of(of(1, 2), of('x')))), [{ next: [2, 'x'] }, 'complete']);
  assert.deepEqual(collect(zipAll((a, b) => a + b)(of(of(1, 2), of(10, 20)))), [
    { next: 11 },
    { next: 22 },
    'complete',
  ]);
  assert.deepEqual(collect(zipAll()(of())), ['complete']);
});

test('M18 scheduled dispatches every ObservableInput kind through the scheduler', () => {
  const values = (source) => collect(source).map((event) => (typeof event === 'string' ? event : event.next));
  assert.deepEqual(values(scheduled([1, 2], queueScheduler)), [1, 2, 'complete']);
  assert.deepEqual(values(scheduled('ab', queueScheduler)), ['a', 'b', 'complete']);
  assert.deepEqual(values(scheduled(new Set([3]), queueScheduler)), [3, 'complete']);
  assert.deepEqual(values(scheduled(createObservable((s) => (s.next('o'), s.complete())), queueScheduler)), [
    'o',
    'complete',
  ]);
  assert.throws(() => scheduled(null, queueScheduler), /where a stream was expected/);
});

test('M18 deprecated scheduler arguments route through scheduled', () => {
  const values = (source) => collect(source).map((event) => (typeof event === 'string' ? event : event.next));
  assert.equal(popScheduler([1, 2]), undefined);
  assert.equal(popScheduler([1, queueScheduler]), queueScheduler);
  assert.deepEqual(values(of(1, 2, queueScheduler)), [1, 2, 'complete']);
  assert.deepEqual(values(from([1], queueScheduler)), [1, 'complete']);
  assert.deepEqual(values(range(5, 2, queueScheduler)), [5, 6, 'complete']);
  assert.deepEqual(values(empty(queueScheduler)), ['complete']);
  assert.deepEqual(values(startWith(0, queueScheduler)(of(1))), [0, 1, 'complete']);
  assert.deepEqual(values(endWith(9, queueScheduler)(of(1))), [1, 9, 'complete']);
  assert.deepEqual(values(concat(of(1), of(2), queueScheduler)), [1, 2, 'complete']);
  assert.deepEqual(values(merge(of(1), of(2), 1, queueScheduler)), [1, 2, 'complete']);
  assert.deepEqual(values(combineLatest(of(1), of(2), queueScheduler)), [[1, 2], 'complete']);
});

test('M18 Scheduler factory builds actions through the factory and carries the now static', () => {
  const log = [];
  const scheduler = Scheduler(
    (owner, work) => ({
      schedule: (state, delay) => {
        log.push([state, delay, owner.now()]);
        work(state);
        return { closed: true, unsubscribe() {}, add() {}, remove() {} };
      },
    }),
    () => 7
  );
  scheduler.schedule((state) => log.push(`work:${state}`), 3, 's');
  assert.deepEqual(log, [['s', 3, 7], 'work:s']);
  assert.equal(typeof Scheduler.now(), 'number');
  assert.equal(isScheduler(createScheduler(() => ({ schedule: () => undefined }))), true);
  assert.equal(createScheduler(() => ({ schedule: () => undefined })).now, dateTimestampProvider.now);
});

test('M18 virtual time runs queued work in (frame, index) order under flush', () => {
  const vts = createVirtualTimeScheduler();
  const log = [];
  vts.schedule(() => log.push(`b@${vts.now()}`), 20);
  vts.schedule(() => log.push(`a@${vts.now()}`), 10);
  vts.schedule(() => log.push(`a2@${vts.now()}`), 10);
  assert.equal(vts.frame, 0);
  assert.equal(vts.index, 2);
  vts.flush();
  assert.deepEqual(log, ['a@10', 'a2@10', 'b@20']);
  assert.equal(vts.frame, 20);
  const action = createVirtualAction(vts, () => undefined);
  assert.equal(action.schedule(undefined, Infinity).closed, true);
  assert.equal(VirtualTimeScheduler.frameTimeFactor, 10);
  assert.equal(VirtualAction.sortActions, sortVirtualActions);
  assert.equal(VirtualTimeScheduler(undefined, 5).maxFrames, 5);
  assert.throws(() => createVirtualAction(queueScheduler, () => undefined), TypeError);
});

test('M18 animationFrame scheduler and animationFrames ride the runtime frame edge', async () => {
  const previousRequest = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 1);
  globalThis.cancelAnimationFrame = (handle) => clearTimeout(handle);
  try {
    const log = [];
    animationFrameScheduler.schedule(() => log.push('a'));
    animationFrameScheduler.schedule(() => log.push('b'));
    log.push('sync');
    let t = 0;
    const frames = [];
    subscribe({ next: (frame) => frames.push(frame) })(pipeValue(animationFrames({ now: () => (t += 1) }), take(2)));
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.deepEqual(log, ['sync', 'a', 'b']);
    assert.deepEqual(frames, [
      { timestamp: 2, elapsed: 1 },
      { timestamp: 3, elapsed: 2 },
    ]);
    assert.equal(animationFrames(), animationFrames());
  } finally {
    globalThis.requestAnimationFrame = previousRequest;
    globalThis.cancelAnimationFrame = previousCancel;
  }
});

test('M18 asap batches close at flush start so mid-flush work runs in the next microtask', async () => {
  const log = [];
  asapScheduler.schedule(() => {
    log.push('a');
    asapScheduler.schedule(() => log.push('joined-later'));
  });
  asapScheduler.schedule(() => log.push('b'));
  Promise.resolve().then(() => log.push('microtask'));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(log, ['a', 'b', 'microtask', 'joined-later']);
});
