import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Observable as RxObservable,
  connect as rxConnect,
  connectable as rxConnectable,
  map as rxMap,
  merge as rxMerge,
  of as rxOf,
  share as rxShare,
  shareReplay as rxShareReplay,
} from 'rxjs';
import { subscribe } from '../../src/compat/observable.ts';
import { merge } from '../../src/compat/coordination.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { map } from '../../src/kernel/operators/map.ts';
import { connect, connectable, share, shareReplay } from '../../src/kernel/sharing.ts';

const adapters = {
  rxjs: {
    create: (initializer) => new RxObservable(initializer),
    subscribe: (observer) => (source) => source.subscribe(observer),
    of: rxOf,
    map: rxMap,
    merge: (a, b) => rxMerge(a, b),
    share: rxShare,
    shareReplay: rxShareReplay,
    connectable: rxConnectable,
    connect: rxConnect,
  },
  pureFp: {
    create: createObservable,
    subscribe,
    of,
    map,
    merge: (a, b) => merge(a, b),
    share,
    shareReplay,
    connectable,
    connect,
  },
};

const coldHarness = (adapter) => {
  const events = [];
  let runs = 0;
  let sourceSubscriber = null;
  const source = adapter.create((subscriber) => {
    runs += 1;
    sourceSubscriber = subscriber;
    events.push(`run:${runs}`);
    return () => events.push(`teardown:${runs}`);
  });
  const observer = (tag) => ({
    next: (value) => events.push(`${tag}:${value}`),
    error: (error) => events.push(`${tag}!${error.message}`),
    complete: () => events.push(`${tag}.`),
  });
  return { events, source, observer, push: (v) => sourceSubscriber.next(v), settle: (how) => (how === 'complete' ? sourceSubscriber.complete() : sourceSubscriber.error(new Error('share-boom'))), runs: () => runs };
};

const shareBasicTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.share()(h.source);
  const subA = adapter.subscribe(h.observer('a'))(shared);
  h.push(1);
  const subB = adapter.subscribe(h.observer('b'))(shared);
  h.push(2);
  subA.unsubscribe();
  h.push(3);
  subB.unsubscribe();
  adapter.subscribe(h.observer('c'))(shared);
  h.push(4);
  return { events: h.events, runs: h.runs() };
};

const shareCompleteTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.share()(h.source);
  adapter.subscribe(h.observer('a'))(shared);
  h.push(1);
  h.settle('complete');
  adapter.subscribe(h.observer('late'))(shared);
  h.push(2);
  return { events: h.events, runs: h.runs() };
};

const shareNoResetOnCompleteTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.share({ resetOnComplete: false })(h.source);
  adapter.subscribe(h.observer('a'))(shared);
  h.settle('complete');
  adapter.subscribe(h.observer('late'))(shared);
  return { events: h.events, runs: h.runs() };
};

const shareErrorTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.share()(h.source);
  adapter.subscribe(h.observer('a'))(shared);
  h.settle('error');
  adapter.subscribe(h.observer('retry'))(shared);
  h.push(9);
  return { events: h.events, runs: h.runs() };
};

const shareKeepAliveTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.share({ resetOnRefCountZero: false })(h.source);
  const subA = adapter.subscribe(h.observer('a'))(shared);
  h.push(1);
  subA.unsubscribe();
  adapter.subscribe(h.observer('b'))(shared);
  h.push(2);
  return { events: h.events, runs: h.runs() };
};

const shareNotifierResetTrace = (adapter) => {
  const h = coldHarness(adapter);
  let notifier = null;
  const shared = adapter.share({
    resetOnRefCountZero: () =>
      adapter.create((subscriber) => {
        notifier = subscriber;
        h.events.push('notifier-run');
        return () => h.events.push('notifier-teardown');
      }),
  })(h.source);

  const subA = adapter.subscribe(h.observer('a'))(shared);
  h.push(1);
  subA.unsubscribe();          // refCount 0: notifier armed, source kept
  const subB = adapter.subscribe(h.observer('b'))(shared); // re-arm cancelled
  h.push(2);
  subB.unsubscribe();          // notifier armed again
  notifier.next('fire');       // now the connection resets
  adapter.subscribe(h.observer('c'))(shared);
  h.push(3);
  return { events: h.events, runs: h.runs() };
};

const shareReplayTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.shareReplay(1)(h.source);
  const subA = adapter.subscribe(h.observer('a'))(shared);
  h.push(1);
  h.push(2);
  adapter.subscribe(h.observer('late'))(shared);
  subA.unsubscribe();
  adapter.subscribe(h.observer('resub'))(shared);
  h.push(3);
  return { events: h.events, runs: h.runs() };
};

const shareReplayRefCountTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.shareReplay({ bufferSize: 1, refCount: true })(h.source);
  const subA = adapter.subscribe(h.observer('a'))(shared);
  h.push(1);
  subA.unsubscribe();
  adapter.subscribe(h.observer('b'))(shared);
  return { events: h.events, runs: h.runs() };
};

const shareReplayCompleteTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.shareReplay(2)(h.source);
  adapter.subscribe(h.observer('a'))(shared);
  h.push(1);
  h.push(2);
  h.push(3);
  h.settle('complete');
  adapter.subscribe(h.observer('late'))(shared);
  return { events: h.events, runs: h.runs() };
};

const connectableTrace = (adapter) => {
  const h = coldHarness(adapter);
  const shared = adapter.connectable(h.source);
  adapter.subscribe(h.observer('a'))(shared);
  h.events.push(`pre-connect-runs:${h.runs()}`);
  const c1 = shared.connect();
  const c2 = shared.connect();
  h.push(1);
  adapter.subscribe(h.observer('b'))(shared);
  h.push(2);
  c1.unsubscribe();
  adapter.subscribe(h.observer('c'))(shared);
  shared.connect();
  h.push(3);
  return { events: h.events, runs: h.runs(), idempotent: c1 === c2 };
};

const connectOperatorTrace = (adapter) => {
  const h = coldHarness(adapter);
  const events = [];
  adapter.subscribe({
    next: (value) => events.push(value),
    complete: () => events.push('complete'),
  })(
    adapter.connect((shared) => adapter.merge(shared, adapter.map((value) => value * 10)(shared)))(
      h.source
    )
  );
  h.push(1);
  h.push(2);
  h.settle('complete');
  return { events, sourceEvents: h.events, runs: h.runs() };
};

for (const [name, trace] of Object.entries({
  shareBasicTrace,
  shareCompleteTrace,
  shareNoResetOnCompleteTrace,
  shareErrorTrace,
  shareKeepAliveTrace,
  shareNotifierResetTrace,
  shareReplayTrace,
  shareReplayRefCountTrace,
  shareReplayCompleteTrace,
  connectableTrace,
  connectOperatorTrace,
})) {
  test(`M11 ${name} matches RxJS 7.8.2`, () => {
    assert.deepEqual(trace(adapters.pureFp), trace(adapters.rxjs));
  });
}
