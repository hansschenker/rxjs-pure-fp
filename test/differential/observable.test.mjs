import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Observable as RxObservable,
  Subscriber as RxSubscriber,
  Subscription as RxSubscription,
  pipe as rxPipe,
} from 'rxjs';
import { createObservable, subscribe } from '../../src/core/observable.ts';
import { pipe } from '../../src/core/pipe.ts';
import { createSubscriber } from '../../src/core/sink.ts';
import { createSubscription } from '../../src/core/subscription.ts';

const adapters = {
  rxjs: {
    create(initializer) {
      return new RxObservable(initializer);
    },
    subscribe(observer) {
      return (source) => source.subscribe(observer);
    },
    createSubscriber(destination) {
      return new RxSubscriber(destination);
    },
    createSubscription(teardown) {
      return new RxSubscription(teardown);
    },
    pipe: rxPipe,
  },
  pureFp: {
    create: createObservable,
    subscribe,
    createSubscriber,
    createSubscription,
    pipe,
  },
};

const synchronousCompletionTrace = ({ create, subscribe }) => {
  const events = [];
  const source = create((subscriber) => {
    events.push('run');
    subscriber.next(1);
    subscriber.complete();
    events.push('after-complete');
    return () => events.push('teardown');
  });

  events.push('constructed');
  const subscription = subscribe({
    next: (value) => events.push(`next:${value}`),
    complete: () => events.push('complete'),
  })(source);
  events.push(`returned:${subscription.closed}`);

  return events;
};

const sourceThrowTrace = ({ create, subscribe }) => {
  const events = [];
  const source = create(() => {
    events.push('run');
    throw new Error('boom');
  });

  const subscription = subscribe({
    error: (error) => events.push(`error:${error.message}`),
  })(source);

  return { events, closed: subscription.closed };
};

const independenceTrace = ({ create, subscribe }) => {
  const values = [];
  let executions = 0;
  const source = create((subscriber) => {
    executions += 1;
    subscriber.next(executions);
    subscriber.complete();
  });

  subscribe({ next: (value) => values.push(value) })(source);
  subscribe({ next: (value) => values.push(value) })(source);
  return { executions, values };
};

const manualUnsubscribeTrace = ({ create, subscribe }) => {
  const events = [];
  const source = create((subscriber) => {
    subscriber.next('value');
    return () => events.push('teardown');
  });

  const subscription = subscribe({
    next: (value) => events.push(value),
    complete: () => events.push('complete'),
  })(source);
  const before = subscription.closed;
  subscription.unsubscribe();
  const after = subscription.closed;

  return { events, before, after };
};

const existingSubscriberTrace = ({ create, subscribe, createSubscriber }) => {
  const events = [];
  const subscriber = createSubscriber({
    next: (value) => events.push(`next:${value}`),
    error: (error) => events.push(`error:${error.message}`),
    complete: () => events.push('complete'),
  });
  const source = create((sink) => {
    sink.next(7);
    sink.complete();
  });

  const returned = subscribe(subscriber)(source);
  return {
    same: returned === subscriber,
    events,
    closed: returned.closed,
  };
};

const returnedSubscriptionTrace = ({ create, subscribe, createSubscription }) => {
  const events = [];
  const child = createSubscription(() => events.push('child-teardown'));
  const source = create((subscriber) => {
    subscriber.next('ready');
    return child;
  });

  const outer = subscribe({ next: (value) => events.push(value) })(source);
  outer.unsubscribe();

  return {
    events,
    outerClosed: outer.closed,
    childClosed: child.closed,
  };
};

const initializerThisTrace = ({ create, subscribe }) => {
  let source;
  let sameThis = false;
  source = create(function (subscriber) {
    sameThis = this === source;
    subscriber.complete();
  });

  subscribe()(source);
  return sameThis;
};

const pipeTrace = ({ pipe }) => pipe((value) => value + 1, (value) => value * 3)(4);

for (const [name, trace] of Object.entries({
  synchronousCompletionTrace,
  sourceThrowTrace,
  independenceTrace,
  manualUnsubscribeTrace,
  existingSubscriberTrace,
  returnedSubscriptionTrace,
  initializerThisTrace,
  pipeTrace,
})) {
  test(`M03 ${name} matches RxJS 7.8.2`, () => {
    assert.deepEqual(trace(adapters.pureFp), trace(adapters.rxjs));
  });
}
