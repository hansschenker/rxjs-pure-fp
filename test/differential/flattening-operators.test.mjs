import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMPTY as RX_EMPTY,
  Observable as RxObservable,
  concatAll as rxConcatAll,
  concatMap as rxConcatMap,
  concatMapTo as rxConcatMapTo,
  exhaustAll as rxExhaustAll,
  exhaustMap as rxExhaustMap,
  expand as rxExpand,
  flatMap as rxFlatMap,
  mergeAll as rxMergeAll,
  mergeMap as rxMergeMap,
  mergeMapTo as rxMergeMapTo,
  mergeScan as rxMergeScan,
  of as rxOf,
  switchAll as rxSwitchAll,
  switchMap as rxSwitchMap,
  switchMapTo as rxSwitchMapTo,
  switchScan as rxSwitchScan,
} from 'rxjs';
import {
  concatMap,
  concatMapTo,
  exhaustMap,
  flatMap,
  mergeMap,
  mergeMapTo,
  switchMap,
  switchMapTo,
} from '../../src/compat/flattening.ts';
import { subscribe } from '../../src/compat/observable.ts';
import { EMPTY } from '../../src/kernel/creation/empty.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { concatAll } from '../../src/kernel/operators/concat-all.ts';
import { exhaustAll } from '../../src/kernel/operators/exhaust-all.ts';
import { expand } from '../../src/kernel/operators/expand.ts';
import { mergeAll } from '../../src/kernel/operators/merge-all.ts';
import { mergeScan } from '../../src/kernel/operators/merge-scan.ts';
import { switchAll } from '../../src/kernel/operators/switch-all.ts';
import { switchScan } from '../../src/kernel/operators/switch-scan.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';

const adapters = {
  rxjs: {
    create: (initializer) => new RxObservable(initializer),
    of: rxOf,
    empty: RX_EMPTY,
    subscribe: (observer) => (source) => source.subscribe(observer),
    compose: (source, ...operators) => operators.reduce((current, operator) => operator(current), source),
    mergeMap: rxMergeMap,
    flatMap: rxFlatMap,
    concatMap: rxConcatMap,
    switchMap: rxSwitchMap,
    exhaustMap: rxExhaustMap,
    mergeAll: rxMergeAll,
    concatAll: rxConcatAll,
    switchAll: rxSwitchAll,
    exhaustAll: rxExhaustAll,
    mergeMapTo: rxMergeMapTo,
    concatMapTo: rxConcatMapTo,
    switchMapTo: rxSwitchMapTo,
    mergeScan: rxMergeScan,
    switchScan: rxSwitchScan,
    expand: rxExpand,
  },
  pureFp: {
    create: createObservable,
    of,
    empty: EMPTY,
    subscribe,
    compose: pipeValue,
    mergeMap,
    flatMap,
    concatMap,
    switchMap,
    exhaustMap,
    mergeAll,
    concatAll,
    switchAll,
    exhaustAll,
    mergeMapTo,
    concatMapTo,
    switchMapTo,
    mergeScan,
    switchScan,
    expand,
  },
};

const collect = (adapter, source) => {
  const events = [];
  adapter.subscribe({
    next: (value) => events.push({ type: 'next', value }),
    error: (error) => events.push({ type: 'error', message: error.message }),
    complete: () => events.push({ type: 'complete' }),
  })(source);
  return events;
};

const allOperatorsSyncTrace = (adapter) => {
  const higherOrder = () => adapter.of(adapter.of(1, 2), adapter.of(3, 4));
  return {
    merge: collect(adapter, adapter.compose(higherOrder(), adapter.mergeAll())),
    concat: collect(adapter, adapter.compose(higherOrder(), adapter.concatAll())),
    switch: collect(adapter, adapter.compose(higherOrder(), adapter.switchAll())),
    exhaust: collect(adapter, adapter.compose(higherOrder(), adapter.exhaustAll())),
  };
};

const innerHarness = (adapter) => {
  const events = [];
  const inners = {};
  const makeInner = (key) =>
    adapter.create((subscriber) => {
      inners[key] = subscriber;
      events.push(`inner-run:${key}`);
      return () => events.push(`inner-teardown:${key}`);
    });
  let outer;
  const source = adapter.create((subscriber) => {
    outer = subscriber;
    return () => events.push('outer-teardown');
  });
  const run = (operator) =>
    adapter.subscribe({
      next: (value) => events.push(`next:${value}`),
      error: (error) => events.push(`error:${error.message}`),
      complete: () => events.push('complete'),
    })(adapter.compose(source, operator));
  return { events, inners, makeInner, run, outer: () => outer };
};

const mergeAllConcurrentTrace = (adapter) => {
  const h = innerHarness(adapter);
  h.run(adapter.mergeAll(1));

  h.outer().next(h.makeInner('a'));
  h.outer().next(h.makeInner('b'));
  h.inners.a.next(1);
  h.inners.a.complete();
  h.inners.b.next(2);
  h.outer().complete();
  h.inners.b.complete();

  return h.events;
};

const switchAllCancelTrace = (adapter) => {
  const h = innerHarness(adapter);
  h.run(adapter.switchAll());

  h.outer().next(h.makeInner('a'));
  h.inners.a.next(1);
  h.outer().next(h.makeInner('b'));
  h.inners.b.next(2);
  h.outer().complete();
  h.inners.b.complete();

  return h.events;
};

const exhaustAllIgnoreTrace = (adapter) => {
  const h = innerHarness(adapter);
  h.run(adapter.exhaustAll());

  h.outer().next(h.makeInner('a'));
  h.outer().next(h.makeInner('ignored'));
  h.inners.a.next(1);
  h.inners.a.complete();
  h.outer().next(h.makeInner('c'));
  h.inners.c.next(2);
  h.outer().complete();
  h.inners.c.complete();

  return h.events;
};

const mergeMapSelectorTrace = (adapter) => {
  const calls = [];
  const events = collect(
    adapter,
    adapter.compose(
      adapter.of('a', 'b'),
      adapter.mergeMap(
        (value) => adapter.of(1, 2),
        (outerValue, innerValue, outerIndex, innerIndex) => {
          calls.push(`${outerValue}:${innerValue}@${outerIndex}.${innerIndex}`);
          return `${outerValue}${innerValue}`;
        }
      )
    )
  );
  return { events, calls };
};

const mergeMapConcurrentArgTrace = (adapter) => {
  const h = innerHarness(adapter);
  h.run(adapter.mergeMap((key) => h.makeInner(key), 1));

  h.outer().next('a');
  h.outer().next('b');
  h.inners.a.next(1);
  h.inners.a.complete();
  h.inners.b.next(2);
  h.outer().complete();
  h.inners.b.complete();

  return h.events;
};

const concatMapSelectorTrace = (adapter) => {
  const calls = [];
  const events = collect(
    adapter,
    adapter.compose(
      adapter.of('x', 'y'),
      adapter.concatMap(
        () => adapter.of(1, 2),
        (outerValue, innerValue, outerIndex, innerIndex) => {
          calls.push(`${outerValue}:${innerValue}@${outerIndex}.${innerIndex}`);
          return `${outerValue}${innerValue}`;
        }
      )
    )
  );
  return { events, calls };
};

const switchMapSelectorTrace = (adapter) => {
  const h = innerHarness(adapter);
  const calls = [];
  h.run(
    adapter.switchMap(
      (key) => h.makeInner(key),
      (outerValue, innerValue, outerIndex, innerIndex) => {
        calls.push(`${outerValue}:${innerValue}@${outerIndex}.${innerIndex}`);
        return `${outerValue}${innerValue}`;
      }
    )
  );

  h.outer().next('a');
  h.inners.a.next(1);
  h.outer().next('b');
  h.inners.b.next(1);
  h.inners.b.next(2);
  h.outer().complete();
  h.inners.b.complete();

  return { events: h.events, calls };
};

const exhaustMapSelectorTrace = (adapter) => {
  const calls = [];
  const events = collect(
    adapter,
    adapter.compose(
      adapter.of('a', 'b'),
      adapter.exhaustMap(
        () => adapter.of(1, 2),
        (outerValue, innerValue, outerIndex, innerIndex) => {
          calls.push(`${outerValue}:${innerValue}@${outerIndex}.${innerIndex}`);
          return `${outerValue}${innerValue}`;
        }
      )
    )
  );
  return { events, calls };
};

const flatMapAliasTrace = (adapter) => ({
  sameReference: adapter.flatMap === adapter.mergeMap,
  events: collect(
    adapter,
    adapter.compose(adapter.of(1, 2), adapter.flatMap((value) => adapter.of(value * 10)))
  ),
});

const mapToTrace = (adapter) => {
  let runs = 0;
  const inner = adapter.create((subscriber) => {
    runs += 1;
    subscriber.next(`run-${runs}`);
    subscriber.complete();
  });
  return {
    merge: collect(adapter, adapter.compose(adapter.of('a', 'b'), adapter.mergeMapTo(inner))),
    concat: collect(adapter, adapter.compose(adapter.of('a', 'b'), adapter.concatMapTo(inner))),
    switch: collect(adapter, adapter.compose(adapter.of('a', 'b'), adapter.switchMapTo(inner))),
    runs,
  };
};

const mergeMapToSelectorTrace = (adapter) => {
  const calls = [];
  const events = collect(
    adapter,
    adapter.compose(
      adapter.of('a', 'b'),
      adapter.mergeMapTo(adapter.of(1, 2), (outerValue, innerValue, outerIndex, innerIndex) => {
        calls.push(`${outerValue}:${innerValue}@${outerIndex}.${innerIndex}`);
        return `${outerValue}${innerValue}`;
      })
    )
  );
  return { events, calls };
};

const mergeScanSyncTrace = (adapter) => {
  const indexes = [];
  return {
    running: collect(
      adapter,
      adapter.compose(
        adapter.of(1, 2, 3),
        adapter.mergeScan((accumulated, value, index) => {
          indexes.push(index);
          return adapter.of(accumulated + value);
        }, 0)
      )
    ),
    multiValueInners: collect(
      adapter,
      adapter.compose(
        adapter.of(1, 2),
        adapter.mergeScan((accumulated, value) => adapter.of(accumulated + value, accumulated + value * 10), 0)
      )
    ),
    indexes,
  };
};

const mergeScanInterleavedTrace = (adapter) => {
  const h = innerHarness(adapter);
  const states = [];
  h.run(
    adapter.mergeScan((accumulated, value) => {
      states.push(`acc:${accumulated}<-${value}`);
      return h.makeInner(value);
    }, 'seed')
  );

  h.outer().next('a');
  h.outer().next('b');
  h.inners.a.next('s1');
  h.inners.b.next('s2');
  h.outer().next('c');
  h.inners.a.complete();
  h.inners.b.complete();
  h.inners.c.complete();
  h.outer().complete();

  return { events: h.events, states };
};

const switchScanTrace = (adapter) => {
  const h = innerHarness(adapter);
  const states = [];
  h.run(
    adapter.switchScan((accumulated, value) => {
      states.push(`acc:${accumulated}<-${value}`);
      return h.makeInner(value);
    }, 'seed')
  );

  h.outer().next('a');
  h.inners.a.next('s1');
  h.outer().next('b');
  h.inners.b.next('s2');
  h.outer().complete();
  h.inners.b.complete();

  return { events: h.events, states };
};

const expandTrace = (adapter) => ({
  doubling: collect(
    adapter,
    adapter.compose(
      adapter.of(1),
      adapter.expand((value) => (value < 8 ? adapter.of(value * 2) : adapter.empty))
    )
  ),
  emptySource: collect(adapter, adapter.compose(adapter.of(), adapter.expand(() => adapter.of(1)))),
});

const expandConcurrentTrace = (adapter) => {
  const indexes = [];
  const project = (value, index) => {
    indexes.push(`${value}@${index}`);
    return value < 4 ? adapter.of(value * 2, value * 2 + 1) : adapter.empty;
  };
  const bounded = collect(adapter, adapter.compose(adapter.of(1), adapter.expand(project, 1)));
  const boundedIndexes = indexes.splice(0);
  const normalized = collect(adapter, adapter.compose(adapter.of(1), adapter.expand(project, 0)));
  return { bounded, boundedIndexes, normalized };
};

for (const [name, trace] of Object.entries({
  allOperatorsSyncTrace,
  mergeAllConcurrentTrace,
  switchAllCancelTrace,
  exhaustAllIgnoreTrace,
  mergeMapSelectorTrace,
  mergeMapConcurrentArgTrace,
  concatMapSelectorTrace,
  switchMapSelectorTrace,
  exhaustMapSelectorTrace,
  flatMapAliasTrace,
  mapToTrace,
  mergeMapToSelectorTrace,
  mergeScanSyncTrace,
  mergeScanInterleavedTrace,
  switchScanTrace,
  expandTrace,
  expandConcurrentTrace,
})) {
  test(`M08 ${name} matches RxJS 7.8.2`, () => {
    assert.deepEqual(trace(adapters.pureFp), trace(adapters.rxjs));
  });
}
