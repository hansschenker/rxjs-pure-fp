import assert from 'node:assert/strict';
import test from 'node:test';

import { subscribe } from '../../src/compat/observable.ts';
import { of } from '../../src/kernel/creation/of.ts';
import {
  exhaustPolicy,
  flattenWith,
  latestPolicy,
  overlapPolicy,
  queuePolicy,
} from '../../src/kernel/flattening.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';

const collect = (source) => {
  const events = [];
  subscribe({
    next: (value) => events.push({ type: 'next', value }),
    error: (error) => events.push({ type: 'error', message: error.message }),
    complete: () => events.push({ type: 'complete' }),
  })(source);
  return events;
};

test('M07 policies are frozen data records', () => {
  for (const policy of [overlapPolicy(3), queuePolicy, latestPolicy, exhaustPolicy]) {
    assert.equal(Object.isFrozen(policy), true);
  }
  assert.deepEqual(queuePolicy, { concurrent: 1, overflow: 'enqueue', settle: 'finalize' });
  assert.deepEqual(latestPolicy, { concurrent: 1, overflow: 'switch', settle: 'complete' });
  assert.deepEqual(exhaustPolicy, { concurrent: 1, overflow: 'ignore', settle: 'complete' });
  // concat is merge at concurrency one: policy algebra, not a new machine.
  assert.deepEqual(queuePolicy, overlapPolicy(1));
});

test('M07 the same machine expresses all four canonical behaviors', () => {
  const source = of(1, 2);
  const project = (value) => of(`${value}a`, `${value}b`);

  const values = (policy) =>
    collect(flattenWith(policy, project)(source))
      .filter((event) => event.type === 'next')
      .map((event) => event.value);

  assert.deepEqual(values(overlapPolicy(Infinity)), ['1a', '1b', '2a', '2b']);
  assert.deepEqual(values(queuePolicy), ['1a', '1b', '2a', '2b']);
  assert.deepEqual(values(latestPolicy), ['1a', '1b', '2a', '2b']);
  assert.deepEqual(values(exhaustPolicy), ['1a', '1b', '2a', '2b']);
});

test('M07 flattening state is independent per subscription', () => {
  const runs = [];
  const source = of('x', 'y');
  const result = flattenWith(overlapPolicy(Infinity), (value, index) => {
    runs.push(`${value}@${index}`);
    return of(value.toUpperCase());
  })(source);

  const first = collect(result);
  const second = collect(result);
  assert.deepEqual(first, second);
  assert.deepEqual(runs, ['x@0', 'y@1', 'x@0', 'y@1']);
});

test('M07 ignored outer values never consume a projection index', () => {
  const indexes = [];
  let outerSubscriber;
  const source = (subscriber) => {
    outerSubscriber = subscriber;
    return undefined;
  };
  let innerSubscriber;
  const events = [];
  subscribe({ next: (value) => events.push(value), complete: () => events.push('complete') })(
    pipeValue(
      source,
      (s) =>
        flattenWith(exhaustPolicy, (value, index) => {
          indexes.push(`${value}@${index}`);
          return (subscriber) => {
            innerSubscriber = subscriber;
            return undefined;
          };
        })(s)
    )
  );

  outerSubscriber.next('a');
  outerSubscriber.next('ignored');
  innerSubscriber.complete();
  outerSubscriber.next('b');
  outerSubscriber.complete();
  innerSubscriber.complete();

  assert.deepEqual(indexes, ['a@0', 'b@1']);
  assert.deepEqual(events, ['complete']);
});
