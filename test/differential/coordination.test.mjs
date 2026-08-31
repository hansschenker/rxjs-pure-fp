import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Observable as RxObservable,
  combineLatest as rxCombineLatest,
  combineLatestWith as rxCombineLatestWith,
  concat as rxConcat,
  concatWith as rxConcatWith,
  forkJoin as rxForkJoin,
  merge as rxMerge,
  mergeWith as rxMergeWith,
  of as rxOf,
  race as rxRace,
  raceWith as rxRaceWith,
  withLatestFrom as rxWithLatestFrom,
  zip as rxZip,
  zipWith as rxZipWith,
} from 'rxjs';
import {
  combineLatest,
  concat,
  forkJoin,
  merge,
  race,
  withLatestFrom,
  zip,
} from '../../src/compat/coordination.ts';
import { subscribe } from '../../src/compat/observable.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { combineLatestWith } from '../../src/kernel/operators/combine-latest-with.ts';
import { concatWith } from '../../src/kernel/operators/concat-with.ts';
import { mergeWith } from '../../src/kernel/operators/merge-with.ts';
import { raceWith } from '../../src/kernel/operators/race-with.ts';
import { zipWith } from '../../src/kernel/operators/zip-with.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';

const adapters = {
  rxjs: {
    create: (initializer) => new RxObservable(initializer),
    of: rxOf,
    subscribe: (observer) => (source) => source.subscribe(observer),
    compose: (source, ...operators) => operators.reduce((current, operator) => operator(current), source),
    merge: rxMerge,
    concat: rxConcat,
    combineLatest: rxCombineLatest,
    zip: rxZip,
    race: rxRace,
    forkJoin: rxForkJoin,
    withLatestFrom: rxWithLatestFrom,
    mergeWith: rxMergeWith,
    concatWith: rxConcatWith,
    combineLatestWith: rxCombineLatestWith,
    zipWith: rxZipWith,
    raceWith: rxRaceWith,
  },
  pureFp: {
    create: createObservable,
    of,
    subscribe,
    compose: pipeValue,
    merge,
    concat,
    combineLatest,
    zip,
    race,
    forkJoin,
    withLatestFrom,
    mergeWith,
    concatWith,
    combineLatestWith,
    zipWith,
    raceWith,
  },
};

const sourceHarness = (adapter) => {
  const events = [];
  const subscribers = {};
  const named = (key) =>
    adapter.create((subscriber) => {
      subscribers[key] = subscriber;
      events.push(`run:${key}`);
      return () => events.push(`teardown:${key}`);
    });
  const run = (result) =>
    adapter.subscribe({
      next: (value) => events.push({ next: value }),
      error: (error) => events.push(`error:${error.message}`),
      complete: () => events.push('complete'),
    })(result);
  return { events, subscribers, named, run };
};

const mergeCreationTrace = (adapter) => {
  const h = sourceHarness(adapter);
  h.run(adapter.merge(h.named('a'), h.named('b')));

  h.subscribers.a.next(1);
  h.subscribers.b.next(2);
  h.subscribers.a.next(3);
  h.subscribers.a.complete();
  h.subscribers.b.next(4);
  h.subscribers.b.complete();

  const single = adapter.of(1);
  return {
    events: h.events,
    singleIsSame: adapter.merge(single) === single,
    empty: (() => {
      const collected = [];
      adapter.subscribe({ complete: () => collected.push('complete') })(adapter.merge());
      return collected;
    })(),
  };
};

const mergeConcurrentCreationTrace = (adapter) => {
  const h = sourceHarness(adapter);
  h.run(adapter.merge(h.named('a'), h.named('b'), 1));

  h.subscribers.a.next(1);
  h.subscribers.a.complete();
  h.subscribers.b.next(2);
  h.subscribers.b.complete();

  return h.events;
};

const concatCreationTrace = (adapter) => {
  const h = sourceHarness(adapter);
  h.run(adapter.concat(h.named('a'), h.named('b')));

  h.subscribers.a.next(1);
  h.subscribers.a.complete();
  h.subscribers.b.next(2);
  h.subscribers.b.complete();

  return h.events;
};

const concatErrorTrace = (adapter) => {
  const h = sourceHarness(adapter);
  h.run(adapter.concat(h.named('a'), h.named('b')));

  h.subscribers.a.next(1);
  h.subscribers.a.error(new Error('concat-boom'));

  return h.events;
};

const combineLatestArrayTrace = (adapter) => {
  const h = sourceHarness(adapter);
  h.run(adapter.combineLatest([h.named('a'), h.named('b')]));

  h.subscribers.a.next(1);
  h.subscribers.a.next(2);
  h.subscribers.b.next(10);
  h.subscribers.a.next(3);
  h.subscribers.a.complete();
  h.subscribers.b.next(20);
  h.subscribers.b.complete();

  return h.events;
};

const combineLatestObjectTrace = (adapter) => {
  const h = sourceHarness(adapter);
  h.run(adapter.combineLatest({ x: h.named('a'), y: h.named('b') }));

  h.subscribers.a.next(1);
  h.subscribers.b.next(2);
  h.subscribers.a.next(3);
  h.subscribers.a.complete();
  h.subscribers.b.complete();

  return h.events;
};

const combineLatestEdgeTrace = (adapter) => {
  const emptyEvents = [];
  adapter.subscribe({
    next: (value) => emptyEvents.push({ next: value }),
    complete: () => emptyEvents.push('complete'),
  })(adapter.combineLatest([]));

  const h = sourceHarness(adapter);
  h.run(adapter.combineLatest([h.named('a'), h.named('b')]));
  h.subscribers.a.complete();
  h.subscribers.b.next(1);
  h.subscribers.b.complete();

  return { emptyEvents, events: h.events };
};

const combineLatestSelectorTrace = (adapter) => {
  const calls = [];
  const events = [];
  adapter.subscribe({
    next: (value) => events.push(value),
    complete: () => events.push('complete'),
  })(
    adapter.combineLatest(adapter.of(1, 2), adapter.of(10), (a, b) => {
      calls.push(`${a}|${b}`);
      return a + b;
    })
  );
  return { events, calls };
};

const zipTrace = (adapter) => {
  const h = sourceHarness(adapter);
  h.run(adapter.zip(h.named('a'), h.named('b')));

  h.subscribers.a.next(1);
  h.subscribers.a.next(2);
  h.subscribers.a.next(3);
  h.subscribers.b.next(10);
  h.subscribers.b.next(20);
  h.subscribers.a.complete();
  h.subscribers.b.next(30);

  return h.events;
};

const zipCompletionTrace = (adapter) => {
  const h = sourceHarness(adapter);
  h.run(adapter.zip(h.named('a'), h.named('b')));

  h.subscribers.a.next(1);
  h.subscribers.a.complete();
  h.subscribers.b.next(10);

  return h.events;
};

const zipFormsTrace = (adapter) => {
  const arrayForm = [];
  adapter.subscribe({
    next: (value) => arrayForm.push(value),
    complete: () => arrayForm.push('complete'),
  })(adapter.zip([adapter.of(1, 2), adapter.of('a', 'b', 'c')]));

  const selectorForm = [];
  adapter.subscribe({
    next: (value) => selectorForm.push(value),
    complete: () => selectorForm.push('complete'),
  })(adapter.zip(adapter.of(1, 2), adapter.of('a', 'b'), (n, s) => `${n}${s}`));

  return { arrayForm, selectorForm };
};

const raceTrace = (adapter) => {
  const h = sourceHarness(adapter);
  h.run(adapter.race(h.named('a'), h.named('b')));

  h.subscribers.b.next('b-wins');
  h.subscribers.b.next('b-again');
  h.subscribers.a.next('a-late');
  h.subscribers.b.complete();

  return h.events;
};

const raceSyncSettleTrace = (adapter) => {
  const h = sourceHarness(adapter);
  const instant = adapter.create((subscriber) => {
    h.events.push('run:instant');
    subscriber.complete();
    return () => h.events.push('teardown:instant');
  });
  h.run(adapter.race(instant, h.named('b')));

  return { events: h.events, laterSubscribed: 'b' in h.subscribers };
};

const raceIdentityTrace = (adapter) => {
  const single = adapter.of(1);
  return {
    singleIsSame: adapter.race(single) === single,
    raceWithNoOthersIsSame: adapter.compose(single, adapter.raceWith()) === single,
  };
};

const forkJoinTrace = (adapter) => {
  const h = sourceHarness(adapter);
  h.run(adapter.forkJoin([h.named('a'), h.named('b')]));

  h.subscribers.a.next(1);
  h.subscribers.a.next(2);
  h.subscribers.a.complete();
  h.subscribers.b.next(10);
  h.subscribers.b.complete();

  const dictEvents = [];
  adapter.subscribe({
    next: (value) => dictEvents.push(value),
    complete: () => dictEvents.push('complete'),
  })(adapter.forkJoin({ x: adapter.of(1, 2), y: adapter.of('z') }));

  return { events: h.events, dictEvents };
};

const forkJoinEmptySourceTrace = (adapter) => {
  const h = sourceHarness(adapter);
  h.run(adapter.forkJoin([h.named('a'), h.named('b')]));

  h.subscribers.a.next(1);
  h.subscribers.b.complete();

  return h.events;
};

const withLatestFromTrace = (adapter) => {
  const h = sourceHarness(adapter);
  h.run(adapter.compose(h.named('src'), adapter.withLatestFrom(h.named('other'))));

  h.subscribers.src.next(1);
  h.subscribers.other.next('x');
  h.subscribers.other.complete();
  h.subscribers.src.next(2);
  h.subscribers.src.complete();

  return h.events;
};

const withLatestFromProjectTrace = (adapter) => {
  const h = sourceHarness(adapter);
  h.run(
    adapter.compose(
      h.named('src'),
      adapter.withLatestFrom(h.named('o1'), h.named('o2'), (s, a, b) => `${s}|${a}|${b}`)
    )
  );

  h.subscribers.src.next('gated');
  h.subscribers.o1.next('a1');
  h.subscribers.src.next('still-gated');
  h.subscribers.o2.next('b1');
  h.subscribers.src.next('s1');
  h.subscribers.o1.next('a2');
  h.subscribers.src.next('s2');
  h.subscribers.src.complete();

  return h.events;
};

const withOperatorsSyncTrace = (adapter) => {
  const collectFrom = (result) => {
    const events = [];
    adapter.subscribe({
      next: (value) => events.push(value),
      complete: () => events.push('complete'),
    })(result);
    return events;
  };
  return {
    merge: collectFrom(adapter.compose(adapter.of(1, 2), adapter.mergeWith(adapter.of(3)))),
    concat: collectFrom(adapter.compose(adapter.of(1), adapter.concatWith(adapter.of(2), adapter.of(3)))),
    combineLatest: collectFrom(adapter.compose(adapter.of(1, 2), adapter.combineLatestWith(adapter.of('a')))),
    zip: collectFrom(adapter.compose(adapter.of(1, 2, 3), adapter.zipWith(adapter.of('a', 'b')))),
    race: collectFrom(adapter.compose(adapter.of('first'), adapter.raceWith(adapter.of('second')))),
  };
};

for (const [name, trace] of Object.entries({
  mergeCreationTrace,
  mergeConcurrentCreationTrace,
  concatCreationTrace,
  concatErrorTrace,
  combineLatestArrayTrace,
  combineLatestObjectTrace,
  combineLatestEdgeTrace,
  combineLatestSelectorTrace,
  zipTrace,
  zipCompletionTrace,
  zipFormsTrace,
  raceTrace,
  raceSyncSettleTrace,
  raceIdentityTrace,
  forkJoinTrace,
  forkJoinEmptySourceTrace,
  withLatestFromTrace,
  withLatestFromProjectTrace,
  withOperatorsSyncTrace,
})) {
  test(`M09 ${name} matches RxJS 7.8.2`, () => {
    assert.deepEqual(trace(adapters.pureFp), trace(adapters.rxjs));
  });
}
