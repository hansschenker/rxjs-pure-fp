import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Subscriber as RxSubscriber,
  filter as rxFilter,
  map as rxMap,
  of as rxOf,
} from 'rxjs';
import { subscribe } from '../../src/compat/observable.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { createSubscriber } from '../../src/kernel/sink.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { filter } from '../../src/compat/filter.ts';
import { map } from '../../src/compat/map.ts';

const adapters = {
  rxjs: {
    of: rxOf,
    map: rxMap,
    filter: rxFilter,
    compose(value, ...operators) {
      return operators.reduce((current, operator) => operator(current), value);
    },
    subscribe(observer) {
      return (source) => source.subscribe(observer);
    },
    createSubscriber(destination) {
      return new RxSubscriber(destination);
    },
  },
  pureFp: {
    of,
    map,
    filter,
    compose: pipeValue,
    subscribe,
    createSubscriber,
  },
};

const firstPipelineTrace = ({ of, map, filter, compose, subscribe }) => {
  const events = [];
  const result = compose(
    of(1, 2, 3),
    map((value) => value * 10),
    filter((value) => value > 10)
  );

  const subscription = subscribe({
    next: (value) => events.push(`next:${value}`),
    error: (error) => events.push(`error:${error.message}`),
    complete: () => events.push('complete'),
  })(result);

  return { events, closed: subscription.closed };
};

const indexResetTrace = ({ of, map, filter, compose, subscribe }) => {
  const result = compose(
    of('a', 'b', 'c'),
    map((value, index) => `${index}:${value}`),
    filter((_value, index) => index !== 1)
  );

  const runs = [];
  for (let run = 0; run < 2; run += 1) {
    const values = [];
    subscribe({ next: (value) => values.push(value) })(result);
    runs.push(values);
  }
  return runs;
};

const mapErrorTrace = ({ of, map, compose, subscribe }) => {
  const events = [];
  const result = compose(
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
  return events;
};

const filterErrorTrace = ({ of, filter, compose, subscribe }) => {
  const events = [];
  const result = compose(
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
  return events;
};

const synchronousCancellationTrace = ({ of, map, filter, compose, subscribe, createSubscriber }) => {
  const events = [];
  let subscriber;
  subscriber = createSubscriber({
    next(value) {
      events.push(`next:${value}`);
      if (value === 20) subscriber.unsubscribe();
    },
    error(error) {
      events.push(`error:${error.message}`);
    },
    complete() {
      events.push('complete');
    },
  });

  const result = compose(
    of(1, 2, 3, 4),
    map((value) => value * 10),
    filter((value) => value >= 10)
  );

  const returned = subscribe(subscriber)(result);
  return {
    events,
    same: returned === subscriber,
    closed: returned.closed,
  };
};

const valueShapeTrace = ({ of, subscribe }) => {
  const array = [1, 2, 3];
  const values = [];
  subscribe({ next: (value) => values.push(value) })(of(array, null, undefined));
  return {
    sameArray: values[0] === array,
    tail: values.slice(1),
    length: values.length,
  };
};

const thisArgTrace = ({ of, map, filter, compose, subscribe }) => {
  const context = { factor: 3, minimum: 6 };
  const values = [];
  const result = compose(
    of(1, 2, 3),
    map(function (value, index) {
      return `${index}:${value * this.factor}`;
    }, context),
    filter(function (value, index) {
      const numeric = Number(value.split(':')[1]);
      return index >= 0 && numeric >= this.minimum;
    }, context)
  );

  subscribe({ next: (value) => values.push(value) })(result);
  return values;
};

const downstreamThrowTrace = ({ of, map, compose, subscribe, createSubscriber }) => {
  const events = [];
  const subscriber = createSubscriber({
    next(value) {
      events.push(`next:${value}`);
      if (value === 20) throw new Error('downstream-boom');
    },
    error(error) {
      events.push(`error:${error.message}`);
    },
    complete() {
      events.push('complete');
    },
  });

  const result = compose(of(1, 2, 3), map((value) => value * 10));
  subscribe(subscriber)(result);
  return { events, closed: subscriber.closed };
};

for (const [name, trace] of Object.entries({
  firstPipelineTrace,
  indexResetTrace,
  mapErrorTrace,
  filterErrorTrace,
  synchronousCancellationTrace,
  valueShapeTrace,
  thisArgTrace,
  downstreamThrowTrace,
})) {
  test(`M04 ${name} matches RxJS 7.8.2`, () => {
    assert.deepEqual(trace(adapters.pureFp), trace(adapters.rxjs));
  });
}
