import assert from 'node:assert/strict';
import test from 'node:test';

import { subscribe } from '../../src/compat/observable.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { distinctUntilChanged } from '../../src/kernel/operators/distinct-until-changed.ts';
import { distinctUntilKeyChanged } from '../../src/kernel/operators/distinct-until-key-changed.ts';
import { filter } from '../../src/kernel/operators/filter.ts';
import { map } from '../../src/kernel/operators/map.ts';
import { pairwise } from '../../src/kernel/operators/pairwise.ts';
import { reduce } from '../../src/kernel/operators/reduce.ts';
import { scan } from '../../src/kernel/operators/scan.ts';
import {
  filterSink,
  fuseSinkTransformers,
  liftSinkTransformer,
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

test('F8 functor identity: map(id) is trace-equal to the source', () => {
  const source = of(1, 2, 3);
  assert.deepEqual(collect(map((value) => value)(source)), collect(source));
});

test('F8 functor composition: map(f) then map(g) equals map(g o f)', () => {
  const f = (value) => value + 1;
  const g = (value) => value * 10;
  const source = of(1, 2, 3);

  const piped = pipeValue(source, map(f), map(g));
  const composed = map((value) => g(f(value)))(source);
  assert.deepEqual(collect(piped), collect(composed));
});

test('F8 gate conjunction: fused filterSink(p) . filterSink(q) equals filterSink(p && q)', () => {
  const calls = [];
  const p = (value) => (calls.push(`p:${value}`), value % 2 === 0);
  const q = (value) => (calls.push(`q:${value}`), value > 2);
  const source = of(1, 2, 3, 4);

  const fused = liftSinkTransformer(fuseSinkTransformers(filterSink(p), filterSink(q)))(source);
  const fusedEvents = collect(fused);
  const fusedCalls = calls.splice(0);

  const conjoined = liftSinkTransformer(filterSink((value) => p(value) && q(value)))(source);
  const conjoinedEvents = collect(conjoined);
  const conjoinedCalls = calls.splice(0);

  assert.deepEqual(fusedEvents, conjoinedEvents);
  assert.deepEqual(fusedCalls, conjoinedCalls);
});

test('F8 accumulation policy: on non-empty sources reduce equals the last scan emission', () => {
  const add = (accumulated, value) => accumulated + value;
  const source = of(1, 2, 3);

  for (const [scanned, reduced] of [
    [scan(add, 10)(source), reduce(add, 10)(source)],
    [scan(add)(source), reduce(add)(source)],
  ]) {
    const scanNexts = collect(scanned).filter((event) => event.type === 'next');
    assert.deepEqual(collect(reduced), [scanNexts[scanNexts.length - 1], { type: 'complete' }]);
  }
});

test('F8 accumulation policy boundary: empty seeded source is where reduce and scan diverge', () => {
  const add = (accumulated, value) => accumulated + value;
  const empty = of();

  assert.deepEqual(collect(scan(add, 10)(empty)), [{ type: 'complete' }]);
  assert.deepEqual(collect(reduce(add, 10)(empty)), [
    { type: 'next', value: 10 },
    { type: 'complete' },
  ]);
});

test('F8 operator algebra: distinctUntilKeyChanged is distinctUntilChanged over one key', () => {
  const source = of(
    { name: 'Foo1', age: 1 },
    { name: 'Foo2', age: 2 },
    { name: 'Bar', age: 3 },
    { name: 'Foo3', age: 4 }
  );
  const prefixCompare = (previous, current) => previous.slice(0, 3) === current.slice(0, 3);

  const derived = distinctUntilKeyChanged('name', prefixCompare)(source);
  const spelledOut = distinctUntilChanged((previous, current) =>
    prefixCompare(previous.name, current.name)
  )(source);
  assert.deepEqual(collect(derived), collect(spelledOut));
});

test('F8 operator algebra: pairwise derives from scan plus filter', () => {
  const source = of(1, 2, 3, 4);

  const direct = pairwise()(source);
  const derived = pipeValue(
    source,
    scan(([, previous], value) => [previous, value], [undefined, undefined]),
    filter((_pair, index) => index >= 1)
  );
  assert.deepEqual(collect(direct), collect(derived));
});
