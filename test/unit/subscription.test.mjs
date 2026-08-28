import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMPTY_SUBSCRIPTION,
  Subscription,
  UnsubscriptionError,
  createSubscription,
  isSubscription,
} from '../../src/core/subscription.ts';

test('M01 createSubscription owns lifecycle state in a closure', () => {
  const events = [];
  const subscription = createSubscription(() => events.push('initial'));

  assert.equal(subscription.closed, false);
  subscription.add(() => events.push('first'));
  subscription.add(() => events.push('second'));

  subscription.unsubscribe();
  subscription.unsubscribe();

  assert.equal(subscription.closed, true);
  assert.deepEqual(events, ['initial', 'first', 'second']);
});

test('M01 adding to a closed subscription executes the finalizer immediately', () => {
  const events = [];
  const subscription = createSubscription();
  subscription.unsubscribe();

  subscription.add(() => events.push('late'));

  assert.deepEqual(events, ['late']);
});

test('M01 remove removes one matching finalizer occurrence at a time', () => {
  let calls = 0;
  const finalizer = () => {
    calls += 1;
  };
  const subscription = createSubscription();

  subscription.add(finalizer);
  subscription.add(finalizer);
  subscription.remove(finalizer);
  subscription.unsubscribe();

  assert.equal(calls, 1);
});

test('M01 child subscriptions detach from all parents when they unsubscribe', () => {
  const events = [];
  const left = createSubscription();
  const right = createSubscription();
  const child = createSubscription(() => events.push('child'));

  left.add(child);
  right.add(child);
  child.unsubscribe();
  left.unsubscribe();
  right.unsubscribe();

  assert.deepEqual(events, ['child']);
  assert.equal(left.closed, true);
  assert.equal(right.closed, true);
  assert.equal(child.closed, true);
});

test('M01 aggregates and flattens teardown errors without skipping later finalizers', () => {
  const subscription = createSubscription(() => {
    throw new Error('initial');
  });
  subscription.add(() => {
    throw new Error('first');
  });

  const child = createSubscription(() => {
    throw new Error('child-initial');
  });
  child.add(() => {
    throw new Error('child-finalizer');
  });
  subscription.add(child);

  assert.throws(
    () => subscription.unsubscribe(),
    (error) => {
      assert.equal(error.name, 'UnsubscriptionError');
      assert.deepEqual(
        error.errors.map((item) => item.message),
        ['initial', 'first', 'child-initial', 'child-finalizer'],
      );
      assert.equal(
        error.message,
        '4 errors occurred during unsubscription:\n1) Error: initial\n  2) Error: first\n  3) Error: child-initial\n  4) Error: child-finalizer',
      );
      return true;
    },
  );
});

test('M01 keeps RxJS parity names functional rather than constructible', () => {
  const subscription = Subscription();
  const error = UnsubscriptionError([new Error('boom')]);

  assert.equal(isSubscription(subscription), true);
  assert.equal(error.name, 'UnsubscriptionError');
  assert.equal(EMPTY_SUBSCRIPTION.closed, true);
  assert.throws(() => new Subscription(), TypeError);
  assert.throws(() => new UnsubscriptionError([]), TypeError);
});

test('M01 isSubscription accepts compatible structural subscription values', () => {
  const compatible = {
    closed: false,
    add() {},
    remove() {},
    unsubscribe() {},
  };

  assert.equal(isSubscription(compatible), true);
  assert.equal(isSubscription({ unsubscribe() {} }), false);
});
