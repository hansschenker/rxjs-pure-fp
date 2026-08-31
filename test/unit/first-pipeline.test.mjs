import assert from 'node:assert/strict';
import test from 'node:test';

import { subscribe } from '../../src/compat/observable.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { createSubscriber } from '../../src/kernel/sink.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { filter } from '../../src/compat/filter.ts';
import { map } from '../../src/compat/map.ts';

test('M04 runs the first complete functional RxJS pipeline', () => {
  const events = [];
  const result = pipeValue(
    of(1, 2, 3),
    map((value) => value * 10),
    filter((value) => value > 10)
  );

  subscribe({
    next: (value) => events.push(value),
    complete: () => events.push('complete'),
  })(result);

  assert.deepEqual(events, [20, 30, 'complete']);
});

test('M04 operator composition remains lazy', () => {
  let executions = 0;
  const source = createObservable((subscriber) => {
    executions += 1;
    subscriber.next(1);
    subscriber.complete();
  });

  const result = pipeValue(source, map((value) => value + 1), filter(Boolean));
  assert.equal(executions, 0);

  subscribe()(result);
  assert.equal(executions, 1);
});

test('M04 map and filter index state is allocated per subscription', () => {
  const traces = [];
  const result = pipeValue(
    of('a', 'b', 'c'),
    map((value, index) => `${index}:${value}`),
    filter((_value, index) => index !== 1)
  );

  const collect = () => {
    const values = [];
    subscribe({ next: (value) => values.push(value) })(result);
    traces.push(values);
  };

  collect();
  collect();

  assert.deepEqual(traces, [
    ['0:a', '2:c'],
    ['0:a', '2:c'],
  ]);
});

test('M04 map projection errors enter the error channel and stop synchronous source values', () => {
  const events = [];
  const result = pipeValue(
    of(1, 2, 3),
    map((value) => {
      if (value === 2) throw new Error('map-boom');
      return value * 10;
    })
  );

  subscribe({
    next: (value) => events.push(`next:${value}`),
    error: (error) => events.push(`error:${error.message}`),
    complete: () => events.push('complete'),
  })(result);

  assert.deepEqual(events, ['next:10', 'error:map-boom']);
});

test('M04 filter predicate errors enter the error channel', () => {
  const events = [];
  const result = pipeValue(
    of(1, 2, 3),
    filter((value) => {
      if (value === 2) throw new Error('filter-boom');
      return true;
    })
  );

  subscribe({
    next: (value) => events.push(`next:${value}`),
    error: (error) => events.push(`error:${error.message}`),
    complete: () => events.push('complete'),
  })(result);

  assert.deepEqual(events, ['next:1', 'error:filter-boom']);
});

test('M04 downstream synchronous unsubscribe cascades through the operator chain', () => {
  const events = [];
  let subscriber;
  subscriber = createSubscriber({
    next(value) {
      events.push(value);
      if (value === 20) subscriber.unsubscribe();
    },
    error(error) {
      events.push(`error:${error.message}`);
    },
    complete() {
      events.push('complete');
    },
  });

  const result = pipeValue(
    of(1, 2, 3, 4),
    map((value) => value * 10),
    filter((value) => value >= 10)
  );

  subscribe(subscriber)(result);
  assert.deepEqual(events, [10, 20]);
  assert.equal(subscriber.closed, true);
});

test('M04 of emits each argument as one value without flattening', () => {
  const values = [];
  const array = [1, 2, 3];

  subscribe({ next: (value) => values.push(value) })(of(array, null, undefined));
  assert.deepEqual(values, [array, null, undefined]);
});

test('M04 map and filter preserve deprecated thisArg behavior', () => {
  const context = { factor: 3, minimum: 6 };
  const values = [];
  const result = pipeValue(
    of(1, 2, 3),
    map(function (value) {
      return value * this.factor;
    }, context),
    filter(function (value) {
      return value >= this.minimum;
    }, context)
  );

  subscribe({ next: (value) => values.push(value) })(result);
  assert.deepEqual(values, [6, 9]);
});
