import assert from 'node:assert/strict';
import test from 'node:test';

import { subscribe } from '../../src/compat/observable.ts';
import { timeoutWith } from '../../src/compat/temporal.ts';
import { interval } from '../../src/kernel/creation/interval.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { throwError } from '../../src/kernel/creation/throw-error.ts';
import { timer } from '../../src/kernel/creation/timer.ts';
import { audit } from '../../src/kernel/operators/audit.ts';
import { auditTime } from '../../src/kernel/operators/audit-time.ts';
import { debounce } from '../../src/kernel/operators/debounce.ts';
import { debounceTime } from '../../src/kernel/operators/debounce-time.ts';
import { delay } from '../../src/kernel/operators/delay.ts';
import { delayWhen } from '../../src/kernel/operators/delay-when.ts';
import { repeat } from '../../src/kernel/operators/repeat.ts';
import { retry } from '../../src/kernel/operators/retry.ts';
import { sample } from '../../src/kernel/operators/sample.ts';
import { take } from '../../src/kernel/operators/take.ts';
import { throttle } from '../../src/kernel/operators/throttle.ts';
import { throttleTime } from '../../src/kernel/operators/throttle-time.ts';
import { timeout } from '../../src/kernel/operators/timeout.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { createSubject } from '../../src/kernel/subject.ts';

const record = (events) => ({
  next: (value) => events.push(`next:${value}`),
  error: (error) =>
    events.push(`error:${error instanceof Error ? `${error.name}:${error.message}` : error}`),
  complete: () => events.push('complete'),
});

const collectAsync = (source) =>
  new Promise((resolve) => {
    const events = [];
    subscribe({
      next: (value) => events.push(`next:${value}`),
      error: (error) => {
        events.push(`error:${error instanceof Error ? `${error.name}:${error.message}` : error}`);
        resolve(events);
      },
      complete: () => {
        events.push('complete');
        resolve(events);
      },
    })(source);
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('M14 timer: emits 0 once after the due time, then completes', async () => {
  const events = await collectAsync(timer(20));
  assert.deepEqual(events, ['next:0', 'complete']);
});

test('M14 timer: a past Date due fires immediately, a pending timer is cancellable', async () => {
  const events = await collectAsync(timer(new Date(Date.now() - 1000)));
  assert.deepEqual(events, ['next:0', 'complete']);

  const cancelled = [];
  const subscription = subscribe(record(cancelled))(timer(30));
  subscription.unsubscribe();
  await sleep(60);
  assert.deepEqual(cancelled, []);
});

test('M14 interval: periodic counter, completed here by take', async () => {
  const events = await collectAsync(pipeValue(interval(15), take(3)));
  assert.deepEqual(events, ['next:0', 'next:1', 'next:2', 'complete']);
});

test('M14 delay: shifts values without reordering and preserves completion', async () => {
  const events = [];
  subscribe(record(events))(pipeValue(of(1, 2, 3), delay(25)));
  assert.deepEqual(events, []);
  await sleep(80);
  assert.deepEqual(events, ['next:1', 'next:2', 'next:3', 'complete']);
});

test('M14 delay: errors are not delayed and drop pending values', async () => {
  const source = createSubject();
  const events = [];
  subscribe(record(events))(pipeValue(source, delay(50)));
  source.next(1);
  source.error(new Error('boom'));
  assert.deepEqual(events, ['error:Error:boom']);
  await sleep(80);
  assert.deepEqual(events, ['error:Error:boom']);
});

test('M14 delayWhen: per-value durations may reorder; completion waits for pending durations', () => {
  const durations = new Map();
  const durationFor = (value) => {
    const duration = createSubject();
    durations.set(value, duration);
    return duration;
  };
  const source = createSubject();
  const events = [];
  subscribe(record(events))(pipeValue(source, delayWhen((value) => durationFor(value))));

  source.next('a');
  source.next('b');
  source.complete();
  assert.deepEqual(events, []);
  durations.get('b').next(0);
  durations.get('a').next(0);
  assert.deepEqual(events, ['next:b', 'next:a', 'complete']);
});

test('M14 delayWhen: a duration completing without a value drops that value (v7 semantics)', () => {
  const source = createSubject();
  const durations = [];
  const events = [];
  subscribe(record(events))(
    pipeValue(
      source,
      delayWhen(() => {
        const duration = createSubject();
        durations.push(duration);
        return duration;
      })
    )
  );
  source.next('a');
  durations[0].complete();
  source.next('b');
  durations[1].next(0);
  source.complete();
  assert.deepEqual(events, ['next:b', 'complete']);
});

test('M14 debounce: a new value cancels the pending duration; completion flushes', () => {
  const source = createSubject();
  const durations = [];
  const events = [];
  subscribe(record(events))(
    pipeValue(
      source,
      debounce(() => {
        const duration = createSubject();
        durations.push(duration);
        return duration;
      })
    )
  );
  source.next(1);
  source.next(2);
  durations[0].next(0);
  assert.deepEqual(events, [], 'cancelled duration must not emit');
  durations[1].next(0);
  assert.deepEqual(events, ['next:2']);
  source.next(3);
  source.complete();
  assert.deepEqual(events, ['next:2', 'next:3', 'complete']);
});

test('M14 audit: first value opens the window, window end emits the latest', () => {
  const source = createSubject();
  const windows = [];
  const events = [];
  subscribe(record(events))(
    pipeValue(
      source,
      audit(() => {
        const window = createSubject();
        windows.push(window);
        return window;
      })
    )
  );
  source.next(1);
  source.next(2);
  assert.equal(windows.length, 1, 'second value must not open a new window');
  windows[0].next(0);
  assert.deepEqual(events, ['next:2']);
  source.next(3);
  source.complete();
  assert.deepEqual(events, ['next:2'], 'completion is deferred while a window is pending');
  windows[1].next(0);
  assert.deepEqual(events, ['next:2', 'next:3', 'complete']);
});

test('M14 throttle: leading default emits the window opener and ignores the rest', () => {
  const source = createSubject();
  const windows = [];
  const events = [];
  subscribe(record(events))(
    pipeValue(
      source,
      throttle(() => {
        const window = createSubject();
        windows.push(window);
        return window;
      })
    )
  );
  source.next(1);
  assert.deepEqual(events, ['next:1']);
  source.next(2);
  source.next(3);
  windows[0].next(0);
  assert.deepEqual(events, ['next:1'], 'trailing disabled: window end emits nothing');
  source.next(4);
  source.complete();
  assert.deepEqual(events, ['next:1', 'next:4', 'complete']);
});

test('M14 throttle: trailing emits the latest at window end and re-opens the window', () => {
  const source = createSubject();
  const windows = [];
  const events = [];
  subscribe(record(events))(
    pipeValue(
      source,
      throttle(
        () => {
          const window = createSubject();
          windows.push(window);
          return window;
        },
        { leading: false, trailing: true }
      )
    )
  );
  source.next(1);
  assert.deepEqual(events, [], 'leading disabled');
  source.next(2);
  windows[0].next(0);
  assert.deepEqual(events, ['next:2']);
  source.next(3);
  source.complete();
  assert.deepEqual(events, ['next:2'], 'pending trailing value defers completion');
  windows[1].next(0);
  assert.deepEqual(events, ['next:2', 'next:3', 'complete']);
});

test('M14 sample: emits the latest value at most once per notifier tick', () => {
  const source = createSubject();
  const notifier = createSubject();
  const events = [];
  subscribe(record(events))(pipeValue(source, sample(notifier)));
  source.next(1);
  notifier.next(0);
  notifier.next(0);
  source.next(2);
  source.next(3);
  notifier.next(0);
  notifier.complete();
  source.next(4);
  notifier.next(0);
  source.complete();
  assert.deepEqual(events, ['next:1', 'next:3', 'complete']);
});

test('M14 timeout: first deadline errors with TimeoutError carrying diagnostics', async () => {
  const silent = createSubject();
  const seenErrors = [];
  const done = new Promise((resolve) => {
    subscribe({
      next: () => {},
      error: (error) => {
        seenErrors.push(error);
        resolve();
      },
      complete: resolve,
    })(pipeValue(silent, timeout({ first: 25, meta: 'm' })));
  });
  await done;
  assert.equal(seenErrors.length, 1);
  assert.equal(seenErrors[0].name, 'TimeoutError');
  assert.equal(seenErrors[0].message, 'Timeout has occurred');
  assert.deepEqual(seenErrors[0].info, { meta: 'm', seen: 0, lastValue: null });
});

test('M14 timeout: each re-arms after every value; with-factory switches instead of erroring', async () => {
  const source = createSubject();
  const events = [];
  subscribe(record(events))(
    pipeValue(
      source,
      timeout({ each: 30, with: (info) => of(`fallback:${info.seen}`) })
    )
  );
  source.next('a');
  await sleep(70);
  assert.deepEqual(events, ['next:a', 'next:fallback:1', 'complete']);
});

test('M14 timeout: missing deadline is a synchronous TypeError', () => {
  assert.throws(() => timeout({}), { name: 'TypeError', message: 'No timeout provided.' });
  assert.throws(() => timeoutWith(new Date(NaN), of(1)), {
    name: 'TypeError',
    message: 'No timeout provided.',
  });
  assert.throws(() => timeoutWith(10, undefined), {
    name: 'TypeError',
    message: 'No observable provided to switch to',
  });
});

test('M14 timeoutWith: switches to the alternate observable after the deadline', async () => {
  const silent = createSubject();
  const events = await collectAsync(pipeValue(silent, timeoutWith(25, of('alt'))));
  assert.deepEqual(events, ['next:alt', 'complete']);
});

test('M14 retry/repeat: numeric delays resubscribe through timer', async () => {
  let attempts = 0;
  const flaky = createObservable((subscriber) => {
    attempts += 1;
    if (attempts < 3) {
      subscriber.error(new Error(`fail ${attempts}`));
    } else {
      subscriber.next('ok');
      subscriber.complete();
    }
  });
  const retried = await collectAsync(pipeValue(flaky, retry({ count: 2, delay: 15 })));
  assert.deepEqual(retried, ['next:ok', 'complete']);
  assert.equal(attempts, 3);

  const started = Date.now();
  const repeated = await collectAsync(pipeValue(of('x'), repeat({ count: 3, delay: 15 })));
  assert.deepEqual(repeated, ['next:x', 'next:x', 'next:x', 'complete']);
  assert.ok(Date.now() - started >= 25, 'repeats are spaced by the numeric delay');
});

test('M14 time-based smoke: debounceTime, auditTime, throttleTime settle to the expected traces', async () => {
  const debounced = [];
  const debouncedSource = createSubject();
  subscribe(record(debounced))(pipeValue(debouncedSource, debounceTime(40)));
  debouncedSource.next(1);
  await sleep(10);
  debouncedSource.next(2);
  await sleep(90);
  debouncedSource.next(3);
  debouncedSource.complete();
  assert.deepEqual(debounced, ['next:2', 'next:3', 'complete']);

  const audited = [];
  const auditedSource = createSubject();
  subscribe(record(audited))(pipeValue(auditedSource, auditTime(40)));
  auditedSource.next(1);
  await sleep(10);
  auditedSource.next(2);
  await sleep(90);
  auditedSource.complete();
  assert.deepEqual(audited, ['next:2', 'complete']);

  const throttled = [];
  const throttledSource = createSubject();
  subscribe(record(throttled))(pipeValue(throttledSource, throttleTime(40)));
  throttledSource.next(1);
  await sleep(10);
  throttledSource.next(2);
  await sleep(90);
  throttledSource.next(3);
  throttledSource.complete();
  assert.deepEqual(throttled, ['next:1', 'next:3', 'complete']);
});

test('M14 errors bypass rate limiting immediately', () => {
  const auditedEvents = [];
  subscribe(record(auditedEvents))(
    pipeValue(throwError(new Error('boom')), audit(() => createSubject()))
  );
  assert.deepEqual(auditedEvents, ['error:Error:boom']);
});
