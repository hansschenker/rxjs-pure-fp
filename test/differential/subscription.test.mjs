import assert from 'node:assert/strict';
import test from 'node:test';

import { Subscription as RxSubscription } from 'rxjs';
import { createSubscription } from '../../src/core/subscription.ts';

const adapters = {
  rxjs: {
    create(initialTeardown) {
      return new RxSubscription(initialTeardown);
    },
  },
  pureFp: {
    create(initialTeardown) {
      return createSubscription(initialTeardown);
    },
  },
};

const lifecycleTrace = ({ create }) => {
  const events = [];
  const parent = create(() => events.push('initial'));
  const child = create(() => events.push('child'));

  parent.add(() => events.push('first'));
  parent.add(child);
  parent.add(() => events.push('last'));
  parent.unsubscribe();
  parent.unsubscribe();

  return {
    events,
    parentClosed: parent.closed,
    childClosed: child.closed,
  };
};

const removalTrace = ({ create }) => {
  const events = [];
  const subscription = create();
  const finalizer = () => events.push('same');

  subscription.add(finalizer);
  subscription.add(finalizer);
  subscription.remove(finalizer);
  subscription.unsubscribe();

  return events;
};

const childRemovalTrace = ({ create }) => {
  const events = [];
  const parent = create(() => events.push('parent'));
  const child = create(() => events.push('child'));

  parent.add(child);
  parent.remove(child);
  parent.unsubscribe();
  const childClosedAfterParent = child.closed;
  child.unsubscribe();

  return {
    events,
    parentClosed: parent.closed,
    childClosedAfterParent,
    childClosedFinally: child.closed,
  };
};

const closedAddTrace = ({ create }) => {
  const events = [];
  const subscription = create();
  subscription.unsubscribe();
  subscription.add(() => events.push('late'));
  return events;
};

const unsubscribableTrace = ({ create }) => {
  const events = [];
  const finalizer = {
    unsubscribe() {
      events.push('unsubscribe-object');
    },
  };
  const subscription = create();

  subscription.add(finalizer);
  subscription.unsubscribe();
  subscription.add(finalizer);

  return events;
};

const parentageTrace = ({ create }) => {
  const events = [];
  const left = create(() => events.push('left'));
  const right = create(() => events.push('right'));
  const child = create(() => events.push('child'));

  left.add(child);
  right.add(child);
  child.unsubscribe();
  left.unsubscribe();
  right.unsubscribe();

  return {
    events,
    leftClosed: left.closed,
    rightClosed: right.closed,
    childClosed: child.closed,
  };
};

const errorTrace = ({ create }) => {
  const parent = create(() => {
    throw new Error('initial');
  });
  parent.add(() => {
    throw new Error('first');
  });

  const child = create(() => {
    throw new Error('child-initial');
  });
  child.add(() => {
    throw new Error('child-finalizer');
  });
  parent.add(child);

  try {
    parent.unsubscribe();
    return { threw: false };
  } catch (error) {
    return {
      threw: true,
      name: error.name,
      message: error.message,
      errors: error.errors.map((item) => ({
        name: item.name,
        message: item.message,
      })),
      parentClosed: parent.closed,
      childClosed: child.closed,
    };
  }
};

for (const [name, trace] of Object.entries({
  lifecycleTrace,
  removalTrace,
  childRemovalTrace,
  closedAddTrace,
  unsubscribableTrace,
  parentageTrace,
  errorTrace,
})) {
  test(`M01 ${name} matches RxJS 7.8.2`, () => {
    assert.deepEqual(trace(adapters.pureFp), trace(adapters.rxjs));
  });
}
