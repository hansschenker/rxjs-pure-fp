import assert from 'node:assert/strict';
import test from 'node:test';

import { subscribe } from '../../src/compat/observable.ts';
import {
  every as everyCompat,
  find as findCompat,
  findIndex as findIndexCompat,
  groupBy as groupByCompat,
  partition as partitionCompat,
} from '../../src/compat/collection.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { partition } from '../../src/kernel/creation/partition.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { buffer } from '../../src/kernel/operators/buffer.ts';
import { bufferCount } from '../../src/kernel/operators/buffer-count.ts';
import { bufferTime } from '../../src/kernel/operators/buffer-time.ts';
import { bufferToggle } from '../../src/kernel/operators/buffer-toggle.ts';
import { bufferWhen } from '../../src/kernel/operators/buffer-when.ts';
import { count } from '../../src/kernel/operators/count.ts';
import { every } from '../../src/kernel/operators/every.ts';
import { find, findIndex } from '../../src/kernel/operators/find.ts';
import { groupBy } from '../../src/kernel/operators/group-by.ts';
import { max } from '../../src/kernel/operators/max.ts';
import { min } from '../../src/kernel/operators/min.ts';
import { window } from '../../src/kernel/operators/window.ts';
import { windowCount } from '../../src/kernel/operators/window-count.ts';
import { windowToggle } from '../../src/kernel/operators/window-toggle.ts';
import { windowWhen } from '../../src/kernel/operators/window-when.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { createReplaySubject, createSubject } from '../../src/kernel/subject.ts';

const collect = (source) => {
  const events = [];
  subscribe({
    next: (value) => events.push({ type: 'next', value }),
    error: (error) => events.push({ type: 'error', message: error.message }),
    complete: () => events.push({ type: 'complete' }),
  })(source);
  return events;
};

/** Collects a higher-order trace: inner observables are subscribed as they open. */
const collectWindows = (source) => {
  const trace = [];
  let index = 0;
  const subscription = subscribe({
    next: (inner) => {
      const id = index++;
      trace.push(`open:${id}`);
      subscribe({
        next: (value) => trace.push(`w${id}:${JSON.stringify(value)}`),
        error: (error) => trace.push(`w${id}:error:${error.message}`),
        complete: () => trace.push(`w${id}:complete`),
      })(inner);
    },
    error: (error) => trace.push(`error:${error.message}`),
    complete: () => trace.push('complete'),
  })(source);
  return { trace, subscription };
};

test('M15 count counts all values and predicate matches', () => {
  assert.deepEqual(collect(pipeValue(of(1, 2, 3, 4), count())), [
    { type: 'next', value: 4 },
    { type: 'complete' },
  ]);
  assert.deepEqual(collect(pipeValue(of(1, 2, 3, 4), count((value) => value % 2 === 0))), [
    { type: 'next', value: 2 },
    { type: 'complete' },
  ]);
  assert.deepEqual(collect(pipeValue(of(), count())), [
    { type: 'next', value: 0 },
    { type: 'complete' },
  ]);
});

test('M15 max and min use native ordering or the comparer; empty completes silently', () => {
  assert.deepEqual(collect(pipeValue(of(3, 1, 4, 1, 5), max())), [
    { type: 'next', value: 5 },
    { type: 'complete' },
  ]);
  assert.deepEqual(collect(pipeValue(of(3, 1, 4, 1, 5), min())), [
    { type: 'next', value: 1 },
    { type: 'complete' },
  ]);
  const byLength = (x, y) => x.length - y.length;
  assert.deepEqual(collect(pipeValue(of('aa', 'a', 'aaa'), max(byLength))), [
    { type: 'next', value: 'aaa' },
    { type: 'complete' },
  ]);
  assert.deepEqual(collect(pipeValue(of('aa', 'a', 'aaa'), min(byLength))), [
    { type: 'next', value: 'a' },
    { type: 'complete' },
  ]);
  assert.deepEqual(collect(pipeValue(of(), max())), [{ type: 'complete' }]);
});

test('M15 every short-circuits on the first failure and passes empty sources', () => {
  const source = createSubject();
  const events = collect(pipeValue(source, every((value) => value < 3)));
  source.next(1);
  source.next(3);
  source.next(5);
  assert.deepEqual(events, [
    { type: 'next', value: false },
    { type: 'complete' },
  ]);
  assert.deepEqual(collect(pipeValue(of(1, 2), every((value) => value < 3))), [
    { type: 'next', value: true },
    { type: 'complete' },
  ]);
  assert.deepEqual(collect(pipeValue(of(), every(() => false))), [
    { type: 'next', value: true },
    { type: 'complete' },
  ]);
});

test('M15 every predicate receives value, index, and the source observable', () => {
  const seen = [];
  const source = of('a', 'b');
  collect(
    pipeValue(
      source,
      every((value, index, observed) => {
        seen.push([value, index, observed === source]);
        return true;
      })
    )
  );
  assert.deepEqual(seen, [
    ['a', 0, true],
    ['b', 1, true],
  ]);
});

test('M15 find emits the first match then completes; a miss emits undefined', () => {
  const source = createSubject();
  const events = collect(pipeValue(source, find((value) => value > 1)));
  source.next(1);
  source.next(2);
  source.next(3);
  assert.deepEqual(events, [
    { type: 'next', value: 2 },
    { type: 'complete' },
  ]);
  assert.deepEqual(collect(pipeValue(of(1), find((value) => value > 9))), [
    { type: 'next', value: undefined },
    { type: 'complete' },
  ]);
});

test('M15 findIndex emits the matching index or -1', () => {
  assert.deepEqual(collect(pipeValue(of('a', 'b', 'c'), findIndex((value) => value === 'b'))), [
    { type: 'next', value: 1 },
    { type: 'complete' },
  ]);
  assert.deepEqual(collect(pipeValue(of('a'), findIndex((value) => value === 'z'))), [
    { type: 'next', value: -1 },
    { type: 'complete' },
  ]);
});

test('M15 compat every/find/findIndex/partition bind the deprecated thisArg', () => {
  const context = { limit: 3 };
  function belowLimit(value) {
    return value < this.limit;
  }
  assert.deepEqual(collect(pipeValue(of(1, 2), everyCompat(belowLimit, context))), [
    { type: 'next', value: true },
    { type: 'complete' },
  ]);
  function atLeastLimit(value) {
    return value >= this.limit;
  }
  assert.deepEqual(collect(pipeValue(of(1, 4), findCompat(atLeastLimit, context))), [
    { type: 'next', value: 4 },
    { type: 'complete' },
  ]);
  assert.deepEqual(collect(pipeValue(of(1, 4), findIndexCompat(atLeastLimit, context))), [
    { type: 'next', value: 1 },
    { type: 'complete' },
  ]);
  const [pass, fail] = partitionCompat(of(1, 2, 3, 4), belowLimit, context);
  assert.deepEqual(
    collect(pass).map((event) => event.value),
    [1, 2, undefined]
  );
  assert.deepEqual(
    collect(fail).map((event) => event.value),
    [3, 4, undefined]
  );
});

test('M15 partition splits one source into matching and rest halves', () => {
  const [evens, odds] = partition(of(1, 2, 3, 4, 5), (value) => value % 2 === 0);
  assert.deepEqual(collect(evens), [
    { type: 'next', value: 2 },
    { type: 'next', value: 4 },
    { type: 'complete' },
  ]);
  assert.deepEqual(collect(odds), [
    { type: 'next', value: 1 },
    { type: 'next', value: 3 },
    { type: 'next', value: 5 },
    { type: 'complete' },
  ]);
});

test('M15 partition halves own independent source executions', () => {
  let executions = 0;
  const source = createObservable((subscriber) => {
    executions += 1;
    subscriber.next(executions);
    subscriber.complete();
    return undefined;
  });
  const [pass] = partition(source, () => true);
  collect(pass);
  collect(pass);
  assert.equal(executions, 2);
});

test('M15 buffer emits on notifier fire and flushes the rest on completion', () => {
  const source = createSubject();
  const notifier = createSubject();
  const events = collect(pipeValue(source, buffer(notifier)));
  source.next(1);
  source.next(2);
  notifier.next('go');
  source.next(3);
  notifier.next('go');
  notifier.next('go');
  source.next(4);
  source.complete();
  assert.deepEqual(
    events.map((event) => (event.type === 'next' ? event.value : event.type)),
    [[1, 2], [3], [], [4], 'complete']
  );
});

test('M15 buffer swallows notifier completion', () => {
  const source = createSubject();
  const notifier = createSubject();
  const events = collect(pipeValue(source, buffer(notifier)));
  notifier.complete();
  source.next(1);
  source.complete();
  assert.deepEqual(
    events.map((event) => (event.type === 'next' ? event.value : event.type)),
    [[1], 'complete']
  );
});

test('M15 bufferCount emits full buffers and flushes the remainder', () => {
  assert.deepEqual(
    collect(pipeValue(of(1, 2, 3, 4, 5), bufferCount(2))).map((event) =>
      event.type === 'next' ? event.value : event.type
    ),
    [[1, 2], [3, 4], [5], 'complete']
  );
});

test('M15 bufferCount overlaps and skips via startBufferEvery', () => {
  assert.deepEqual(
    collect(pipeValue(of(1, 2, 3, 4, 5), bufferCount(3, 1))).map((event) =>
      event.type === 'next' ? event.value : event.type
    ),
    [[1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5], [5], 'complete']
  );
  assert.deepEqual(
    collect(pipeValue(of(1, 2, 3, 4, 5, 6, 7), bufferCount(2, 3))).map((event) =>
      event.type === 'next' ? event.value : event.type
    ),
    [[1, 2], [4, 5], [7], 'complete']
  );
});

test('M15 bufferTime maxBufferSize emits synchronously filled buffers', () => {
  const source = createSubject();
  const events = collect(pipeValue(source, bufferTime(5000, null, 2)));
  source.next(1);
  source.next(2);
  source.next(3);
  source.next(4);
  source.next(5);
  source.complete();
  assert.deepEqual(
    events.map((event) => (event.type === 'next' ? event.value : event.type)),
    [[1, 2], [3, 4], [5], 'complete']
  );
});

test('M15 bufferToggle overlapping toggles collect independently', () => {
  const source = createSubject();
  const openings = createSubject();
  const closeA = createSubject();
  const closeB = createSubject();
  const closers = { a: closeA, b: closeB };
  const events = collect(pipeValue(source, bufferToggle(openings, (key) => closers[key])));
  openings.next('a');
  source.next(1);
  openings.next('b');
  source.next(2);
  closeA.next('done');
  source.next(3);
  closeB.next('done');
  source.next(4);
  source.complete();
  assert.deepEqual(
    events.map((event) => (event.type === 'next' ? event.value : event.type)),
    [[1, 2], [2, 3], 'complete']
  );
});

test('M15 bufferWhen cycles buffers through the closing selector', () => {
  const source = createSubject();
  const closings = [];
  const events = collect(
    pipeValue(
      source,
      bufferWhen(() => {
        const closing = createSubject();
        closings.push(closing);
        return closing;
      })
    )
  );
  source.next(1);
  source.next(2);
  closings[0].next('close');
  source.next(3);
  source.complete();
  assert.deepEqual(
    events.map((event) => (event.type === 'next' ? event.value : event.type)),
    [[1, 2], [3], 'complete']
  );
  assert.equal(closings.length, 2);
});

test('M15 window opens immediately and rolls on each boundary', () => {
  const source = createSubject();
  const boundaries = createSubject();
  const { trace } = collectWindows(pipeValue(source, window(boundaries)));
  source.next(1);
  boundaries.next('cut');
  source.next(2);
  source.next(3);
  source.complete();
  assert.deepEqual(trace, [
    'open:0',
    'w0:1',
    'w0:complete',
    'open:1',
    'w1:2',
    'w1:3',
    'w1:complete',
    'complete',
  ]);
});

test('M15 window fans a source error into the open window before the result', () => {
  const source = createSubject();
  const boundaries = createSubject();
  const { trace } = collectWindows(pipeValue(source, window(boundaries)));
  source.next(1);
  source.error(new Error('boom'));
  assert.deepEqual(trace, ['open:0', 'w0:1', 'w0:error:boom', 'error:boom']);
});

test('M15 windowCount overlapping windows shift out in opening order', () => {
  const { trace } = collectWindows(pipeValue(of(1, 2, 3, 4), windowCount(3, 1)));
  assert.deepEqual(trace, [
    'open:0',
    'w0:1',
    'open:1',
    'w0:2',
    'w1:2',
    'open:2',
    'w0:3',
    'w1:3',
    'w2:3',
    'w0:complete',
    'open:3',
    'w1:4',
    'w2:4',
    'w3:4',
    'w1:complete',
    'open:4',
    'w2:complete',
    'w3:complete',
    'w4:complete',
    'complete',
  ]);
});

test('M15 windowToggle closes only the toggled window', () => {
  const source = createSubject();
  const openings = createSubject();
  const closeA = createSubject();
  const closeB = createSubject();
  const closers = { a: closeA, b: closeB };
  const { trace } = collectWindows(pipeValue(source, windowToggle(openings, (key) => closers[key])));
  openings.next('a');
  source.next(1);
  openings.next('b');
  source.next(2);
  closeA.next('done');
  source.next(3);
  source.complete();
  assert.deepEqual(trace, [
    'open:0',
    'w0:1',
    'open:1',
    'w0:2',
    'w1:2',
    'w0:complete',
    'w1:3',
    'w1:complete',
    'complete',
  ]);
});

test('M15 windowWhen reopens on notifier emission and completion', () => {
  const source = createSubject();
  const closings = [];
  const { trace } = collectWindows(
    pipeValue(
      source,
      windowWhen(() => {
        const closing = createSubject();
        closings.push(closing);
        return closing;
      })
    )
  );
  source.next(1);
  closings[0].next('cut');
  source.next(2);
  closings[1].complete();
  source.next(3);
  source.complete();
  assert.deepEqual(trace, [
    'open:0',
    'w0:1',
    'w0:complete',
    'open:1',
    'w1:2',
    'w1:complete',
    'open:2',
    'w2:3',
    'w2:complete',
    'complete',
  ]);
});

test('M15 groupBy demultiplexes by key and stamps the key on each group', () => {
  const keys = [];
  const trace = [];
  subscribe({
    next: (group) => {
      keys.push(group.key);
      subscribe({
        next: (value) => trace.push(`${group.key}:${value}`),
        complete: () => trace.push(`${group.key}:complete`),
      })(group);
    },
    complete: () => trace.push('complete'),
  })(pipeValue(of(1, 2, 3, 4, 5), groupBy((value) => (value % 2 === 0 ? 'even' : 'odd'))));
  assert.deepEqual(keys, ['odd', 'even']);
  assert.deepEqual(trace, [
    'odd:1',
    'even:2',
    'odd:3',
    'even:4',
    'odd:5',
    'odd:complete',
    'even:complete',
    'complete',
  ]);
});

test('M15 groupBy element selector maps values delivered to groups', () => {
  const trace = [];
  subscribe({
    next: (group) => {
      subscribe({ next: (value) => trace.push(`${group.key}:${value}`) })(group);
    },
  })(
    pipeValue(
      of('alpha', 'beta', 'avocado'),
      groupBy((word) => word[0], { element: (word) => word.length })
    )
  );
  assert.deepEqual(trace, ['a:5', 'b:4', 'a:7']);
});

test('M15 groupBy duration completes the group; the key can then reopen', () => {
  const source = createSubject();
  const durations = new Map();
  const trace = [];
  subscribe({
    next: (group) => {
      trace.push(`open:${group.key}`);
      subscribe({
        next: (value) => trace.push(`${group.key}:${value}`),
        complete: () => trace.push(`${group.key}:complete`),
      })(group);
    },
    complete: () => trace.push('complete'),
  })(
    pipeValue(
      source,
      groupBy((value) => value.key, {
        duration: (group) => {
          const duration = createSubject();
          durations.set(group.key, duration);
          return duration;
        },
      })
    )
  );
  source.next({ key: 'a', n: 1 });
  durations.get('a').next('expire');
  source.next({ key: 'a', n: 2 });
  source.complete();
  assert.deepEqual(trace, [
    'open:a',
    'a:[object Object]',
    'a:complete',
    'open:a',
    'a:[object Object]',
    'a:complete',
    'complete',
  ]);
});

test('M15 groupBy connector replaces the per-group Subject', () => {
  const late = [];
  const groups = [];
  subscribe({ next: (group) => groups.push(group) })(
    pipeValue(
      of(1, 3, 5),
      groupBy(() => 'odd', { connector: () => createReplaySubject(2) })
    )
  );
  subscribe({
    next: (value) => late.push(value),
    complete: () => late.push('complete'),
  })(groups[0]);
  assert.deepEqual(late, [3, 5, 'complete']);
});

test('M15 groupBy keeps the source alive while a group is still subscribed', () => {
  let tornDown = false;
  const hub = createSubject();
  const source = createObservable((subscriber) => {
    const subscription = subscribe(subscriber)(hub);
    return () => {
      tornDown = true;
      subscription.unsubscribe();
    };
  });
  const groupValues = [];
  let groupSubscription = null;
  const outer = subscribe({
    next: (group) => {
      groupSubscription = subscribe({ next: (value) => groupValues.push(value) })(group);
    },
  })(pipeValue(source, groupBy(() => 'all')));

  hub.next(1);
  outer.unsubscribe();
  assert.equal(tornDown, false);
  hub.next(2);
  assert.deepEqual(groupValues, [1, 2]);
  groupSubscription.unsubscribe();
  assert.equal(tornDown, true);
});

test('M15 compat groupBy accepts the deprecated positional arguments', () => {
  const trace = [];
  subscribe({
    next: (group) => {
      subscribe({ next: (value) => trace.push(`${group.key}:${value}`) })(group);
    },
  })(
    pipeValue(
      of('alpha', 'beta'),
      groupByCompat(
        (word) => word[0],
        (word) => word.toUpperCase()
      )
    )
  );
  assert.deepEqual(trace, ['a:ALPHA', 'b:BETA']);
});
