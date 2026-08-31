import assert from 'node:assert/strict';
import test from 'node:test';

import { subscribe } from '../../src/compat/observable.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { share } from '../../src/kernel/sharing.ts';

const cold = (log) => {
  let runs = 0;
  return createObservable((subscriber) => {
    runs += 1;
    log.push(`run:${runs}`);
    subscriber.next(runs);
    return () => log.push(`teardown:${runs}`);
  });
};

test('M11 share state is independent per shared source application', () => {
  const logA = [];
  const logB = [];
  const operator = share();
  const sharedA = operator(cold(logA));
  const sharedB = operator(cold(logB));
  const seen = [];
  const subA = subscribe({ next: (value) => seen.push(`a:${value}`) })(sharedA);
  const subB = subscribe({ next: (value) => seen.push(`b:${value}`) })(sharedB);
  subA.unsubscribe();
  subB.unsubscribe();
  assert.deepEqual(logA, ['run:1', 'teardown:1']);
  assert.deepEqual(logB, ['run:1', 'teardown:1']);
  assert.deepEqual(seen, ['a:1', 'b:1']);
});

test('M11 share connects once per generation and resets on refCount zero', () => {
  const log = [];
  let live;
  const source = createObservable((subscriber) => {
    live = subscriber;
    log.push('run');
    return () => log.push('teardown');
  });
  const shared = share()(source);
  const seen = [];
  const one = subscribe({ next: (value) => seen.push(`1:${value}`) })(shared);
  const two = subscribe({ next: (value) => seen.push(`2:${value}`) })(shared);
  live.next('x');
  one.unsubscribe();
  two.unsubscribe();
  subscribe({ next: (value) => seen.push(`3:${value}`) })(shared);
  live.next('y');
  assert.deepEqual(log, ['run', 'teardown', 'run']);
  assert.deepEqual(seen, ['1:x', '2:x', '3:y']);
});
