import assert from 'node:assert/strict';
import test from 'node:test';

import { subscribe } from '../../src/compat/observable.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { distinct } from '../../src/kernel/operators/distinct.ts';
import { distinctUntilChanged } from '../../src/kernel/operators/distinct-until-changed.ts';
import { distinctUntilKeyChanged } from '../../src/kernel/operators/distinct-until-key-changed.ts';
import { pairwise } from '../../src/kernel/operators/pairwise.ts';
import { reduce } from '../../src/kernel/operators/reduce.ts';
import { scan } from '../../src/kernel/operators/scan.ts';
import { tap } from '../../src/kernel/operators/tap.ts';

const collect = (source) => {
  const events = [];
  subscribe({
    next: (value) => events.push({ type: 'next', value }),
    error: (error) => events.push({ type: 'error', message: error.message }),
    complete: () => events.push({ type: 'complete' }),
  })(source);
  return events;
};

test('M05 tap mirrors values and observes notifications', () => {
  const sideEffects = [];
  const result = pipeValue(
    of(1, 2),
    tap({
      subscribe: () => sideEffects.push('subscribe'),
      next: (value) => sideEffects.push(`tap:${value}`),
      complete: () => sideEffects.push('tap-complete'),
      finalize: () => sideEffects.push('finalize'),
    })
  );

  const output = collect(result);
  assert.deepEqual(output, [
    { type: 'next', value: 1 },
    { type: 'next', value: 2 },
    { type: 'complete' },
  ]);
  assert.deepEqual(sideEffects, ['subscribe', 'tap:1', 'tap:2', 'tap-complete', 'finalize']);
});

test('M05 tap synchronous completion finalizes before late returned source teardown', () => {
  const events = [];
  const source = createObservable((subscriber) => {
    events.push('source-run');
    subscriber.complete();
    events.push('source-after-complete');
    return () => events.push('source-teardown');
  });

  const result = pipeValue(
    source,
    tap({
      subscribe: () => events.push('tap-subscribe'),
      complete: () => events.push('tap-complete'),
      finalize: () => events.push('tap-finalize'),
    })
  );

  subscribe({ complete: () => events.push('destination-complete') })(result);
  assert.deepEqual(events, [
    'tap-subscribe',
    'source-run',
    'tap-complete',
    'destination-complete',
    'tap-finalize',
    'source-after-complete',
    'source-teardown',
  ]);
});

test('M05 tap explicit unsubscribe runs source teardown then unsubscribe and finalize hooks', () => {
  const events = [];
  const source = createObservable(() => {
    events.push('source-run');
    return () => events.push('source-teardown');
  });
  const result = pipeValue(
    source,
    tap({
      subscribe: () => events.push('tap-subscribe'),
      unsubscribe: () => events.push('tap-unsubscribe'),
      finalize: () => events.push('tap-finalize'),
    })
  );

  const subscription = subscribe()(result);
  subscription.unsubscribe();
  assert.deepEqual(events, [
    'tap-subscribe',
    'source-run',
    'source-teardown',
    'tap-unsubscribe',
    'tap-finalize',
  ]);
});

test('M05 tap callback failure becomes an error and explicit-unsubscribe hook participates', () => {
  const events = [];
  const result = pipeValue(
    of(1, 2),
    tap({
      next: (value) => {
        events.push(`tap:${value}`);
        if (value === 2) throw new Error('tap-boom');
      },
      unsubscribe: () => events.push('tap-unsubscribe'),
      finalize: () => events.push('tap-finalize'),
    })
  );

  subscribe({
    next: (value) => events.push(`next:${value}`),
    error: (error) => events.push(`error:${error.message}`),
  })(result);

  assert.deepEqual(events, [
    'tap:1',
    'next:1',
    'tap:2',
    'error:tap-boom',
    'tap-unsubscribe',
    'tap-finalize',
  ]);
});

test('M05 scan without seed primes state from the first source value', () => {
  const indexes = [];
  const result = pipeValue(
    of(1, 2, 3),
    scan((acc, value, index) => {
      indexes.push(index);
      return acc + value;
    })
  );

  assert.deepEqual(collect(result), [
    { type: 'next', value: 1 },
    { type: 'next', value: 3 },
    { type: 'next', value: 6 },
    { type: 'complete' },
  ]);
  assert.deepEqual(indexes, [1, 2]);
});

test('M05 scan treats an explicit undefined seed as a supplied seed', () => {
  const indexes = [];
  const result = pipeValue(
    of(1, 2, 3),
    scan((acc, value, index) => {
      indexes.push(index);
      return (acc ?? 0) + value;
    }, undefined)
  );

  assert.deepEqual(collect(result).map((event) => event.value ?? event.type), [1, 3, 6, 'complete']);
  assert.deepEqual(indexes, [0, 1, 2]);
});

test('M05 scan accumulator failures enter the error channel', () => {
  const result = pipeValue(
    of(1, 2, 3),
    scan((acc, value) => {
      if (value === 2) throw new Error('scan-boom');
      return acc + value;
    }, 0)
  );

  assert.deepEqual(collect(result), [
    { type: 'next', value: 1 },
    { type: 'error', message: 'scan-boom' },
  ]);
});

test('M05 reduce emits once on completion and preserves seed/no-seed indexes', () => {
  const noSeedIndexes = [];
  const seedIndexes = [];

  const noSeed = pipeValue(of(1, 2, 3), reduce((acc, value, index) => {
    noSeedIndexes.push(index);
    return acc + value;
  }));
  const seeded = pipeValue(of(1, 2, 3), reduce((acc, value, index) => {
    seedIndexes.push(index);
    return acc + value;
  }, 0));

  assert.deepEqual(collect(noSeed), [{ type: 'next', value: 6 }, { type: 'complete' }]);
  assert.deepEqual(collect(seeded), [{ type: 'next', value: 6 }, { type: 'complete' }]);
  assert.deepEqual(noSeedIndexes, [1, 2]);
  assert.deepEqual(seedIndexes, [0, 1, 2]);
});

test('M05 reduce empty-source behavior depends on whether a seed was supplied', () => {
  assert.deepEqual(collect(pipeValue(of(), reduce((acc, value) => acc + value))), [
    { type: 'complete' },
  ]);
  assert.deepEqual(collect(pipeValue(of(), reduce((acc, value) => acc ?? value, undefined))), [
    { type: 'next', value: undefined },
    { type: 'complete' },
  ]);
});

test('M05 pairwise emits only from the second value and resets memory per subscription', () => {
  const result = pipeValue(of(1, 2, 3), pairwise());
  const expected = [
    { type: 'next', value: [1, 2] },
    { type: 'next', value: [2, 3] },
    { type: 'complete' },
  ];
  assert.deepEqual(collect(result), expected);
  assert.deepEqual(collect(result), expected);
});

test('M05 distinct remembers all seen keys per subscription', () => {
  const values = collect(pipeValue(of(1, 1, 2, 1, 3, 2), distinct()))
    .filter((event) => event.type === 'next')
    .map((event) => event.value);
  assert.deepEqual(values, [1, 2, 3]);

  const objects = [
    { id: 1, name: 'a' },
    { id: 2, name: 'b' },
    { id: 3, name: 'a' },
  ];
  const byName = collect(pipeValue(of(...objects), distinct((value) => value.name)))
    .filter((event) => event.type === 'next')
    .map((event) => event.value.id);
  assert.deepEqual(byName, [1, 2]);
});

test('M05 distinct functional flush Observable clears the Set', () => {
  let sourceSubscriber;
  let flushSubscriber;
  const source = createObservable((subscriber) => {
    sourceSubscriber = subscriber;
  });
  const flushes = createObservable((subscriber) => {
    flushSubscriber = subscriber;
  });
  const values = [];

  subscribe({ next: (value) => values.push(value) })(pipeValue(source, distinct(undefined, flushes)));
  sourceSubscriber.next(1);
  sourceSubscriber.next(1);
  flushSubscriber.next('flush');
  sourceSubscriber.next(1);
  sourceSubscriber.complete();

  assert.deepEqual(values, [1, 1]);
});

test('M05 distinct and distinctUntilChanged intentionally differ for NaN', () => {
  const allDistinct = collect(pipeValue(of(NaN, NaN, NaN), distinct()))
    .filter((event) => event.type === 'next');
  const consecutive = collect(pipeValue(of(NaN, NaN, NaN), distinctUntilChanged()))
    .filter((event) => event.type === 'next');

  assert.equal(allDistinct.length, 1);
  assert.equal(consecutive.length, 3);
});

test('M05 distinctUntilChanged updates previous key before downstream reentrancy', () => {
  let sourceSubscriber;
  const source = createObservable((subscriber) => {
    sourceSubscriber = subscriber;
  });
  const values = [];

  subscribe({
    next(value) {
      values.push(value);
      if (values.length === 1) {
        sourceSubscriber.next(value);
      }
    },
  })(pipeValue(source, distinctUntilChanged()));

  sourceSubscriber.next(1);
  assert.deepEqual(values, [1]);
});

test('M05 distinctUntilChanged supports keySelector and custom comparator', () => {
  const source = of(
    { name: 'Alice', revision: 1 },
    { name: 'Alice', revision: 2 },
    { name: 'Bob', revision: 1 },
    { name: 'BOB', revision: 2 }
  );
  const result = pipeValue(
    source,
    distinctUntilChanged(
      (previous, current) => previous.toLowerCase() === current.toLowerCase(),
      (value) => value.name
    )
  );

  const values = collect(result).filter((event) => event.type === 'next').map((event) => event.value);
  assert.deepEqual(values.map((value) => value.revision), [1, 1]);
});

test('M05 distinctUntilKeyChanged compares consecutive object keys', () => {
  const values = collect(pipeValue(
    of(
      { name: 'Foo', age: 1 },
      { name: 'Foo', age: 2 },
      { name: 'Bar', age: 3 },
      { name: 'Bar', age: 4 },
      { name: 'Foo', age: 5 }
    ),
    distinctUntilKeyChanged('name')
  )).filter((event) => event.type === 'next').map((event) => event.value.age);

  assert.deepEqual(values, [1, 3, 5]);
});
