import assert from 'node:assert/strict';
import test from 'node:test';

import { subscribe } from '../../src/compat/observable.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { filter } from '../../src/kernel/operators/filter.ts';
import { presenceStep } from '../../src/kernel/operators/presence.ts';
import { skip } from '../../src/kernel/operators/skip.ts';
import { skipWhileStep } from '../../src/kernel/operators/skip-while.ts';
import { takeStep } from '../../src/kernel/operators/take.ts';
import { takeWhileStep } from '../../src/kernel/operators/take-while.ts';
import { emitOne, statefulOperator } from '../../src/kernel/stateful-operator.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';

const collect = (source) => {
  const events = [];
  subscribe({
    next: (value) => events.push({ type: 'next', value }),
    error: (error) => events.push({ type: 'error', name: error.name, message: error.message }),
    complete: () => events.push({ type: 'complete' }),
  })(source);
  return events;
};

test('M06 emission ADT: `last` emits then completes, `done` completes without emitting', () => {
  const lastAtTwo = statefulOperator(null, (state, value) => [
    state,
    value === 2 ? { kind: 'last', value } : emitOne(value),
  ]);
  assert.deepEqual(collect(lastAtTwo(of(1, 2, 3))), [
    { type: 'next', value: 1 },
    { type: 'next', value: 2 },
    { type: 'complete' },
  ]);

  const doneAtTwo = statefulOperator(null, (state, value) => [
    state,
    value === 2 ? { kind: 'done' } : emitOne(value),
  ]);
  assert.deepEqual(collect(doneAtTwo(of(1, 2, 3))), [
    { type: 'next', value: 1 },
    { type: 'complete' },
  ]);
});

test('M06 takeStep is a pure counter over explicit state', () => {
  const step = takeStep(2);
  assert.deepEqual(step(0, 'a', 0), [1, { kind: 'one', value: 'a' }]);
  assert.deepEqual(step(1, 'b', 1), [2, { kind: 'last', value: 'b' }]);
  assert.deepEqual(step(2, 'c', 2), [2, { kind: 'none' }]);
  // Same inputs, same outputs — no hidden state.
  assert.deepEqual(step(0, 'a', 0), step(0, 'a', 0));
});

test('M06 takeWhile/skipWhile/presence steps are pure over frozen state', () => {
  const takeWhileExclusive = takeWhileStep((value) => value < 2, false);
  assert.deepEqual(takeWhileExclusive(null, 1, 0), [null, { kind: 'one', value: 1 }]);
  assert.deepEqual(takeWhileExclusive(null, 2, 1), [null, { kind: 'done' }]);

  const takeWhileInclusive = takeWhileStep((value) => value < 2, true);
  assert.deepEqual(takeWhileInclusive(null, 2, 1), [null, { kind: 'last', value: 2 }]);

  const skipStep = skipWhileStep((value) => value < 3);
  const skipping = Object.freeze({ taking: false });
  assert.deepEqual(skipStep(skipping, 1, 0), [skipping, { kind: 'none' }]);
  assert.deepEqual(skipStep(skipping, 3, 1), [{ taking: true }, { kind: 'one', value: 3 }]);

  const presence = presenceStep();
  const absent = Object.freeze({ has: false });
  assert.deepEqual(presence(absent, 'x', 0), [{ has: true }, { kind: 'one', value: 'x' }]);
  const present = Object.freeze({ has: true });
  assert.equal(presence(present, 'y', 1)[0], present);
});

test('M06 operator algebra: skip(n) equals filter by index', () => {
  const source = of('a', 'b', 'c', 'd');
  assert.deepEqual(
    collect(skip(2)(source)),
    collect(filter((_value, index) => 2 <= index)(source))
  );
});

test('M06 take completes downstream without waiting for source completion', () => {
  const events = [];
  let sourceSubscriber;
  const source = (subscriber) => {
    sourceSubscriber = subscriber;
    return () => events.push('teardown');
  };

  subscribe({
    next: (value) => events.push(`next:${value}`),
    complete: () => events.push('complete'),
  })(pipeValue(source, (s) => s, (s) => statefulOperator(0, takeStep(1))(s)));

  sourceSubscriber.next('only');
  assert.deepEqual(events, ['next:only', 'complete', 'teardown']);
  assert.equal(sourceSubscriber.closed, true);
});
