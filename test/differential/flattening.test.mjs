import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Observable as RxObservable,
  concatMap as rxConcatMap,
  exhaustMap as rxExhaustMap,
  mergeMap as rxMergeMap,
  of as rxOf,
  switchMap as rxSwitchMap,
} from 'rxjs';
import { subscribe } from '../../src/compat/observable.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { EMPTY } from '../../src/kernel/creation/empty.ts';
import {
  exhaustPolicy,
  flattenWith,
  latestPolicy,
  overlapPolicy,
  queuePolicy,
} from '../../src/kernel/flattening.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';

const adapters = {
  rxjs: {
    create: (initializer) => new RxObservable(initializer),
    of: rxOf,
    empty: rxOf(),
    subscribe: (observer) => (source) => source.subscribe(observer),
    compose: (source, ...operators) => operators.reduce((current, operator) => operator(current), source),
    mergeMap: (project, concurrent) =>
      concurrent === undefined ? rxMergeMap(project) : rxMergeMap(project, concurrent),
    concatMap: rxConcatMap,
    switchMap: rxSwitchMap,
    exhaustMap: rxExhaustMap,
  },
  pureFp: {
    create: createObservable,
    of,
    empty: EMPTY,
    subscribe,
    compose: pipeValue,
    mergeMap: (project, concurrent) =>
      flattenWith(overlapPolicy(concurrent === undefined ? Infinity : concurrent), project),
    concatMap: (project) => flattenWith(queuePolicy, project),
    switchMap: (project) => flattenWith(latestPolicy, project),
    exhaustMap: (project) => flattenWith(exhaustPolicy, project),
  },
};

const harness = (adapter) => {
  const events = [];
  const inners = {};
  let outer;
  const source = adapter.create((subscriber) => {
    outer = subscriber;
    events.push('outer-run');
    return () => events.push('outer-teardown');
  });
  const project = (value, index) => {
    events.push(`project:${value}@${index}`);
    return adapter.create((subscriber) => {
      inners[value] = subscriber;
      events.push(`inner-run:${value}`);
      return () => events.push(`inner-teardown:${value}`);
    });
  };
  const run = (operator) => {
    const subscription = adapter.subscribe({
      next: (value) => events.push(`next:${value}`),
      error: (error) => events.push(`error:${error.message}`),
      complete: () => events.push('complete'),
    })(adapter.compose(source, operator));
    return subscription;
  };
  return {
    events,
    inners,
    project,
    run,
    outer: () => outer,
  };
};

const mergeOverlapTrace = (adapter) => {
  const h = harness(adapter);
  h.run(adapter.mergeMap(h.project));

  h.outer().next('a');
  h.outer().next('b');
  h.inners.a.next(1);
  h.inners.b.next(2);
  h.inners.a.next(3);
  h.outer().complete();
  h.inners.a.complete();
  h.inners.b.next(4);
  h.inners.b.complete();

  return h.events;
};

const mergeConcurrentTrace = (adapter) => {
  const h = harness(adapter);
  h.run(adapter.mergeMap(h.project, 2));

  h.outer().next('a');
  h.outer().next('b');
  h.outer().next('c');
  h.inners.a.next(1);
  h.inners.a.complete();
  h.inners.c.next(2);
  h.outer().complete();
  h.inners.b.complete();
  h.inners.c.complete();

  return h.events;
};

const mergeSyncTrace = (adapter) => {
  const events = [];
  adapter.subscribe({
    next: (value) => events.push(`next:${value}`),
    complete: () => events.push('complete'),
  })(adapter.compose(adapter.of(1, 2), adapter.mergeMap((value) => adapter.of(value * 10, value * 10 + 1))));
  return events;
};

const mergeProjectThrowTrace = (adapter) => {
  const h = harness(adapter);
  h.run(adapter.mergeMap((value, index) => {
    if (value === 'b') throw new Error('project-boom');
    return h.project(value, index);
  }));

  h.outer().next('a');
  h.outer().next('b');

  return h.events;
};

const mergeEmptyInnerTrace = (adapter) => {
  const events = [];
  adapter.subscribe({
    next: (value) => events.push(`next:${value}`),
    complete: () => events.push('complete'),
  })(adapter.compose(adapter.of(1, 2, 3), adapter.mergeMap(() => adapter.empty)));
  return events;
};

const mergeOuterErrorTrace = (adapter) => {
  const h = harness(adapter);
  h.run(adapter.mergeMap(h.project));

  h.outer().next('a');
  h.inners.a.next(1);
  h.outer().error(new Error('outer-boom'));

  return h.events;
};

const concatQueueTrace = (adapter) => {
  const h = harness(adapter);
  h.run(adapter.concatMap(h.project));

  h.outer().next('a');
  h.outer().next('b');
  h.outer().next('c');
  h.inners.a.next(1);
  h.inners.a.complete();
  h.inners.b.next(2);
  h.outer().complete();
  h.inners.b.complete();
  h.inners.c.next(3);
  h.inners.c.complete();

  return h.events;
};

const concatDrainThrowTrace = (adapter) => {
  const h = harness(adapter);
  h.run(adapter.concatMap((value, index) => {
    if (value === 'b') throw new Error('drain-boom');
    return h.project(value, index);
  }));

  h.outer().next('a');
  h.outer().next('b');
  h.inners.a.complete();

  return h.events;
};

const concatSyncTrace = (adapter) => {
  const events = [];
  adapter.subscribe({
    next: (value) => events.push(`next:${value}`),
    complete: () => events.push('complete'),
  })(adapter.compose(adapter.of(1, 2), adapter.concatMap((value) => adapter.of(value * 10, value * 10 + 1))));
  return events;
};

const switchCancelTrace = (adapter) => {
  const h = harness(adapter);
  const subscription = h.run(adapter.switchMap(h.project));

  h.outer().next('a');
  h.inners.a.next(1);
  h.outer().next('b');
  h.inners.b.next(2);
  h.outer().complete();
  h.inners.b.next(3);
  h.inners.b.complete();

  return { events: h.events, closed: subscription.closed };
};

const switchInnerErrorTrace = (adapter) => {
  const h = harness(adapter);
  h.run(adapter.switchMap(h.project));

  h.outer().next('a');
  h.inners.a.error(new Error('inner-boom'));

  return h.events;
};

const switchSyncTrace = (adapter) => {
  const events = [];
  adapter.subscribe({
    next: (value) => events.push(`next:${value}`),
    complete: () => events.push('complete'),
  })(adapter.compose(adapter.of(1, 2), adapter.switchMap((value) => adapter.of(value * 10, value * 10 + 1))));
  return events;
};

const switchUnsubscribeTrace = (adapter) => {
  const h = harness(adapter);
  const subscription = h.run(adapter.switchMap(h.project));

  h.outer().next('a');
  h.inners.a.next(1);
  subscription.unsubscribe();

  return { events: h.events, closed: subscription.closed };
};

const exhaustIgnoreTrace = (adapter) => {
  const h = harness(adapter);
  h.run(adapter.exhaustMap(h.project));

  h.outer().next('a');
  h.outer().next('b');
  h.inners.a.next(1);
  h.inners.a.complete();
  h.outer().next('c');
  h.inners.c.next(2);
  h.outer().complete();
  h.inners.c.complete();

  return h.events;
};

const exhaustSyncTrace = (adapter) => {
  const events = [];
  adapter.subscribe({
    next: (value) => events.push(`next:${value}`),
    complete: () => events.push('complete'),
  })(adapter.compose(adapter.of(1, 2), adapter.exhaustMap((value) => adapter.of(value * 10, value * 10 + 1))));
  return events;
};

for (const [name, trace] of Object.entries({
  mergeOverlapTrace,
  mergeConcurrentTrace,
  mergeSyncTrace,
  mergeProjectThrowTrace,
  mergeEmptyInnerTrace,
  mergeOuterErrorTrace,
  concatQueueTrace,
  concatDrainThrowTrace,
  concatSyncTrace,
  switchCancelTrace,
  switchInnerErrorTrace,
  switchSyncTrace,
  switchUnsubscribeTrace,
  exhaustIgnoreTrace,
  exhaustSyncTrace,
})) {
  test(`M07 ${name} matches RxJS 7.8.2`, () => {
    assert.deepEqual(trace(adapters.pureFp), trace(adapters.rxjs));
  });
}
