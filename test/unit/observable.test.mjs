import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Observable,
  createObservable,
  subscribe,
} from '../../src/core/observable.ts';
import { pipe, pipeValue } from '../../src/core/pipe.ts';
import { createSubscriber } from '../../src/core/sink.ts';

test('M03 Observable construction is lazy and each subscription executes independently', () => {
  let executions = 0;
  const values = [];
  const source = createObservable((subscriber) => {
    executions += 1;
    subscriber.next(executions);
    subscriber.complete();
  });

  assert.equal(executions, 0);
  subscribe({ next: (value) => values.push(value) })(source);
  subscribe({ next: (value) => values.push(value) })(source);

  assert.equal(executions, 2);
  assert.deepEqual(values, [1, 2]);
});

test('M03 synchronous completion executes a teardown returned after completion', () => {
  const events = [];
  const source = createObservable((subscriber) => {
    events.push('run');
    subscriber.next(1);
    subscriber.complete();
    events.push('after-complete');
    return () => events.push('teardown');
  });

  const subscription = subscribe({
    next: (value) => events.push(`next:${value}`),
    complete: () => events.push('complete'),
  })(source);
  events.push(`returned:${subscription.closed}`);

  assert.deepEqual(events, [
    'run',
    'next:1',
    'complete',
    'after-complete',
    'teardown',
    'returned:true',
  ]);
});

test('M03 source exceptions are routed to the safe subscriber error channel', () => {
  const events = [];
  const source = createObservable(() => {
    throw new Error('boom');
  });

  const subscription = subscribe({
    error: (error) => events.push(error.message),
  })(source);

  assert.deepEqual(events, ['boom']);
  assert.equal(subscription.closed, true);
});

test('M03 direct unsubscribe cancels without synthesizing complete', () => {
  const events = [];
  const source = createObservable((subscriber) => {
    subscriber.next('value');
    return () => events.push('teardown');
  });

  const subscription = subscribe({
    next: (value) => events.push(value),
    complete: () => events.push('complete'),
  })(source);

  subscription.unsubscribe();
  assert.deepEqual(events, ['value', 'teardown']);
});

test('M03 standalone subscribe preserves an existing Subscriber identity', () => {
  const events = [];
  const subscriber = createSubscriber({
    next: (value) => events.push(value),
    error: () => {},
    complete: () => events.push('complete'),
  });
  const source = createObservable((sink) => {
    sink.next(1);
    sink.complete();
  });

  const returned = subscribe(subscriber)(source);
  assert.equal(returned, subscriber);
  assert.deepEqual(events, [1, 'complete']);
});

test('M03 initializer this is the functional Observable representation', () => {
  let source;
  let sameThis = false;
  source = createObservable(function (subscriber) {
    sameThis = this === source;
    subscriber.complete();
  });

  subscribe()(source);
  assert.equal(sameThis, true);
});

test('M03 Observable parity name is functional and retains deprecated create', () => {
  const source = Observable((subscriber) => subscriber.complete());
  const created = Observable.create((subscriber) => subscriber.complete());

  assert.equal(typeof source, 'function');
  assert.equal(typeof created, 'function');
  assert.throws(() => new Observable(), TypeError);
});

test('M03 pipe keeps RxJS-style function composition while pipeValue is data-first', () => {
  const plusOne = (value) => value + 1;
  const double = (value) => value * 2;

  assert.equal(pipe(plusOne, double)(3), 8);
  assert.equal(pipeValue(3, plusOne, double), 8);
  assert.equal(pipe()(3), 3);
});
