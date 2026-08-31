import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Observable as RxObservable,
  catchError as rxCatchError,
  finalize as rxFinalize,
  of as rxOf,
  repeat as rxRepeat,
  retry as rxRetry,
  throwError as rxThrowError,
} from 'rxjs';
import { subscribe } from '../../src/compat/observable.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { throwError } from '../../src/kernel/creation/throw-error.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { catchError } from '../../src/kernel/operators/catch-error.ts';
import { finalize } from '../../src/kernel/operators/finalize.ts';
import { repeat } from '../../src/kernel/operators/repeat.ts';
import { retry } from '../../src/kernel/operators/retry.ts';

const adapters = {
  rxjs: {
    create: (initializer) => new RxObservable(initializer),
    subscribe: (observer) => (source) => source.subscribe(observer),
    of: rxOf,
    throwError: rxThrowError,
    catchError: rxCatchError,
    retry: rxRetry,
    repeat: rxRepeat,
    finalize: rxFinalize,
  },
  pureFp: {
    create: createObservable,
    subscribe,
    of,
    throwError,
    catchError,
    retry,
    repeat,
    finalize,
  },
};

// A cold source whose behavior per run is scripted: each entry is a list of
// steps — numbers are emissions, 'error' errors, 'complete' completes.
const scripted = (adapter, script, events) => {
  let runs = 0;
  return adapter.create((subscriber) => {
    const run = runs;
    runs += 1;
    events.push(`run:${run}`);
    for (const step of script[run] ?? ['complete']) {
      if (step === 'error') subscriber.error(new Error(`boom-${run}`));
      else if (step === 'complete') subscriber.complete();
      else subscriber.next(step);
    }
    return () => events.push(`teardown:${run}`);
  });
};

const collectInto = (adapter, events) => (source) =>
  adapter.subscribe({
    next: (value) => events.push(`next:${value}`),
    error: (error) => events.push(`error:${error.message}`),
    complete: () => events.push('complete'),
  })(source);

const finalizeTrace = (adapter) => {
  const events = [];
  const make = (script) =>
    adapter.finalize(() => events.push('finalized'))(scripted(adapter, [script], events));

  collectInto(adapter, events)(make([1, 'complete']));
  collectInto(adapter, events)(make([1, 'error']));
  const open = collectInto(adapter, events)(make([1]));
  open.unsubscribe();
  return events;
};

const catchErrorRecoverTrace = (adapter) => {
  const events = [];
  const source = scripted(adapter, [[1, 'error']], events);
  collectInto(adapter, events)(
    adapter.catchError((error) => {
      events.push(`caught:${error.message}`);
      return adapter.of('fallback');
    })(source)
  );
  return events;
};

const catchErrorCaughtRetryTrace = (adapter) => {
  const events = [];
  const source = scripted(adapter, [['a', 'error'], ['b', 'error'], ['c', 'complete']], events);
  collectInto(adapter, events)(adapter.catchError((_error, caught) => caught)(source));
  return events;
};

const catchErrorSelectorThrowTrace = (adapter) => {
  const events = [];
  const source = scripted(adapter, [['error']], events);
  collectInto(adapter, events)(
    adapter.catchError(() => {
      throw new Error('selector-boom');
    })(source)
  );
  return events;
};

const retryCountTrace = (adapter) => {
  const events = [];
  const source = scripted(adapter, [[1, 'error'], [2, 'error'], [3, 'error'], [4, 'error']], events);
  collectInto(adapter, events)(adapter.retry(2)(source));
  return events;
};

const retryRecoversTrace = (adapter) => {
  const events = [];
  const source = scripted(adapter, [['error'], ['error'], ['ok', 'complete']], events);
  collectInto(adapter, events)(adapter.retry(5)(source));
  return events;
};

const retryResetOnSuccessTrace = (adapter) => {
  const script = [['error'], ['v', 'error'], ['error'], ['error'], ['done', 'complete']];
  const run = (config) => {
    const events = [];
    collectInto(adapter, events)(adapter.retry(config)(scripted(adapter, script, events)));
    return events;
  };
  return { plain: run({ count: 2 }), resetting: run({ count: 2, resetOnSuccess: true }) };
};

const retryDelayNotifierTrace = (adapter) => {
  const events = [];
  const notifierArgs = [];
  let fire = null;
  const source = scripted(adapter, [['error'], ['ok', 'complete']], events);
  collectInto(adapter, events)(
    adapter.retry({
      delay: (error, retryCount) => {
        notifierArgs.push(`${error.message}@${retryCount}`);
        return adapter.create((subscriber) => {
          fire = subscriber;
          events.push('notifier-run');
          return () => events.push('notifier-teardown');
        });
      },
    })(source)
  );
  events.push('pre-fire');
  fire.next('go');
  return { events, notifierArgs };
};

const retryDelayCompletesTrace = (adapter) => {
  const events = [];
  const source = scripted(adapter, [['error']], events);
  collectInto(adapter, events)(
    adapter.retry({
      delay: () => adapter.create((subscriber) => subscriber.complete()),
    })(source)
  );
  return events;
};

const retryZeroIdentityTrace = (adapter) => {
  const source = adapter.of(1);
  return { sameReference: adapter.retry(0)(source) === source };
};

const repeatTrace = (adapter) => {
  const events = [];
  const source = scripted(
    adapter,
    [[1, 2, 'complete'], [3, 'complete'], [4, 'complete']],
    events
  );
  collectInto(adapter, events)(adapter.repeat(3)(source));

  const zeroEvents = [];
  collectInto(adapter, zeroEvents)(adapter.repeat(0)(adapter.of(9)));
  return { events, zeroEvents };
};

const repeatDelayNotifierTrace = (adapter) => {
  const events = [];
  const counts = [];
  let fire = null;
  const source = scripted(adapter, [['a', 'complete'], ['b', 'complete']], events);
  collectInto(adapter, events)(
    adapter.repeat({
      count: 2,
      delay: (repeatCount) => {
        counts.push(repeatCount);
        return adapter.create((subscriber) => {
          fire = subscriber;
          events.push('notifier-run');
          return () => events.push('notifier-teardown');
        });
      },
    })(source)
  );
  events.push('pre-fire');
  fire.next('go');
  return { events, counts };
};

const throwErrorTrace = (adapter) => {
  const events = [];
  let calls = 0;
  const factorySource = adapter.throwError(() => {
    calls += 1;
    return new Error(`factory-${calls}`);
  });
  collectInto(adapter, events)(factorySource);
  collectInto(adapter, events)(factorySource);
  collectInto(adapter, events)(adapter.throwError(new Error('plain')));
  return { events, calls };
};

for (const [name, trace] of Object.entries({
  finalizeTrace,
  catchErrorRecoverTrace,
  catchErrorCaughtRetryTrace,
  catchErrorSelectorThrowTrace,
  retryCountTrace,
  retryRecoversTrace,
  retryResetOnSuccessTrace,
  retryDelayNotifierTrace,
  retryDelayCompletesTrace,
  retryZeroIdentityTrace,
  repeatTrace,
  repeatDelayNotifierTrace,
  throwErrorTrace,
})) {
  test(`M12 ${name} matches RxJS 7.8.2`, () => {
    assert.deepEqual(trace(adapters.pureFp), trace(adapters.rxjs));
  });
}
