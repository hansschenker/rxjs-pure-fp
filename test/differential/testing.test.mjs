import assert from 'node:assert/strict';
import test from 'node:test';
import { isDeepStrictEqual } from 'node:util';

import {
  Observable as RxObservable,
  ReplaySubject as RxReplaySubject,
  VirtualAction as RxVirtualAction,
  animationFrameScheduler as rxAnimationFrame,
  animationFrames as rxAnimationFrames,
  asapScheduler as rxAsap,
  asyncScheduler as rxAsync,
  config as rxConfig,
  debounceTime as rxDebounceTime,
  delay as rxDelay,
  interval as rxInterval,
  map as rxMap,
  mergeMap as rxMergeMap,
  queueScheduler as rxQueue,
  take as rxTake,
  throttleTime as rxThrottleTime,
  timer as rxTimer,
  timestamp as rxTimestamp,
} from 'rxjs';
import { TestScheduler as RxTestScheduler } from 'rxjs/testing';
import { config } from '../../src/compat/config.ts';
import { subscribe } from '../../src/compat/observable.ts';
import { VirtualAction } from '../../src/compat/scheduler.ts';
import { animationFrames } from '../../src/kernel/creation/animation-frames.ts';
import { interval } from '../../src/kernel/creation/interval.ts';
import { timer } from '../../src/kernel/creation/timer.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { debounceTime } from '../../src/kernel/operators/debounce-time.ts';
import { delay } from '../../src/kernel/operators/delay.ts';
import { map } from '../../src/kernel/operators/map.ts';
import { mergeMap } from '../../src/kernel/operators/merge-map.ts';
import { take } from '../../src/kernel/operators/take.ts';
import { throttleTime } from '../../src/kernel/operators/throttle-time.ts';
import { timestamp } from '../../src/kernel/operators/timestamp.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { animationFrameScheduler, asapScheduler, asyncScheduler, queueScheduler } from '../../src/kernel/scheduler.ts';
import { createReplaySubject } from '../../src/kernel/subject.ts';
import { TestScheduler } from '../../src/testing/index.ts';

const adapters = {
  rxjs: {
    testScheduler: (assertDeepEqual) => new RxTestScheduler(assertDeepEqual),
    statics: RxTestScheduler,
    create: (initializer) => new RxObservable(initializer),
    subscribe: (observer) => (source) => source.subscribe(observer),
    apply: (source, ...operators) => source.pipe(...operators),
    virtualAction: (scheduler, work) => new RxVirtualAction(scheduler, work),
    replaySubject: (size, windowTime) => new RxReplaySubject(size, windowTime),
    config: rxConfig,
    map: rxMap,
    mergeMap: rxMergeMap,
    take: rxTake,
    delay: rxDelay,
    debounceTime: rxDebounceTime,
    throttleTime: rxThrottleTime,
    timestamp: rxTimestamp,
    interval: rxInterval,
    timer: rxTimer,
    animationFrames: rxAnimationFrames,
    animationFrame: rxAnimationFrame,
    asap: rxAsap,
    async: rxAsync,
    queue: rxQueue,
  },
  pureFp: {
    testScheduler: TestScheduler,
    statics: TestScheduler,
    create: createObservable,
    subscribe,
    apply: (source, ...operators) => pipeValue(source, ...operators),
    virtualAction: (scheduler, work) => VirtualAction(scheduler, work),
    replaySubject: (size, windowTime) => createReplaySubject(size, windowTime),
    config,
    map,
    mergeMap,
    take,
    delay,
    debounceTime,
    throttleTime,
    timestamp,
    interval,
    timer,
    animationFrames,
    animationFrame: animationFrameScheduler,
    asap: asapScheduler,
    async: asyncScheduler,
    queue: queueScheduler,
  },
};

// Both sides record `{ kind, value, error }` notifications and
// `{ subscribedFrame, unsubscribedFrame }` logs; RxJS's are class instances
// (prototype-strict under deepEqual), ours frozen records, so traces are
// flattened to plain data. Cold observables inside values are reduced to
// their messages; other functions/objects that are not data become a tag.
const isCold = (value) =>
  value !== null &&
  (typeof value === 'object' || typeof value === 'function') &&
  Array.isArray(value.messages) &&
  Array.isArray(value.subscriptions);

const plain = (value) => {
  if (Array.isArray(value)) return value.map(plain);
  if (value instanceof Error) return { error: value.message };
  if (isCold(value)) return { cold: plain(value.messages) };
  if (typeof value === 'function') return '[function]';
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).map((key) => [key, plain(value[key])]));
  }
  return value;
};

const attempt = (fn) => {
  try {
    return plain(fn());
  } catch (error) {
    return { thrown: error.message };
  }
};

/** A TestScheduler whose assertion records every (actual, expected) pair instead of asserting. */
const harness = (adapter) => {
  const log = [];
  const ts = adapter.testScheduler((actual, expected) => {
    log.push({ actual: plain(actual), expected: plain(expected) });
  });
  return { ts, log };
};

// --- Marble parsers -------------------------------------------------------

const parseMarblesTrace = (adapter) => {
  const { statics } = adapter;
  const { ts } = harness(adapter);
  const inner = ts.createColdObservable('x-y|');
  return [
    attempt(() => statics.parseMarbles('-a-b-|')),
    attempt(() => statics.parseMarbles('--(ab|)')),
    attempt(() => statics.parseMarbles('-a-^-b-|')),
    attempt(() => statics.parseMarbles('--#', undefined, new Error('bad'))),
    attempt(() => statics.parseMarbles('--#')),
    attempt(() => statics.parseMarbles('a b', { a: 1, b: 2 })),
    attempt(() => statics.parseMarbles('a b', { a: 1 })),
    attempt(() => statics.parseMarbles('a 10ms b 1s c 1m d', undefined, undefined, false, true)),
    attempt(() => statics.parseMarbles('  ^-a 5ms b|', undefined, undefined, false, true)),
    attempt(() => statics.parseMarbles('1.5s a', undefined, undefined, false, true)),
    attempt(() => statics.parseMarbles('10ms|', undefined, undefined, false, true)),
    attempt(() => statics.parseMarbles('-a-|', { a: inner }, undefined, true)),
    attempt(() => statics.parseMarbles('-a-|', { a: inner })),
    attempt(() => statics.parseMarbles('-a-!')),
    attempt(() => statics.parseMarbles('🙈-🙉|')),
    attempt(() => statics.parseMarbles('')),
  ];
};

const parseSubscriptionsTrace = (adapter) => {
  const { statics } = adapter;
  return [
    attempt(() => statics.parseMarblesAsSubscriptions('^')),
    attempt(() => statics.parseMarblesAsSubscriptions('--^--!')),
    attempt(() => statics.parseMarblesAsSubscriptions('(^!)')),
    attempt(() => statics.parseMarblesAsSubscriptions('--(^)--!')),
    attempt(() => statics.parseMarblesAsSubscriptions('---')),
    attempt(() => statics.parseMarblesAsSubscriptions('!--^')),
    attempt(() => statics.parseMarblesAsSubscriptions(null)),
    attempt(() => statics.parseMarblesAsSubscriptions('  ^ 10ms !', true)),
    attempt(() => statics.parseMarblesAsSubscriptions('5ms ^ 2s !', true)),
    attempt(() => statics.parseMarblesAsSubscriptions('--^--^')),
    attempt(() => statics.parseMarblesAsSubscriptions('!-!')),
    attempt(() => statics.parseMarblesAsSubscriptions('^-a')),
  ];
};

// --- Cold, hot, subscriptions ---------------------------------------------

const coldBasicTrace = (adapter) => {
  const { ts, log } = harness(adapter);
  const source = ts.createColdObservable('--a--b--|', { a: 1, b: 2 });
  ts.expectObservable(source).toBe('--a--b--|', { a: 1, b: 2 });
  ts.expectSubscriptions(source.subscriptions).toBe('^-------!');
  ts.flush();
  return { log, frame: ts.frame, subscriptions: plain(source.subscriptions), cold: ts.coldObservables.length };
};

const hotOffsetTrace = (adapter) => {
  const { ts, log } = harness(adapter);
  const source = ts.createHotObservable('-a-^-b-c-|');
  ts.expectObservable(source).toBe('--b-c-|');
  ts.expectObservable(source, '---^').toBe('----c-|');
  ts.expectSubscriptions(source.subscriptions).toBe(['^-----!', '---^--!']);
  ts.flush();
  return { log, frame: ts.frame, hotLeft: ts.hotObservables.length };
};

const unsubscribeMarblesTrace = (adapter) => {
  const { ts, log } = harness(adapter);
  const source = ts.createColdObservable('--a--b--c--|');
  ts.expectObservable(source, '^----!').toBe('--a--');
  ts.expectSubscriptions(source.subscriptions).toBe('^----!');
  const late = ts.createColdObservable('-x-y|');
  ts.expectObservable(late, '--^---!').toBe('---x-y');
  ts.expectSubscriptions(late.subscriptions).toBe('--^---!');
  ts.flush();
  return log;
};

const operatorsTrace = (adapter) => {
  const { ts, log } = harness(adapter);
  const inner1 = ts.createColdObservable('-x-y|');
  const inner2 = ts.createColdObservable('-z|');
  const outer = ts.createColdObservable('-a--b--|', { a: inner1, b: inner2 });
  const result = adapter.apply(
    outer,
    adapter.mergeMap((o) => o),
    adapter.map((v) => v.toUpperCase())
  );
  ts.expectObservable(result).toBe('--X-YZ-|');
  ts.expectSubscriptions(inner1.subscriptions).toBe('-^---!');
  ts.expectSubscriptions(inner2.subscriptions).toBe('----^-!');
  const taken = ts.createColdObservable('a-b-c-d|');
  ts.expectObservable(adapter.apply(taken, adapter.take(2))).toBe('a-(b|)');
  ts.expectSubscriptions(taken.subscriptions).toBe('^-!');
  ts.flush();
  return log;
};

const hotAsSubjectTrace = (adapter) => {
  const { ts, log } = harness(adapter);
  const source = ts.createHotObservable('--a|');
  const received = [];
  const subscription = adapter.subscribe({
    next: (value) => received.push(value),
    complete: () => received.push('C'),
  })(source);
  source.next('manual');
  subscription.unsubscribe();
  ts.expectObservable(source).toBe('--a|');
  ts.flush();
  return { received, subscriptions: plain(source.subscriptions), log };
};

// --- Run mode ---------------------------------------------------------------

const runModeTimeTrace = (adapter) => {
  const { ts, log } = harness(adapter);
  const returned = ts.run(({ cold, expectObservable, expectSubscriptions, time }) => {
    const t = time('---|');
    const delayed = adapter.apply(cold('a-b|'), adapter.delay(t));
    expectObservable(delayed).toBe('---a-(b|)');
    const debounced = adapter.apply(cold('a 5ms b 20ms c|'), adapter.debounceTime(10));
    expectObservable(debounced).toBe('16ms b 11ms (c|)');
    const ticks = adapter.apply(adapter.interval(3), adapter.take(3));
    expectObservable(ticks).toBe('---a--b--(c|)', { a: 0, b: 1, c: 2 });
    expectObservable(adapter.timer(4)).toBe('----(a|)', { a: 0 });
    const throttled = adapter.apply(cold('ab-c--d|'), adapter.throttleTime(2));
    expectObservable(throttled).toBe('a--c--d|');
    const source = cold('   -a 3ms b|');
    expectObservable(source, '  ^ 4ms !').toBe('-a 2ms ');
    expectSubscriptions(source.subscriptions).toBe('^ 4ms !');
    return t;
  });
  return { log, returned, frame: ts.frame };
};

const runModeSchedulerPriorityTrace = (adapter) => {
  const { ts } = harness(adapter);
  const order = [];
  ts.run(() => {
    adapter.async.schedule(() => order.push(`async0@${ts.frame}`), 0);
    adapter.asap.schedule(() => order.push(`asap@${ts.frame}`));
    adapter.queue.schedule(() => order.push(`queue@${ts.frame}`));
    adapter.async.schedule(() => order.push(`async2@${ts.frame}`), 2);
    adapter.asap.schedule(() => order.push(`asap-b@${ts.frame}`));
    adapter.async.schedule(() => {
      adapter.asap.schedule(() => order.push(`nested-asap@${ts.frame}`));
      order.push(`async1@${ts.frame}`);
    }, 1);
    order.push(`sync@${ts.frame}`);
  });
  return { order, frame: ts.frame, nowAfter: typeof adapter.async.now() };
};

const runModeIntervalCancelTrace = (adapter) => {
  const { ts, log } = harness(adapter);
  const seen = [];
  ts.run(({ expectObservable }) => {
    const subscription = adapter.subscribe({ next: (value) => seen.push(`${value}@${ts.frame}`) })(
      adapter.interval(2)
    );
    adapter.async.schedule(() => subscription.unsubscribe(), 7);
    expectObservable(adapter.apply(adapter.interval(4), adapter.take(2))).toBe('----a---(b|)', { a: 0, b: 1 });
  });
  return { seen, log, frame: ts.frame };
};

const animateTrace = (adapter) => {
  const { ts, log } = harness(adapter);
  const scheduled = [];
  ts.run(({ animate, expectObservable }) => {
    animate('    --x--x--x');
    const frames = adapter.apply(
      adapter.animationFrames(),
      adapter.map((frame) => frame.elapsed),
      adapter.take(2)
    );
    expectObservable(frames).toBe('--a--(b|)', { a: 2, b: 5 });
    adapter.animationFrame.schedule(() => scheduled.push(`first@${ts.frame}`));
    adapter.async.schedule(() => {
      adapter.animationFrame.schedule(() => scheduled.push(`second@${ts.frame}`));
    }, 3);
  });
  return { log, scheduled, frame: ts.frame };
};

const innerObservablesTrace = (adapter) => {
  const { ts, log } = harness(adapter);
  ts.run(({ cold, expectObservable }) => {
    const inner = cold('x-y|');
    const outer = cold('-a-|', { a: inner });
    expectObservable(outer).toBe('-a-|', { a: inner });
    const mapped = adapter.apply(
      cold('-a-b|'),
      adapter.map((value) => cold(`${value}|`))
    );
    expectObservable(mapped).toBe('-a-b|', { a: cold('a|'), b: cold('b|') });
    expectObservable(cold('--z|')).toEqual(cold('--z|'));
  });
  return log;
};

const errorMarbleTrace = (adapter) => {
  const { ts, log } = harness(adapter);
  const boom = new Error('boom');
  const source = ts.createColdObservable('--a--#', undefined, boom);
  ts.expectObservable(source).toBe('--a--#', undefined, boom);
  ts.expectSubscriptions(source.subscriptions).toBe('^----!');
  ts.expectObservable(ts.createColdObservable('-#')).toBe('-#');
  const throwing = adapter.apply(
    ts.createColdObservable('-a-b|'),
    adapter.map((value) => {
      if (value === 'b') throw boom;
      return value;
    })
  );
  ts.expectObservable(throwing).toBe('-a-#', undefined, boom);
  ts.flush();
  return log;
};

const unhandledErrorTrace = (adapter) => {
  const result = {};
  const first = harness(adapter);
  try {
    first.ts.run(({ cold }) => {
      adapter.subscribe({
        next: () => {
          throw new Error('consumer');
        },
      })(cold('a|'));
    });
    result.thrown = null;
  } catch (error) {
    result.thrown = error.message;
  }
  result.frameAfterThrow = first.ts.frame;
  result.factorRestored = adapter.statics.frameTimeFactor;

  const reported = [];
  adapter.config.onUnhandledError = (error) => reported.push(`${error.message}@${second.ts.frame}`);
  const second = harness(adapter);
  try {
    second.ts.run(({ cold }) => {
      adapter.subscribe({
        next: () => {
          throw new Error('handled');
        },
      })(cold('-a|'));
      reported.push('sync-end');
    });
  } finally {
    adapter.config.onUnhandledError = null;
  }
  result.reported = reported;
  return result;
};

const replayWindowTrace = (adapter) => {
  const { ts, log } = harness(adapter);
  ts.run(({ expectObservable }) => {
    const subject = adapter.replaySubject(Infinity, 3);
    subject.next('a');
    expectObservable(subject, '^ 2ms !').toBe('a');
    expectObservable(subject, '5ms ^').toBe('');
  });
  return log;
};

const timestampTrace = (adapter) => {
  const { ts, log } = harness(adapter);
  ts.run(({ cold, expectObservable }) => {
    const stamped = adapter.apply(cold('--a-b|'), adapter.timestamp());
    expectObservable(stamped).toBe('--a-b|', {
      a: { value: 'a', timestamp: 2 },
      b: { value: 'b', timestamp: 4 },
    });
  });
  return log;
};

// --- Scheduler surface ------------------------------------------------------

const frameTimeFactorTrace = (adapter) => {
  const { statics } = adapter;
  const { ts } = harness(adapter);
  const observed = {
    before: statics.frameTimeFactor,
    maxBefore: ts.maxFrames,
    timeBefore: ts.createTime('--|'),
    nowBefore: ts.now(),
    index: ts.index,
  };
  ts.run(({ time }) => {
    observed.inside = statics.frameTimeFactor;
    observed.maxInside = ts.maxFrames;
    observed.timeInside = time('  --|');
  });
  observed.after = statics.frameTimeFactor;
  observed.maxAfter = ts.maxFrames;
  observed.missing = attempt(() => ts.createTime('---'));
  observed.shape = ['now', 'schedule', 'flush', 'run', 'createTime', 'expectObservable', 'expectSubscriptions'].map(
    (name) => `${name}:${typeof ts[name]}`
  );
  return observed;
};

const directActionTrace = (adapter) => {
  const { ts } = harness(adapter);
  const executed = [];
  const action = adapter.virtualAction(ts, () => executed.push(`work@${ts.frame}`));
  action.schedule(undefined, 10);
  ts.schedule(() => executed.push(`scheduled@${ts.frame}`), 5);
  ts.flush();
  return { executed, closed: action.closed, frame: ts.frame };
};

const maxFramesCutoffTrace = (adapter) => {
  const { ts } = harness(adapter);
  const executed = [];
  ts.schedule(() => executed.push(ts.frame), 700);
  ts.schedule(() => executed.push(ts.frame), 800);
  ts.flush();
  return { executed, frame: ts.frame, maxFrames: ts.maxFrames };
};

const pendingExpectationTrace = (adapter) => {
  const { ts, log } = harness(adapter);
  const source = ts.createColdObservable('a|');
  const pending = ts.expectObservable(source);
  ts.flush();
  const afterFirstFlush = log.length;
  pending.toBe('a|');
  ts.flush();
  const arrayForm = harness(adapter);
  const second = arrayForm.ts.createColdObservable('-b|');
  arrayForm.ts.expectObservable(second).toBe('-b|');
  arrayForm.ts.expectSubscriptions(second.subscriptions).toBe(['---', '^-!']);
  arrayForm.ts.flush();
  return { log, afterFirstFlush, arrayLog: arrayForm.log };
};

const errorMessagesTrace = (adapter) => {
  const { ts } = harness(adapter);
  const fresh = () => harness(adapter).ts;
  const noAnimate = harness(adapter);
  noAnimate.ts.run(({ expectObservable }) => {
    expectObservable(adapter.animationFrames()).toBe(
      '#',
      undefined,
      new Error('animate() was not called within run()')
    );
  });
  return {
    coldCaret: attempt(() => ts.createColdObservable('^-a')),
    coldBang: attempt(() => ts.createColdObservable('-a!')),
    hotBang: attempt(() => ts.createHotObservable('-a!')),
    animateTwice: attempt(() =>
      fresh().run(({ animate }) => {
        animate('-x');
        animate('-x');
      })
    ),
    animateComplete: attempt(() => fresh().run(({ animate }) => animate('-x|'))),
    animateError: attempt(() => fresh().run(({ animate }) => animate('-#'))),
    noAnimate: noAnimate.log,
    factorAfterErrors: adapter.statics.frameTimeFactor,
  };
};

const traces = {
  parseMarblesTrace,
  parseSubscriptionsTrace,
  coldBasicTrace,
  hotOffsetTrace,
  unsubscribeMarblesTrace,
  operatorsTrace,
  hotAsSubjectTrace,
  runModeTimeTrace,
  runModeSchedulerPriorityTrace,
  runModeIntervalCancelTrace,
  animateTrace,
  innerObservablesTrace,
  errorMarbleTrace,
  unhandledErrorTrace,
  replayWindowTrace,
  timestampTrace,
  frameTimeFactorTrace,
  directActionTrace,
  maxFramesCutoffTrace,
  pendingExpectationTrace,
  errorMessagesTrace,
};

// Every recorded expectation in a trace must also hold on its own side:
// the marble diagrams above are correct, not merely identical on both sides.
const recordedPairs = (value, into = []) => {
  if (Array.isArray(value)) {
    for (const item of value) recordedPairs(item, into);
  } else if (value !== null && typeof value === 'object') {
    if ('actual' in value && 'expected' in value && Object.keys(value).length === 2) {
      into.push(value);
    } else {
      for (const item of Object.values(value)) recordedPairs(item, into);
    }
  }
  return into;
};

for (const [name, trace] of Object.entries(traces)) {
  test(`M21 ${name} matches RxJS 7.8.2`, () => {
    const expected = trace(adapters.rxjs);
    const actual = trace(adapters.pureFp);
    assert.deepEqual(actual, expected);
    for (const pair of recordedPairs(actual)) {
      assert.ok(isDeepStrictEqual(pair.actual, pair.expected), `expectation holds: ${JSON.stringify(pair)}`);
    }
  });
}
