import assert from 'node:assert/strict';
import test from 'node:test';

import { config, configEnv } from '../../src/compat/config.ts';
import { subscribe } from '../../src/compat/observable.ts';
import { VirtualAction } from '../../src/compat/scheduler.ts';
import { animationFrames } from '../../src/kernel/creation/animation-frames.ts';
import { interval } from '../../src/kernel/creation/interval.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { delay } from '../../src/kernel/operators/delay.ts';
import { map } from '../../src/kernel/operators/map.ts';
import { take } from '../../src/kernel/operators/take.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { defaultEnv, installTimerHostDelegate, timerHost } from '../../src/kernel/runtime.ts';
import { asapScheduler, asyncScheduler } from '../../src/kernel/scheduler.ts';
import { createVirtualTimeScheduler, virtualTimeProtocol } from '../../src/kernel/virtual-time.ts';
import { isColdObservable } from '../../src/testing/cold-observable.ts';
import { TestScheduler } from '../../src/testing/index.ts';

const notification = (kind, value, error) => ({ kind, value, error });
const message = (frame, kind, value, error) => ({ frame, notification: notification(kind, value, error) });

/** A scheduler whose assertion records pairs; `strict()` asserts them all with Node's deep equality. */
const recording = () => {
  const pairs = [];
  const ts = TestScheduler((actual, expected) => {
    pairs.push({ actual, expected });
  });
  const strict = () => {
    for (const { actual, expected } of pairs) assert.deepEqual(actual, expected);
    return pairs.length;
  };
  return { ts, pairs, strict };
};

// --- Parsers ----------------------------------------------------------------

test('M21 parseMarbles produces RxJS-shaped test messages', () => {
  assert.deepEqual(TestScheduler.parseMarbles('-a-b-|'), [
    message(10, 'N', 'a', undefined),
    message(30, 'N', 'b', undefined),
    message(50, 'C', undefined, undefined),
  ]);
  assert.deepEqual(TestScheduler.parseMarbles('--(ab|)', { a: 1, b: 2 }), [
    message(20, 'N', 1, undefined),
    message(20, 'N', 2, undefined),
    message(20, 'C', undefined, undefined),
  ]);
  assert.deepEqual(TestScheduler.parseMarbles('-a-^-b#', undefined, 'bad'), [
    message(-20, 'N', 'a', undefined),
    message(20, 'N', 'b', undefined),
    message(30, 'E', undefined, 'bad'),
  ]);
  assert.deepEqual(TestScheduler.parseMarbles('#'), [message(0, 'E', undefined, 'error')]);
  assert.throws(() => TestScheduler.parseMarbles('-!'), {
    message: 'conventional marble diagrams cannot have the unsubscription marker "!"',
  });
  assert.ok(Object.isFrozen(TestScheduler.parseMarbles('a')[0]));
  assert.ok(Object.isFrozen(TestScheduler.parseMarbles('a')[0].notification));
});

test('M21 parseMarbles in run mode ignores whitespace and reads time progression', () => {
  assert.deepEqual(TestScheduler.parseMarbles('  a 10ms b 1s c|', undefined, undefined, false, true), [
    message(0, 'N', 'a', undefined),
    message(20, 'N', 'b', undefined),
    message(1030, 'N', 'c', undefined),
    message(1040, 'C', undefined, undefined),
  ]);
  // A progression must follow a space (or open the diagram): `a10ms` is four values.
  assert.equal(TestScheduler.parseMarbles('a10ms', undefined, undefined, false, true).length, 5);
});

test('M21 parseMarblesAsSubscriptions returns frozen subscription logs', () => {
  assert.deepEqual(TestScheduler.parseMarblesAsSubscriptions('--^--!'), {
    subscribedFrame: 20,
    unsubscribedFrame: 50,
  });
  assert.deepEqual(TestScheduler.parseMarblesAsSubscriptions('(^!)'), { subscribedFrame: 0, unsubscribedFrame: 0 });
  assert.deepEqual(TestScheduler.parseMarblesAsSubscriptions(null), {
    subscribedFrame: Infinity,
    unsubscribedFrame: Infinity,
  });
  // Outside `run`, the factor is still 10: `^` spans one frame (10) and `5ms` five.
  assert.deepEqual(TestScheduler.parseMarblesAsSubscriptions('^ 5ms !', true), {
    subscribedFrame: 0,
    unsubscribedFrame: 15,
  });
  assert.ok(Object.isFrozen(TestScheduler.parseMarblesAsSubscriptions('^')));
  assert.throws(() => TestScheduler.parseMarblesAsSubscriptions('^^'), /second subscription point/);
  assert.throws(() => TestScheduler.parseMarblesAsSubscriptions('!!'), /second unsubscription point/);
  assert.throws(() => TestScheduler.parseMarblesAsSubscriptions('^a'), /Found instead 'a'/);
});

// --- Records ------------------------------------------------------------------

test('M21 TestScheduler is a frozen virtual-time record with the RxJS members', () => {
  const ts = TestScheduler(() => true);
  assert.ok(Object.isFrozen(ts));
  assert.equal(typeof TestScheduler, 'function');
  assert.equal(TestScheduler.frameTimeFactor, 10);
  assert.equal(ts.frame, 0);
  assert.equal(ts.index, -1);
  assert.equal(ts.maxFrames, 750);
  assert.equal(ts.now(), 0);
  for (const member of [
    'schedule',
    'flush',
    'run',
    'createTime',
    'createColdObservable',
    'createHotObservable',
    'expectObservable',
    'expectSubscriptions',
    'assertDeepEqual',
  ]) {
    assert.equal(typeof ts[member], 'function', member);
  }
  assert.deepEqual(ts.hotObservables, []);
  assert.deepEqual(ts.coldObservables, []);
  assert.equal(ts.createTime('---|'), 30);
  assert.throws(() => ts.createTime('---'), /completion marker/);
});

test('M21 cold observables are branded observable functions carrying messages and logs', () => {
  const ts = TestScheduler(() => true);
  const cold = ts.createColdObservable('-a|');
  assert.equal(typeof cold, 'function');
  assert.ok(isColdObservable(cold));
  assert.ok(!isColdObservable(createObservable(() => undefined)));
  assert.deepEqual(cold.messages, [message(10, 'N', 'a', undefined), message(20, 'C', undefined, undefined)]);
  assert.equal(cold.scheduler, ts);
  assert.equal(ts.coldObservables[0], cold);
  const events = [];
  const subscription = subscribe({ next: (v) => events.push(v), complete: () => events.push('C') })(cold);
  assert.deepEqual(cold.subscriptions, [{ subscribedFrame: 0, unsubscribedFrame: Infinity }]);
  ts.flush();
  assert.deepEqual(events, ['a', 'C']);
  assert.ok(subscription.closed);
  assert.deepEqual(cold.subscriptions, [{ subscribedFrame: 0, unsubscribedFrame: 20 }]);
  assert.throws(() => ts.createColdObservable('^a'), /subscription offset/);
  assert.throws(() => ts.createColdObservable('a!'), /unsubscription marker/);
});

test('M21 hot observables are logged subjects whose messages flush regardless of subscribers', () => {
  const ts = TestScheduler(() => true);
  const hot = ts.createHotObservable('-a-^-b|');
  assert.equal(typeof hot.next, 'function');
  assert.equal(ts.hotObservables[0], hot);
  const early = [];
  subscribe({ next: (v) => early.push(v), complete: () => early.push('C') })(hot);
  hot.next('manual');
  ts.schedule(() => {
    subscribe({ next: (v) => early.push(`late:${v}`), complete: () => early.push('late:C') })(hot);
  }, 10);
  ts.flush();
  // A subscriber attached by hand before the flush sees the pre-`^` value at frame -20;
  // `expectObservable` subscribes through a scheduled action at frame 0 and would not.
  assert.deepEqual(early, ['manual', 'a', 'b', 'late:b', 'C', 'late:C']);
  assert.deepEqual(hot.subscriptions, [
    { subscribedFrame: 0, unsubscribedFrame: 30 },
    { subscribedFrame: 10, unsubscribedFrame: 30 },
  ]);
  assert.deepEqual(ts.hotObservables, []);
  assert.throws(() => ts.createHotObservable('a!'), /unsubscription marker/);
});

// --- Expectations --------------------------------------------------------------

test('M21 expectObservable and expectSubscriptions assert on flush', () => {
  const { ts, pairs, strict } = recording();
  const source = ts.createColdObservable('--a--b--|');
  const expectation = ts.expectObservable(pipeValue(source, map((v) => v.toUpperCase())), '^------!');
  ts.expectSubscriptions(source.subscriptions).toBe('^------!');
  ts.flush();
  assert.equal(pairs.length, 1, 'an expectation without toBe stays pending');
  expectation.toBe('--A--B--');
  ts.flush();
  assert.equal(strict(), 2);
  assert.deepEqual(pairs[1].actual, [message(20, 'N', 'A', undefined), message(50, 'N', 'B', undefined)]);
});

test('M21 a failing expectation reaches the assertion function', () => {
  const ts = TestScheduler((actual, expected) => assert.deepEqual(actual, expected));
  ts.expectObservable(ts.createColdObservable('-a|')).toBe('-b|');
  assert.throws(() => ts.flush(), assert.AssertionError);
});

test('M21 observables emitted as values are materialized relative to their frame', () => {
  const { ts, strict } = recording();
  const inner = ts.createColdObservable('x-|');
  ts.expectObservable(ts.createColdObservable('--a|', { a: inner })).toBe('--a|', { a: inner });
  ts.expectObservable(ts.createColdObservable('-b|')).toEqual(ts.createColdObservable('-b|'));
  ts.flush();
  assert.equal(strict(), 2);
});

// --- Run mode ----------------------------------------------------------------------

test('M21 run mode sets the frame factor to 1, lifts maxFrames, and restores both', () => {
  const { ts, strict } = recording();
  const returned = ts.run(({ cold, expectObservable, time }) => {
    assert.equal(TestScheduler.frameTimeFactor, 1);
    assert.equal(ts.maxFrames, Infinity);
    expectObservable(pipeValue(cold('a 800ms b|'), delay(time('--|')))).toBe('2ms a 800ms (b|)');
    return 'done';
  });
  assert.equal(returned, 'done');
  assert.equal(TestScheduler.frameTimeFactor, 10);
  assert.equal(ts.maxFrames, 750);
  assert.equal(ts.frame, 803);
  assert.equal(strict(), 1);
});

test('M21 run mode virtualizes the async, asap, and frame edges and releases them afterwards', async () => {
  const { ts } = recording();
  const order = [];
  ts.run(({ animate }) => {
    animate('---x');
    asyncScheduler.schedule(() => order.push(`async@${ts.frame}`), 0);
    asapScheduler.schedule(() => order.push(`asap@${ts.frame}`));
    subscribe({ next: (frame) => order.push(`frame@${frame.elapsed}`) })(pipeValue(animationFrames(), take(1)));
    subscribe({ next: (n) => order.push(`tick${n}@${ts.frame}`) })(pipeValue(interval(2), take(2)));
    assert.equal(asyncScheduler.now(), 0);
  });
  assert.deepEqual(order, ['asap@0', 'async@0', 'tick0@2', 'frame@3', 'tick1@4']);

  // Real timers again after the run.
  const real = await new Promise((resolve) => {
    asyncScheduler.schedule(() => resolve('real'), 1);
  });
  assert.equal(real, 'real');
  assert.ok(asyncScheduler.now() > 1000);
});

test('M21 run mode surfaces unhandled consumer errors and routes them to config.onUnhandledError', () => {
  const { ts } = recording();
  assert.throws(
    () =>
      ts.run(({ cold }) => {
        subscribe({
          next: () => {
            throw new Error('consumer');
          },
        })(cold('a|'));
      }),
    /consumer/
  );
  assert.equal(TestScheduler.frameTimeFactor, 10, 'restored after the throw');

  const reported = [];
  config.onUnhandledError = (error) => reported.push(error.message);
  try {
    recording().ts.run(({ cold }) => {
      subscribe({
        next: () => {
          throw new Error('handled');
        },
      })(cold('a|'));
      reported.push('sync');
    });
  } finally {
    config.onUnhandledError = null;
  }
  assert.deepEqual(reported, ['sync', 'handled']);
});

test('M21 animate is run-mode only and single-use', () => {
  const { ts } = recording();
  assert.throws(() => ts.run(({ animate }) => (animate('-x'), animate('-x'))), /more than once/);
  assert.throws(() => ts.run(({ animate }) => animate('-x|')), /must not complete or error/);
  assert.throws(() => ts.run(() => timerHost.requestFrame(() => {})), /animate\(\) was not called within run\(\)/);
});

// --- Kernel seams -----------------------------------------------------------------

test('M21 installTimerHostDelegate routes the host edge and uninstalls cleanly', () => {
  const calls = [];
  installTimerHostDelegate({
    now: () => 42,
    performanceNow: () => 43,
    interval: (handler, delayMillis) => (calls.push(`interval:${delayMillis}`), 7),
    cancelInterval: (id) => calls.push(`cancel:${id}`),
    microtask: () => calls.push('microtask'),
    timeout: () => calls.push('timeout'),
    requestFrame: () => (calls.push('frame'), 9),
    cancelFrame: (handle) => calls.push(`cancelFrame:${handle}`),
  });
  try {
    assert.equal(timerHost.now(), 42);
    assert.equal(timerHost.performanceNow(), 43);
    assert.equal(timerHost.interval(() => {}, 5), 7);
    timerHost.cancelInterval(7);
    timerHost.microtask(() => {});
    defaultEnv.defer(() => {});
    configEnv.defer(() => {});
    assert.equal(timerHost.requestFrame(() => {}), 9);
    timerHost.cancelFrame(9);
  } finally {
    installTimerHostDelegate(undefined);
  }
  assert.deepEqual(calls, ['interval:5', 'cancel:7', 'microtask', 'timeout', 'timeout', 'frame', 'cancelFrame:9']);
  assert.ok(timerHost.now() > 1000);
});

test('M21 virtual time takes a live maxFrames policy and exposes its queue protocol', () => {
  let budget = 10;
  const scheduler = createVirtualTimeScheduler({ maxFrames: () => budget });
  const executed = [];
  scheduler.schedule(() => executed.push(scheduler.frame), 5);
  scheduler.schedule(() => executed.push(scheduler.frame), 20);
  assert.equal(scheduler.maxFrames, 10);
  scheduler.flush();
  assert.deepEqual(executed, [5]);
  budget = Infinity;
  assert.equal(scheduler.maxFrames, Infinity);
  scheduler.flush();
  assert.deepEqual(executed, [5, 20]);

  const composed = Object.freeze({ now: scheduler.now, schedule: scheduler.schedule, ...virtualTimeProtocol(scheduler) });
  const action = VirtualAction(composed, () => executed.push(`direct@${scheduler.frame}`));
  action.schedule(undefined, 3);
  scheduler.flush();
  assert.deepEqual(executed, [5, 20, 'direct@23']);
  assert.throws(() => VirtualAction({ now: () => 0, schedule: () => undefined }, () => {}), TypeError);
});
