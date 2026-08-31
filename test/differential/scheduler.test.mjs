import assert from 'node:assert/strict';
import test from 'node:test';

import {
  asapScheduler as rxAsap,
  asyncScheduler as rxAsync,
  observeOn as rxObserveOn,
  of as rxOf,
  queueScheduler as rxQueue,
  subscribeOn as rxSubscribeOn,
  Observable as RxObservable,
} from 'rxjs';
import { subscribe } from '../../src/compat/observable.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { observeOn } from '../../src/kernel/operators/observe-on.ts';
import { subscribeOn } from '../../src/kernel/operators/subscribe-on.ts';
import { asapScheduler, asyncScheduler, queueScheduler } from '../../src/kernel/scheduler.ts';

// Bridge: RxJS work uses `this`-bound actions; ours passes the action as a
// parameter. Both sides expose the same (state, action) shape to scenarios.
const wrapRx = (scheduler) => ({
  schedule: (work, delay, state) =>
    scheduler.schedule(function bridge(s) {
      const self = this;
      work(s, {
        schedule: (nextState, nextDelay) => self.schedule(nextState, nextDelay),
        unsubscribe: () => self.unsubscribe(),
      });
    }, delay, state),
});

const adapters = {
  rxjs: {
    create: (initializer) => new RxObservable(initializer),
    subscribe: (observer) => (source) => source.subscribe(observer),
    of: rxOf,
    queue: wrapRx(rxQueue),
    asap: wrapRx(rxAsap),
    async: wrapRx(rxAsync),
    observeOnAsap: () => rxObserveOn(rxAsap),
    subscribeOnAsync: () => rxSubscribeOn(rxAsync),
  },
  pureFp: {
    create: createObservable,
    subscribe,
    of,
    queue: queueScheduler,
    asap: asapScheduler,
    async: asyncScheduler,
    observeOnAsap: () => observeOn(asapScheduler),
    subscribeOnAsync: () => subscribeOn(asyncScheduler),
  },
};

const settle = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

const queueTrampolineTrace = (adapter) => {
  const log = [];
  log.push('before');
  adapter.queue.schedule(() => {
    log.push('outer-start');
    adapter.queue.schedule(() => {
      log.push('inner-1');
      adapter.queue.schedule(() => log.push('nested'));
    });
    adapter.queue.schedule(() => log.push('inner-2'));
    log.push('outer-end');
  });
  log.push('after');
  return log;
};

const orderingTrace = async (adapter) => {
  const log = [];
  log.push('start');
  adapter.queue.schedule(() => log.push('queue'));
  log.push('after-queue');
  adapter.asap.schedule(() => log.push('asap'));
  adapter.async.schedule(() => log.push('async'), 0);
  log.push('sync-done');
  await settle();
  return log;
};

const asapBatchTrace = async (adapter) => {
  const log = [];
  adapter.asap.schedule(() => {
    log.push('a');
    adapter.asap.schedule(() => log.push('joined'));
  });
  adapter.asap.schedule(() => log.push('b'));
  adapter.async.schedule(() => log.push('macro'), 0);
  log.push('sync');
  await settle();
  return log;
};

const asyncRescheduleTrace = async (adapter) => {
  const ticks = [];
  adapter.async.schedule(
    (state, action) => {
      ticks.push(state);
      if (state < 3) {
        action.schedule(state + 1, 1);
      }
    },
    1,
    0
  );
  await settle(80);
  return ticks;
};

const cancelTrace = async (adapter) => {
  let ran = 0;
  const a = adapter.async.schedule(() => {
    ran += 1;
  }, 0);
  a.unsubscribe();
  const b = adapter.asap.schedule(() => {
    ran += 1;
  });
  b.unsubscribe();
  await settle();
  return ran;
};

const observeOnTrace = async (adapter) => {
  const log = [];
  adapter.subscribe({
    next: (value) => log.push(`next:${value}`),
    complete: () => log.push('complete'),
  })(adapter.observeOnAsap()(adapter.of(1, 2)));
  log.push('subscribed');
  await settle();
  return log;
};

const subscribeOnTrace = async (adapter) => {
  const log = [];
  const source = adapter.create((subscriber) => {
    log.push('source-run');
    subscriber.next('x');
    subscriber.complete();
  });
  adapter.subscribe({
    next: (value) => log.push(`next:${value}`),
    complete: () => log.push('complete'),
  })(adapter.subscribeOnAsync()(source));
  log.push('subscribed');
  await settle();
  return log;
};

for (const [name, trace] of Object.entries({
  queueTrampolineTrace,
  orderingTrace,
  asapBatchTrace,
  asyncRescheduleTrace,
  cancelTrace,
  observeOnTrace,
  subscribeOnTrace,
})) {
  test(`M13 ${name} matches RxJS 7.8.2`, async () => {
    assert.deepEqual(await trace(adapters.pureFp), await trace(adapters.rxjs));
  });
}
