import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Observable as RxObservable,
  distinct as rxDistinct,
  distinctUntilChanged as rxDistinctUntilChanged,
  distinctUntilKeyChanged as rxDistinctUntilKeyChanged,
  of as rxOf,
  pairwise as rxPairwise,
  reduce as rxReduce,
  scan as rxScan,
  tap as rxTap,
} from 'rxjs';
import { createObservable, subscribe } from '../../src/core/observable.ts';
import { pipeValue } from '../../src/core/pipe.ts';
import { of } from '../../src/creation/of.ts';
import { distinct } from '../../src/operators/distinct.ts';
import { distinctUntilChanged } from '../../src/operators/distinct-until-changed.ts';
import { distinctUntilKeyChanged } from '../../src/operators/distinct-until-key-changed.ts';
import { pairwise } from '../../src/operators/pairwise.ts';
import { reduce } from '../../src/operators/reduce.ts';
import { scan } from '../../src/operators/scan.ts';
import { tap } from '../../src/operators/tap.ts';

const adapters = {
  rxjs: {
    create: (initializer) => new RxObservable(initializer),
    subscribe: (observer) => (source) => source.subscribe(observer),
    compose: (source, ...operators) => operators.reduce((current, operator) => operator(current), source),
    of: rxOf,
    tap: rxTap,
    scan: rxScan,
    reduce: rxReduce,
    pairwise: rxPairwise,
    distinct: rxDistinct,
    distinctUntilChanged: rxDistinctUntilChanged,
    distinctUntilKeyChanged: rxDistinctUntilKeyChanged,
  },
  pureFp: {
    create: createObservable,
    subscribe,
    compose: pipeValue,
    of,
    tap,
    scan,
    reduce,
    pairwise,
    distinct,
    distinctUntilChanged,
    distinctUntilKeyChanged,
  },
};

const collect = (adapter, source) => {
  const events = [];
  const subscription = adapter.subscribe({
    next: (value) => events.push({ type: 'next', value }),
    error: (error) => events.push({ type: 'error', message: error.message }),
    complete: () => events.push({ type: 'complete' }),
  })(source);
  return { events, subscription };
};

const tapCompleteTimingTrace = ({ create, subscribe, compose, tap }) => {
  const events = [];
  const source = create((subscriber) => {
    events.push('source-run');
    subscriber.complete();
    events.push('source-after-complete');
    return () => events.push('source-teardown');
  });
  const result = compose(source, tap({
    subscribe: () => events.push('tap-subscribe'),
    complete: () => events.push('tap-complete'),
    unsubscribe: () => events.push('tap-unsubscribe'),
    finalize: () => events.push('tap-finalize'),
  }));

  subscribe({ complete: () => events.push('destination-complete') })(result);
  return events;
};

const tapExplicitUnsubscribeTrace = ({ create, subscribe, compose, tap }) => {
  const events = [];
  const source = create(() => {
    events.push('source-run');
    return () => events.push('source-teardown');
  });
  const result = compose(source, tap({
    subscribe: () => events.push('tap-subscribe'),
    unsubscribe: () => events.push('tap-unsubscribe'),
    finalize: () => events.push('tap-finalize'),
  }));

  const subscription = subscribe()(result);
  subscription.unsubscribe();
  return events;
};

const tapNextErrorTrace = ({ of, subscribe, compose, tap }) => {
  const events = [];
  const result = compose(of(1, 2, 3), tap({
    next(value) {
      events.push(`tap:${value}`);
      if (value === 2) throw new Error('tap-boom');
    },
    unsubscribe: () => events.push('tap-unsubscribe'),
    finalize: () => events.push('tap-finalize'),
  }));

  const subscription = subscribe({
    next: (value) => events.push(`next:${value}`),
    error: (error) => events.push(`error:${error.message}`),
    complete: () => events.push('complete'),
  })(result);
  return { events, closed: subscription.closed };
};

const scanNoSeedTrace = ({ of, subscribe, compose, scan }) => {
  const indexes = [];
  const result = compose(of(1, 2, 3), scan((acc, value, index) => {
    indexes.push(index);
    return acc + value;
  }));
  const { events } = collect({ subscribe }, result);
  return { events, indexes };
};

const scanUndefinedSeedTrace = ({ of, subscribe, compose, scan }) => {
  const indexes = [];
  const result = compose(of(1, 2, 3), scan((acc, value, index) => {
    indexes.push(index);
    return (acc ?? 0) + value;
  }, undefined));
  const { events } = collect({ subscribe }, result);
  return { events, indexes };
};

const scanErrorTrace = ({ of, subscribe, compose, scan }) => {
  const result = compose(of(1, 2, 3), scan((acc, value) => {
    if (value === 2) throw new Error('scan-boom');
    return acc + value;
  }, 0));
  return collect({ subscribe }, result).events;
};

const reduceSeedTrace = ({ of, subscribe, compose, reduce }) => {
  const noSeedIndexes = [];
  const seedIndexes = [];
  const noSeed = compose(of(1, 2, 3), reduce((acc, value, index) => {
    noSeedIndexes.push(index);
    return acc + value;
  }));
  const seeded = compose(of(1, 2, 3), reduce((acc, value, index) => {
    seedIndexes.push(index);
    return acc + value;
  }, 0));
  return {
    noSeed: collect({ subscribe }, noSeed).events,
    seeded: collect({ subscribe }, seeded).events,
    noSeedIndexes,
    seedIndexes,
  };
};

const reduceEmptyTrace = ({ of, subscribe, compose, reduce }) => ({
  noSeed: collect({ subscribe }, compose(of(), reduce((acc, value) => acc + value))).events,
  undefinedSeed: collect({ subscribe }, compose(of(), reduce((acc, value) => acc ?? value, undefined))).events,
});

const pairwiseTrace = ({ of, subscribe, compose, pairwise }) => {
  const result = compose(of(1, 2, 3), pairwise());
  return [collect({ subscribe }, result).events, collect({ subscribe }, result).events];
};

const distinctTrace = ({ of, subscribe, compose, distinct }) => {
  const result = compose(of(1, 1, 2, 1, 3, 2), distinct());
  return collect({ subscribe }, result).events;
};

const distinctKeyTrace = ({ of, subscribe, compose, distinct }) => {
  const source = of(
    { id: 1, name: 'a' },
    { id: 2, name: 'b' },
    { id: 3, name: 'a' }
  );
  const result = compose(source, distinct((value) => value.name));
  return collect({ subscribe }, result).events.map((event) =>
    event.type === 'next' ? { type: 'next', id: event.value.id } : event
  );
};

const distinctFlushTrace = ({ create, subscribe, compose, distinct }) => {
  let sourceSubscriber;
  let flushSubscriber;
  const source = create((subscriber) => {
    sourceSubscriber = subscriber;
  });
  const flushes = create((subscriber) => {
    flushSubscriber = subscriber;
  });
  const events = [];
  const subscription = subscribe({
    next: (value) => events.push(`next:${value}`),
    error: (error) => events.push(`error:${error.message}`),
    complete: () => events.push('complete'),
  })(compose(source, distinct(undefined, flushes)));

  sourceSubscriber.next(1);
  sourceSubscriber.next(1);
  flushSubscriber.next('flush');
  sourceSubscriber.next(1);
  sourceSubscriber.complete();

  return { events, closed: subscription.closed };
};

const nanDistinctnessTrace = ({ of, subscribe, compose, distinct, distinctUntilChanged }) => {
  const all = collect({ subscribe }, compose(of(NaN, NaN, NaN), distinct())).events;
  const consecutive = collect({ subscribe }, compose(of(NaN, NaN, NaN), distinctUntilChanged())).events;
  return {
    allNext: all.filter((event) => event.type === 'next').length,
    consecutiveNext: consecutive.filter((event) => event.type === 'next').length,
  };
};

const distinctReentrantTrace = ({ create, subscribe, compose, distinctUntilChanged }) => {
  let sourceSubscriber;
  const source = create((subscriber) => {
    sourceSubscriber = subscriber;
  });
  const values = [];

  subscribe({
    next(value) {
      values.push(value);
      if (values.length === 1) sourceSubscriber.next(value);
    },
  })(compose(source, distinctUntilChanged()));

  sourceSubscriber.next(1);
  return values;
};

const distinctKeySelectorTrace = ({ of, subscribe, compose, distinctUntilChanged }) => {
  const calls = [];
  const source = of(
    { name: 'Alice', revision: 1 },
    { name: 'Alice', revision: 2 },
    { name: 'Bob', revision: 1 },
    { name: 'BOB', revision: 2 }
  );
  const result = compose(source, distinctUntilChanged(
    (previous, current) => previous.toLowerCase() === current.toLowerCase(),
    (value) => {
      calls.push(value.revision);
      return value.name;
    }
  ));
  const events = collect({ subscribe }, result).events;
  return {
    calls,
    emitted: events.filter((event) => event.type === 'next').map((event) => event.value.revision),
  };
};

const distinctUntilKeyChangedTrace = ({ of, subscribe, compose, distinctUntilKeyChanged }) => {
  const source = of(
    { name: 'Foo1', age: 1 },
    { name: 'Foo2', age: 2 },
    { name: 'Bar', age: 3 },
    { name: 'Bar2', age: 4 },
    { name: 'Foo3', age: 5 }
  );
  const result = compose(source, distinctUntilKeyChanged('name', (previous, current) =>
    previous.slice(0, 3) === current.slice(0, 3)
  ));
  return collect({ subscribe }, result).events
    .filter((event) => event.type === 'next')
    .map((event) => event.value.age);
};

for (const [name, trace] of Object.entries({
  tapCompleteTimingTrace,
  tapExplicitUnsubscribeTrace,
  tapNextErrorTrace,
  scanNoSeedTrace,
  scanUndefinedSeedTrace,
  scanErrorTrace,
  reduceSeedTrace,
  reduceEmptyTrace,
  pairwiseTrace,
  distinctTrace,
  distinctKeyTrace,
  distinctFlushTrace,
  nanDistinctnessTrace,
  distinctReentrantTrace,
  distinctKeySelectorTrace,
  distinctUntilKeyChangedTrace,
})) {
  test(`M05 ${name} matches RxJS 7.8.2`, () => {
    assert.deepEqual(trace(adapters.pureFp), trace(adapters.rxjs));
  });
}
