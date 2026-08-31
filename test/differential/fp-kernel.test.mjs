import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Observable as RxObservable,
  Subscriber as RxSubscriber,
  distinctUntilChanged as rxDistinctUntilChanged,
  filter as rxFilter,
  map as rxMap,
  of as rxOf,
  pairwise as rxPairwise,
  reduce as rxReduce,
  scan as rxScan,
} from 'rxjs';
import { subscribe } from '../../src/compat/observable.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { createSubscriber } from '../../src/kernel/sink.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { distinctUntilChanged } from '../../src/kernel/operators/distinct-until-changed.ts';
import { filter } from '../../src/kernel/operators/filter.ts';
import { map } from '../../src/kernel/operators/map.ts';
import { pairwise } from '../../src/kernel/operators/pairwise.ts';
import { reduce } from '../../src/kernel/operators/reduce.ts';
import { scan } from '../../src/kernel/operators/scan.ts';
import {
  filterSink,
  fuseSinkTransformers,
  liftSinkTransformer,
  mapSink,
} from '../../src/kernel/sink-transformer.ts';

const adapters = {
  rxjs: {
    create: (initializer) => new RxObservable(initializer),
    of: rxOf,
    subscribe: (observer) => (source) => source.subscribe(observer),
    compose: (source, ...operators) => operators.reduce((current, operator) => operator(current), source),
    createSubscriber: (destination) => new RxSubscriber(destination),
    map: rxMap,
    filter: rxFilter,
    scan: rxScan,
    reduce: rxReduce,
    pairwise: rxPairwise,
    distinctUntilChanged: rxDistinctUntilChanged,
    mapFilterFused: (project, predicate) => (source) => rxFilter(predicate)(rxMap(project)(source)),
  },
  kernel: {
    create: createObservable,
    of,
    subscribe,
    compose: pipeValue,
    createSubscriber,
    map,
    filter,
    scan,
    reduce,
    pairwise,
    distinctUntilChanged,
    mapFilterFused: (project, predicate) =>
      liftSinkTransformer(fuseSinkTransformers(mapSink(project), filterSink(predicate))),
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

const pipelineTrace = ({ of, map, filter, compose, subscribe }) => {
  const result = compose(
    of(1, 2, 3),
    map((value) => value * 10),
    filter((value) => value > 10)
  );
  const { events, subscription } = collect({ subscribe }, result);
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
    runs.push(collect({ subscribe }, result).events);
  }
  return runs;
};

const mapErrorTrace = ({ of, map, compose, subscribe }) => {
  const result = compose(
    of(1, 2, 3),
    map((value) => {
      if (value === 2) throw new Error('map-boom');
      return value * 10;
    })
  );
  return collect({ subscribe }, result).events;
};

const filterErrorTrace = ({ of, filter, compose, subscribe }) => {
  const result = compose(
    of(1, 2, 3),
    filter((value) => {
      if (value === 2) throw new Error('filter-boom');
      return true;
    })
  );
  return collect({ subscribe }, result).events;
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
  return { events, same: returned === subscriber, closed: returned.closed };
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

const fusedSinkPipelineTrace = ({ of, compose, subscribe, mapFilterFused }) => {
  const result = compose(of(1, 2, 3), mapFilterFused((value) => value * 10, (value) => value > 10));
  const { events, subscription } = collect({ subscribe }, result);
  return { events, closed: subscription.closed };
};

const fusedSinkErrorTrace = ({ of, compose, subscribe, mapFilterFused }) => {
  const result = compose(
    of(1, 2, 3),
    mapFilterFused((value) => {
      if (value === 2) throw new Error('fused-boom');
      return value * 10;
    }, (value) => value > 10)
  );
  return collect({ subscribe }, result).events;
};

const scanNoSeedTrace = ({ of, scan, compose, subscribe }) => {
  const indexes = [];
  const result = compose(of(1, 2, 3), scan((accumulated, value, index) => {
    indexes.push(index);
    return accumulated + value;
  }));
  return { events: collect({ subscribe }, result).events, indexes };
};

const scanUndefinedSeedTrace = ({ of, scan, compose, subscribe }) => {
  const indexes = [];
  const result = compose(of(1, 2, 3), scan((accumulated, value, index) => {
    indexes.push(index);
    return (accumulated ?? 0) + value;
  }, undefined));
  return { events: collect({ subscribe }, result).events, indexes };
};

const scanErrorTrace = ({ of, scan, compose, subscribe }) => {
  const result = compose(of(1, 2, 3), scan((accumulated, value) => {
    if (value === 2) throw new Error('scan-boom');
    return accumulated + value;
  }, 0));
  return collect({ subscribe }, result).events;
};

const reduceSeedTrace = ({ of, reduce, compose, subscribe }) => {
  const noSeedIndexes = [];
  const seedIndexes = [];
  const noSeed = compose(of(1, 2, 3), reduce((accumulated, value, index) => {
    noSeedIndexes.push(index);
    return accumulated + value;
  }));
  const seeded = compose(of(1, 2, 3), reduce((accumulated, value, index) => {
    seedIndexes.push(index);
    return accumulated + value;
  }, 0));
  return {
    noSeed: collect({ subscribe }, noSeed).events,
    seeded: collect({ subscribe }, seeded).events,
    noSeedIndexes,
    seedIndexes,
  };
};

const reduceEmptyTrace = ({ of, reduce, compose, subscribe }) => ({
  noSeed: collect({ subscribe }, compose(of(), reduce((accumulated, value) => accumulated + value))).events,
  undefinedSeed: collect({ subscribe }, compose(of(), reduce((accumulated, value) => accumulated ?? value, undefined))).events,
});

const pairwiseFreshStateTrace = ({ of, pairwise, compose, subscribe }) => {
  const result = compose(of(1, 2, 3), pairwise());
  return [collect({ subscribe }, result).events, collect({ subscribe }, result).events];
};

const distinctReentrantTrace = ({ create, distinctUntilChanged, compose, subscribe }) => {
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

const distinctKeySelectorTrace = ({ of, distinctUntilChanged, compose, subscribe }) => {
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

const nanConsecutiveTrace = ({ of, distinctUntilChanged, compose, subscribe }) => {
  const events = collect({ subscribe }, compose(of(NaN, NaN, NaN), distinctUntilChanged())).events;
  return events.filter((event) => event.type === 'next').length;
};

for (const [name, trace] of Object.entries({
  pipelineTrace,
  indexResetTrace,
  mapErrorTrace,
  filterErrorTrace,
  synchronousCancellationTrace,
  downstreamThrowTrace,
  fusedSinkPipelineTrace,
  fusedSinkErrorTrace,
  scanNoSeedTrace,
  scanUndefinedSeedTrace,
  scanErrorTrace,
  reduceSeedTrace,
  reduceEmptyTrace,
  pairwiseFreshStateTrace,
  distinctReentrantTrace,
  distinctKeySelectorTrace,
  nanConsecutiveTrace,
})) {
  test(`F2/F3 ${name}: kernel operators match RxJS 7.8.2`, () => {
    assert.deepEqual(trace(adapters.kernel), trace(adapters.rxjs));
  });
}
