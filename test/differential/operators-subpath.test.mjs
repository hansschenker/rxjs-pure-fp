import assert from 'node:assert/strict';
import test from 'node:test';

import { of as rxOf, onErrorResumeNextWith as rxOnErrorResumeNextWith, queueScheduler as rxQueue } from 'rxjs';
import {
  combineLatest as rxCombineLatestOp,
  concat as rxConcatOp,
  map as rxMap,
  merge as rxMergeOp,
  onErrorResumeNext as rxOnErrorResumeNextOp,
  partition as rxPartitionOp,
  race as rxRaceOp,
  zip as rxZipOp,
} from 'rxjs/operators';
import {
  combineLatest as combineLatestOp,
  concat as concatOp,
  merge as mergeOp,
  onErrorResumeNext as onErrorResumeNextOp,
  partition as partitionOp,
  race as raceOp,
  zip as zipOp,
} from '../../src/compat/legacy-operators.ts';
import { subscribe } from '../../src/compat/observable.ts';
import { onErrorResumeNextWith } from '../../src/compat/on-error-resume-next.ts';
import { of } from '../../src/compat/scheduler-args.ts';
import { map } from '../../src/kernel/operators/map.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { queueScheduler } from '../../src/kernel/scheduler.ts';

const adapters = {
  rxjs: {
    of: rxOf,
    queue: rxQueue,
    map: rxMap,
    apply: (source, ...operators) => source.pipe(...operators),
    subscribe: (observer) => (source) => source.subscribe(observer),
    combineLatest: rxCombineLatestOp,
    concat: rxConcatOp,
    merge: rxMergeOp,
    zip: rxZipOp,
    race: rxRaceOp,
    partition: rxPartitionOp,
    onErrorResumeNextAliased: rxOnErrorResumeNextOp === rxOnErrorResumeNextWith,
  },
  pureFp: {
    of,
    queue: queueScheduler,
    map,
    apply: (source, ...operators) => pipeValue(source, ...operators),
    subscribe,
    combineLatest: combineLatestOp,
    concat: concatOp,
    merge: mergeOp,
    zip: zipOp,
    race: raceOp,
    partition: partitionOp,
    onErrorResumeNextAliased: onErrorResumeNextOp === onErrorResumeNextWith,
  },
};

const collect = (adapter, source) => {
  const log = [];
  adapter.subscribe({
    next: (value) => log.push(value),
    error: (error) => log.push(`E:${error.message}`),
    complete: () => log.push('C'),
  })(source);
  return log;
};

const operatorFormsTrace = (adapter) => {
  const [evens, odds] = adapter.apply(adapter.of(1, 2, 3, 4), adapter.partition((value) => value % 2 === 0));
  const context = { limit: 2 };
  const [small, large] = adapter.apply(
    adapter.of(1, 2, 3),
    adapter.partition(function bound(value) {
      return value <= this.limit;
    }, context)
  );
  return {
    combineLatest: collect(adapter, adapter.apply(adapter.of(1, 2), adapter.combineLatest(adapter.of('a')))),
    combineLatestSelector: collect(
      adapter,
      adapter.apply(adapter.of(1, 2), adapter.combineLatest(adapter.of(10), (x, y) => x + y))
    ),
    concat: collect(adapter, adapter.apply(adapter.of(1), adapter.concat(adapter.of(2), adapter.of(3)))),
    concatScheduler: collect(adapter, adapter.apply(adapter.of(1), adapter.concat(adapter.of(2), adapter.queue))),
    merge: collect(adapter, adapter.apply(adapter.of(1), adapter.merge(adapter.of(2)))),
    mergeConcurrentScheduler: collect(
      adapter,
      adapter.apply(adapter.of(1), adapter.merge(adapter.of(2), adapter.of(3), 1, adapter.queue))
    ),
    zip: collect(adapter, adapter.apply(adapter.of(1, 2, 3), adapter.zip(adapter.of('a', 'b')))),
    zipSelector: collect(adapter, adapter.apply(adapter.of(1, 2), adapter.zip(adapter.of(10, 20), (x, y) => x * y))),
    race: collect(adapter, adapter.apply(adapter.of('first'), adapter.race(adapter.of('second')))),
    raceArray: collect(adapter, adapter.apply(adapter.of('first'), adapter.race([adapter.of('second')]))),
    partition: [collect(adapter, evens), collect(adapter, odds)],
    partitionThisArg: [collect(adapter, small), collect(adapter, large)],
    onErrorResumeNextAliased: adapter.onErrorResumeNextAliased,
  };
};

test('M19 rxjs/operators operator forms match RxJS 7.8.2', () => {
  assert.deepEqual(operatorFormsTrace(adapters.pureFp), operatorFormsTrace(adapters.rxjs));
});
