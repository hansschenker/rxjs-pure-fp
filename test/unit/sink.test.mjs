import assert from 'node:assert/strict';
import test from 'node:test';

import { config } from '../../src/core/config.ts';
import { Subscriber, createSafeSubscriber, createSubscriber } from '../../src/core/sink.ts';

test('M02 createSubscriber composes notification state with the M01 lifecycle', () => {
  const events = [];
  const subscriber = createSubscriber({
    next(value) {
      events.push(`next:${value}`);
    },
    error(error) {
      events.push(`error:${error.message}`);
    },
    complete() {
      events.push('complete');
    },
  });

  subscriber.add(() => events.push('teardown'));
  subscriber.next(1);
  subscriber.complete();
  subscriber.next(2);
  subscriber.complete();

  assert.deepEqual(events, ['next:1', 'complete', 'teardown']);
  assert.equal(subscriber.isStopped, true);
  assert.equal(subscriber.closed, true);
});

test('M02 raw next-handler failures propagate synchronously without stopping the subscriber', () => {
  const expected = new Error('next-handler');
  const subscriber = createSubscriber({
    next() {
      throw expected;
    },
    error() {},
    complete() {},
  });

  assert.throws(() => subscriber.next(1), (error) => error === expected);
  assert.equal(subscriber.isStopped, false);
  assert.equal(subscriber.closed, false);
  subscriber.unsubscribe();
});

test('M02 raw error-handler failures still finalize the subscriber', () => {
  const expected = new Error('error-handler');
  const events = [];
  const subscriber = createSubscriber({
    next() {},
    error() {
      throw expected;
    },
    complete() {},
  });
  subscriber.add(() => events.push('teardown'));

  assert.throws(() => subscriber.error(new Error('source')), (error) => error === expected);
  assert.deepEqual(events, ['teardown']);
  assert.equal(subscriber.isStopped, true);
  assert.equal(subscriber.closed, true);
});

test('M02 Subscriber parity name is functional and retains the deprecated create helper', () => {
  assert.equal(typeof Subscriber, 'function');
  assert.equal(typeof Subscriber.create, 'function');
  assert.throws(() => new Subscriber(), TypeError);

  const subscriber = Subscriber.create(() => {});
  assert.equal(subscriber.closed, false);
  subscriber.unsubscribe();
});

test('M02 deprecated next context is composed without Subscriber inheritance', () => {
  const previous = config.useDeprecatedNextContext;
  config.useDeprecatedNextContext = true;
  const events = [];

  try {
    const subscriber = createSafeSubscriber({
      next(value) {
        events.push(value);
        this.unsubscribe();
      },
    });

    subscriber.next('stop');
    subscriber.next('ignored');

    assert.deepEqual(events, ['stop']);
    assert.equal(subscriber.closed, true);
    assert.equal(subscriber.isStopped, true);
  } finally {
    config.useDeprecatedNextContext = previous;
  }
});
