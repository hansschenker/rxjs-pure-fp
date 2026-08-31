import assert from 'node:assert/strict';
import test from 'node:test';

import { flatMap, mergeMap as compatMergeMap } from '../../src/compat/flattening.ts';
import { subscribe } from '../../src/compat/observable.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { concatAll } from '../../src/kernel/operators/concat-all.ts';
import { map } from '../../src/kernel/operators/map.ts';
import { mergeAll } from '../../src/kernel/operators/merge-all.ts';
import { mergeMap } from '../../src/kernel/operators/merge-map.ts';
import { mergeScan } from '../../src/kernel/operators/merge-scan.ts';
import { switchAll } from '../../src/kernel/operators/switch-all.ts';
import { switchMap } from '../../src/kernel/operators/switch-map.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';

const collect = (source) => {
  const events = [];
  subscribe({
    next: (value) => events.push({ type: 'next', value }),
    error: (error) => events.push({ type: 'error', message: error.message }),
    complete: () => events.push({ type: 'complete' }),
  })(source);
  return events;
};

test('M08 operator algebra: concatAll equals mergeAll(1) and switchAll equals switchMap(identity)', () => {
  const higherOrder = () => of(of(1, 2), of(3, 4));
  assert.deepEqual(collect(concatAll()(higherOrder())), collect(mergeAll(1)(higherOrder())));
  assert.deepEqual(collect(switchAll()(higherOrder())), collect(switchMap((inner) => inner)(higherOrder())));
});

test('M08 flatMap is the same function as the compat mergeMap', () => {
  assert.equal(flatMap, compatMergeMap);
});

test('M08 deprecated resultSelector is map composition over the projected inner', () => {
  const selector = (outerValue, innerValue, outerIndex, innerIndex) =>
    `${outerValue}${innerValue}@${outerIndex}.${innerIndex}`;
  const source = of('a', 'b');
  const project = (value) => of(1, 2);

  const viaCompat = collect(compatMergeMap(project, selector)(source));
  const viaComposition = collect(
    mergeMap((value, index) =>
      map((innerValue, innerIndex) => selector(value, innerValue, index, innerIndex))(project(value, index))
    )(source)
  );
  assert.deepEqual(viaCompat, viaComposition);
});

test('M08 mergeScan state is independent per subscription', () => {
  const result = pipeValue(
    of(1, 2, 3),
    mergeScan((accumulated, value) => of(accumulated + value), 0)
  );
  const first = collect(result);
  const second = collect(result);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.filter((event) => event.type === 'next').map((event) => event.value),
    [1, 3, 6]
  );
});

test('M08 mergeScan threads the latest inner value into the next accumulation', () => {
  const accumulatorSaw = [];
  let outer;
  const source = createObservable((subscriber) => {
    outer = subscriber;
  });
  let innerA;

  subscribe({ next() {}, error() {}, complete() {} })(
    pipeValue(
      source,
      mergeScan((accumulated, value) => {
        accumulatorSaw.push(`${value}:${accumulated}`);
        return value === 'a'
          ? createObservable((subscriber) => {
              innerA = subscriber;
            })
          : of('done');
      }, 'seed')
    )
  );

  outer.next('a');
  innerA.next('s1');
  outer.next('b');

  assert.deepEqual(accumulatorSaw, ['a:seed', 'b:s1']);
});
