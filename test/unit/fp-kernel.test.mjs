import assert from 'node:assert/strict';
import test from 'node:test';

import { subscribe } from '../../src/compat/observable.ts';
import { COMPLETE_NOTIFICATION, nextNotification } from '../../src/kernel/notification.ts';
import { executeSource } from '../../src/kernel/observable.ts';
import { map } from '../../src/kernel/operators/map.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { createSubscriber } from '../../src/kernel/sink.ts';
import {
  combineTeardown,
  createSubscription,
  emptyTeardown,
  toTeardown,
} from '../../src/kernel/subscription.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { accumulationStep } from '../../src/kernel/operators/accumulation.ts';
import { distinctUntilChangedStep } from '../../src/kernel/operators/distinct-until-changed.ts';
import { pairwiseStep } from '../../src/kernel/operators/pairwise.ts';
import { scan } from '../../src/kernel/operators/scan.ts';
import {
  filterSink,
  fuseSinkTransformers,
  liftSinkTransformer,
  mapSink,
} from '../../src/kernel/sink-transformer.ts';

const collect = (source) => {
  const events = [];
  subscribe({
    next: (value) => events.push({ type: 'next', value }),
    error: (error) => events.push({ type: 'error', message: error.message }),
    complete: () => events.push({ type: 'complete' }),
  })(source);
  return events;
};

test('F2 functor identity law: lift(mapSink(identity)) is trace-equal to the source', () => {
  const source = of(1, 2, 3);
  const mapped = liftSinkTransformer(mapSink((value) => value))(source);
  assert.deepEqual(collect(mapped), collect(source));
});

test('F2 functor composition law: mapSink(f) fused with mapSink(g) equals mapSink(g o f)', () => {
  const f = (value) => value + 1;
  const g = (value) => value * 10;
  const source = of(1, 2, 3);

  const fusedPair = liftSinkTransformer(fuseSinkTransformers(mapSink(f), mapSink(g)))(source);
  const composed = liftSinkTransformer(mapSink((value) => g(f(value))))(source);
  assert.deepEqual(collect(fusedPair), collect(composed));
});

test('F2 fusion collapses map and filter into one sink with unchanged results', () => {
  const source = of(1, 2, 3, 4);
  const fused = liftSinkTransformer(
    fuseSinkTransformers(mapSink((value) => value * 10), filterSink((value) => value > 10))
  )(source);
  const piped = pipeValue(
    source,
    liftSinkTransformer(mapSink((value) => value * 10)),
    liftSinkTransformer(filterSink((value) => value > 10))
  );
  assert.deepEqual(collect(fused), collect(piped));
});

test('F3 pairwiseStep is a pure function over explicit state', () => {
  const step = pairwiseStep();
  const empty = Object.freeze({ has: false });

  assert.deepEqual(step(empty, 1, 0), [{ has: true, previous: 1 }, { kind: 'none' }]);
  assert.deepEqual(step(Object.freeze({ has: true, previous: 1 }), 2, 1), [
    { has: true, previous: 2 },
    { kind: 'one', value: [1, 2] },
  ]);
  // Same inputs, same outputs — no hidden state.
  assert.deepEqual(step(empty, 1, 0), step(empty, 1, 0));
});

test('F3 accumulationStep skips the accumulator for the unseeded first value', () => {
  const calls = [];
  const step = accumulationStep((accumulated, value, index) => {
    calls.push(index);
    return accumulated + value;
  }, true);

  const [afterFirst, firstEmit] = step(Object.freeze({ has: false }), 5, 0);
  assert.deepEqual(afterFirst, { has: true, accumulated: 5 });
  assert.deepEqual(firstEmit, { kind: 'one', value: 5 });
  assert.deepEqual(calls, []);

  const [afterSecond, secondEmit] = step(Object.freeze(afterFirst), 3, 1);
  assert.deepEqual(afterSecond, { has: true, accumulated: 8 });
  assert.deepEqual(secondEmit, { kind: 'one', value: 8 });
  assert.deepEqual(calls, [1]);
});

test('F3 distinctUntilChangedStep returns the incoming state unchanged on suppression', () => {
  const step = distinctUntilChangedStep((previous, current) => previous === current, (value) => value);
  const settled = Object.freeze({ first: false, key: 7 });

  const [suppressedState, suppressedEmit] = step(settled, 7, 1);
  assert.equal(suppressedState, settled);
  assert.deepEqual(suppressedEmit, { kind: 'none' });

  const [advancedState, advancedEmit] = step(settled, 8, 2);
  assert.deepEqual(advancedState, { first: false, key: 8 });
  assert.deepEqual(advancedEmit, { kind: 'one', value: 8 });
});

test('F3 statefulOperator creates independent state per subscription', () => {
  const result = pipeValue(of(1, 2, 3), scan((accumulated, value) => accumulated + value, 0));
  const first = collect(result);
  const second = collect(result);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.filter((event) => event.type === 'next').map((event) => event.value),
    [1, 3, 6]
  );
});

test('F4 lifecycle records and notifications are frozen', () => {
  const subscription = createSubscription();
  const subscriber = createSubscriber();

  assert.equal(Object.isFrozen(subscription), true);
  assert.equal(Object.isFrozen(subscriber), true);
  assert.equal(Object.isFrozen(nextNotification(1)), true);
  assert.equal(Object.isFrozen(COMPLETE_NOTIFICATION), true);
  assert.throws(() => {
    subscriber.next = () => {};
  }, TypeError);

  subscription.unsubscribe();
  subscriber.unsubscribe();
});

test('F4 composed subscriber records keep parentage bookkeeping', () => {
  const events = [];
  const parent = createSubscription();
  const child = createSubscriber();
  child.add(() => events.push('child-teardown'));

  parent.add(child);
  parent.add(child);
  child.unsubscribe();
  assert.deepEqual(events, ['child-teardown']);

  parent.unsubscribe();
  assert.deepEqual(events, ['child-teardown']);
});

test('F5 teardown monoid: emptyTeardown is a two-sided identity', () => {
  const events = [];
  const teardown = toTeardown(() => {
    events.push('run');
    throw new Error('boom');
  });

  const direct = teardown();
  const left = combineTeardown(emptyTeardown, teardown)();
  const right = combineTeardown(teardown, emptyTeardown)();

  assert.deepEqual(events, ['run', 'run', 'run']);
  for (const errors of [direct, left, right]) {
    assert.deepEqual(errors.map((error) => error.message), ['boom']);
  }
});

test('F5 teardown monoid: combineTeardown is associative in effects and errors', () => {
  const events = [];
  const make = (name, fails) => toTeardown(() => {
    events.push(name);
    if (fails) throw new Error(name);
  });
  const a = make('a', true);
  const b = make('b', false);
  const c = make('c', true);

  const leftGrouped = combineTeardown(combineTeardown(a, b), c)();
  const leftOrder = events.splice(0);
  const rightGrouped = combineTeardown(a, combineTeardown(b, c))();
  const rightOrder = events.splice(0);

  assert.deepEqual(leftOrder, ['a', 'b', 'c']);
  assert.deepEqual(rightOrder, leftOrder);
  assert.deepEqual(leftGrouped.map((error) => error.message), ['a', 'c']);
  assert.deepEqual(rightGrouped.map((error) => error.message), leftGrouped.map((error) => error.message));
});

test('F6 kernel subscribers accept an explicit runtime environment', () => {
  const notes = [];
  const env = {
    onUnhandledError: null,
    onStoppedNotification: (notification) =>
      notes.push(notification.kind === 'N' ? `N:${notification.value}` : notification.kind),
    defer: (task) => task(),
  };

  const subscriber = createSubscriber({ next() {}, error() {}, complete() {} }, env);
  subscriber.complete();
  subscriber.next(42);
  subscriber.complete();

  assert.deepEqual(notes, ['N:42', 'C']);
});

test('F6 operator subscribers inherit the environment from their destination', () => {
  const notes = [];
  const env = {
    onUnhandledError: null,
    onStoppedNotification: (notification) => notes.push(notification.kind),
    defer: (task) => task(),
  };

  let sourceSubscriber;
  const source = (subscriber) => {
    sourceSubscriber = subscriber;
    return undefined;
  };

  const destination = createSubscriber({ next() {}, error() {}, complete() {} }, env);
  executeSource(map((value) => value)(source), destination);

  sourceSubscriber.complete();
  sourceSubscriber.next(7);

  assert.deepEqual(notes, ['N']);
});

test('F5 toTeardown flattens aggregated UnsubscriptionError into error values', () => {
  const inner = createSubscription();
  inner.add(() => {
    throw new Error('one');
  });
  inner.add(() => {
    throw new Error('two');
  });

  const errors = toTeardown(inner)();
  assert.deepEqual(errors.map((error) => error.message), ['one', 'two']);
});
