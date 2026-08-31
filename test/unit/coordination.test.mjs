import assert from 'node:assert/strict';
import test from 'node:test';

import { subscribe } from '../../src/compat/observable.ts';
import { combineLatest } from '../../src/kernel/creation/combine-latest.ts';
import { concat } from '../../src/kernel/creation/concat.ts';
import { merge } from '../../src/kernel/creation/merge.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { race } from '../../src/kernel/creation/race.ts';
import { zip } from '../../src/kernel/creation/zip.ts';
import { createObservable, isBrandedObservable } from '../../src/kernel/observable.ts';
import { concatAll } from '../../src/kernel/operators/concat-all.ts';
import { mergeAll } from '../../src/kernel/operators/merge-all.ts';

const collect = (source) => {
  const events = [];
  subscribe({
    next: (value) => events.push({ type: 'next', value }),
    error: (error) => events.push({ type: 'error', message: error.message }),
    complete: () => events.push({ type: 'complete' }),
  })(source);
  return events;
};

test('M09 coordination algebra: merge and concat are flattening over an emission of sources', () => {
  const a = of(1, 2);
  const b = of(3);
  assert.deepEqual(collect(merge([a, b])), collect(mergeAll()(of(a, b))));
  assert.deepEqual(collect(concat([a, b])), collect(concatAll()(of(a, b))));
});

test('M09 single-source merge and race return the source itself', () => {
  const source = of(1);
  assert.equal(merge([source]), source);
  assert.equal(race([source]), source);
});

test('M09 zip buffers are independent per subscription', () => {
  const result = zip([of(1, 2, 3), of('a', 'b')]);
  const first = collect(result);
  const second = collect(result);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.filter((event) => event.type === 'next').map((event) => event.value),
    [[1, 'a'], [2, 'b']]
  );
});

test('M09 combineLatest snapshots are fresh arrays per emission', () => {
  const emissions = collect(combineLatest([of(1, 2), of('x')]))
    .filter((event) => event.type === 'next')
    .map((event) => event.value);
  assert.deepEqual(emissions, [[2, 'x']]);
  assert.notEqual(emissions[0], collect(combineLatest([of(1, 2), of('x')]))[0].value);
});

test('M09 kernel-created observables are branded; raw functions are not', () => {
  assert.equal(isBrandedObservable(of(1)), true);
  assert.equal(isBrandedObservable(createObservable((subscriber) => subscriber.complete())), true);
  assert.equal(isBrandedObservable((subscriber) => subscriber.complete()), false);
  assert.equal(isBrandedObservable(42), false);
});
