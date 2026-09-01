import assert from 'node:assert/strict';
import test from 'node:test';

import { bindCallback, bindNodeCallback } from '../../src/compat/bind-callback.ts';
import { subscribe } from '../../src/compat/observable.ts';
import { firstValueFrom, lastValueFrom } from '../../src/compat/promise.ts';
import { defer } from '../../src/kernel/creation/defer.ts';
import { EMPTY, empty } from '../../src/kernel/creation/empty.ts';
import { from } from '../../src/kernel/creation/from.ts';
import { fromEvent } from '../../src/kernel/creation/from-event.ts';
import { fromEventPattern } from '../../src/kernel/creation/from-event-pattern.ts';
import { generate } from '../../src/kernel/creation/generate.ts';
import { iif } from '../../src/kernel/creation/iif.ts';
import { NEVER, never } from '../../src/kernel/creation/never.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { pairs } from '../../src/kernel/creation/pairs.ts';
import { range } from '../../src/kernel/creation/range.ts';
import { using } from '../../src/kernel/creation/using.ts';
import { concat } from '../../src/kernel/creation/concat.ts';
import { merge } from '../../src/kernel/creation/merge.ts';
import { zip } from '../../src/kernel/creation/zip.ts';
import { combineLatest } from '../../src/kernel/creation/combine-latest.ts';
import { forkJoin } from '../../src/kernel/creation/fork-join.ts';
import { race } from '../../src/kernel/creation/race.ts';
import { innerFrom, isObservable, observable } from '../../src/kernel/interop.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { catchError } from '../../src/kernel/operators/catch-error.ts';
import { mergeMap } from '../../src/kernel/operators/merge-map.ts';
import { concatMap } from '../../src/kernel/operators/concat-map.ts';
import { switchMap } from '../../src/kernel/operators/switch-map.ts';
import { take } from '../../src/kernel/operators/take.ts';
import { takeUntil } from '../../src/kernel/operators/take-until.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { createSubscriber } from '../../src/kernel/sink.ts';
import { createSubject } from '../../src/kernel/subject.ts';

const collect = (source) => {
  const events = [];
  subscribe({
    next: (value) => events.push({ type: 'next', value }),
    error: (error) => events.push({ type: 'error', message: error.message }),
    complete: () => events.push({ type: 'complete' }),
  })(source);
  return events;
};

const collectAsync = (source) =>
  new Promise((resolve) => {
    const events = [];
    subscribe({
      next: (value) => events.push({ type: 'next', value }),
      error: (error) => {
        events.push({ type: 'error', message: error.message });
        resolve(events);
      },
      complete: () => {
        events.push({ type: 'complete' });
        resolve(events);
      },
    })(source);
  });

test('from converts arrays, strings, iterables, and array-likes synchronously', () => {
  assert.deepEqual(collect(from([1, 2, 3])), [
    { type: 'next', value: 1 },
    { type: 'next', value: 2 },
    { type: 'next', value: 3 },
    { type: 'complete' },
  ]);
  assert.deepEqual(
    collect(from('ab')).map((e) => e.value ?? e.type),
    ['a', 'b', 'complete']
  );
  assert.deepEqual(
    collect(from(new Set(['x', 'y']))).map((e) => e.value ?? e.type),
    ['x', 'y', 'complete']
  );
  assert.deepEqual(
    collect(from({ length: 2, 0: 'p', 1: 'q' })).map((e) => e.value ?? e.type),
    ['p', 'q', 'complete']
  );
});

test('from returns functional Observables unchanged (reference identity)', () => {
  const source = of(1);
  assert.equal(from(source), source);
  assert.equal(innerFrom(source), source);
});

test('from converts promises: resolution emits then completes, rejection errors', async () => {
  assert.deepEqual(await collectAsync(from(Promise.resolve('v'))), [
    { type: 'next', value: 'v' },
    { type: 'complete' },
  ]);
  assert.deepEqual(await collectAsync(from(Promise.reject(new Error('boom')))), [
    { type: 'error', message: 'boom' },
  ]);
});

test('from ignores promise resolution after unsubscribe', async () => {
  let resolvePromise;
  const events = [];
  const subscription = subscribe({
    next: (value) => events.push(value),
    complete: () => events.push('complete'),
  })(from(new Promise((resolve) => (resolvePromise = resolve))));
  subscription.unsubscribe();
  resolvePromise('late');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events, []);
});

test('from converts async iterables', async () => {
  async function* numbers() {
    yield 1;
    yield 2;
  }
  assert.deepEqual(await collectAsync(from(numbers())), [
    { type: 'next', value: 1 },
    { type: 'next', value: 2 },
    { type: 'complete' },
  ]);
});

test('from converts readable-stream-likes and releases the reader lock', async () => {
  let released = false;
  const chunks = ['a', 'b'];
  const streamLike = {
    getReader: () => ({
      read: () =>
        Promise.resolve(
          chunks.length ? { done: false, value: chunks.shift() } : { done: true, value: undefined }
        ),
      releaseLock: () => {
        released = true;
      },
    }),
  };
  assert.deepEqual(await collectAsync(from(streamLike)), [
    { type: 'next', value: 'a' },
    { type: 'next', value: 'b' },
    { type: 'complete' },
  ]);
  assert.equal(released, true);
});

test('from converts Symbol.observable interop carriers', () => {
  const teardowns = [];
  const interop = {
    [observable]() {
      return {
        subscribe(subscriber) {
          subscriber.next('interop');
          subscriber.complete();
          return { unsubscribe: () => teardowns.push('inner') };
        },
      };
    },
  };
  assert.deepEqual(collect(from(interop)), [
    { type: 'next', value: 'interop' },
    { type: 'complete' },
  ]);
  assert.deepEqual(teardowns, ['inner']);
});

test('from throws the RxJS TypeError for unconvertible inputs', () => {
  for (const input of [42, null, undefined, true]) {
    assert.throws(() => from(input), {
      name: 'TypeError',
      message: `You provided '${String(input)}' where a stream was expected. You can provide an Observable, Promise, ReadableStream, Array, AsyncIterable, or Iterable.`,
    });
  }
  assert.throws(() => from({ foo: 1 }), {
    name: 'TypeError',
    message:
      'You provided an invalid object where a stream was expected. You can provide an Observable, Promise, ReadableStream, Array, AsyncIterable, or Iterable.',
  });
});

test('from stops iterating a generator on early unsubscribe and runs its finalizer', () => {
  const events = [];
  function* source() {
    try {
      events.push('start');
      yield 1;
      yield 2;
      yield 3;
    } finally {
      events.push('finally');
    }
  }
  assert.deepEqual(
    collect(pipeValue(from(source()), take(2))).map((e) => e.value ?? e.type),
    [1, 2, 'complete']
  );
  assert.deepEqual(events, ['start', 'finally']);
});

test('fromPromise reports consumer crashes through the runtime environment', async () => {
  const reported = [];
  const env = {
    onUnhandledError: (error) => reported.push(error.message),
    onStoppedNotification: null,
    defer: (task) => setTimeout(task),
  };
  const subscriber = createSubscriber(
    {
      next: () => {
        throw new Error('consumer crash');
      },
      error: () => {},
      complete: () => {},
    },
    env
  );
  from(Promise.resolve('v'))(subscriber);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(reported, ['consumer crash']);
});

test('defer invokes its factory per subscription and converts the result', () => {
  let calls = 0;
  const source = defer(() => {
    calls += 1;
    return [calls];
  });
  assert.deepEqual(collect(source).map((e) => e.value ?? e.type), [1, 'complete']);
  assert.deepEqual(collect(source).map((e) => e.value ?? e.type), [2, 'complete']);
  assert.equal(calls, 2);
});

test('defer routes factory throws to the error channel', () => {
  assert.deepEqual(
    collect(defer(() => {
      throw new Error('factory');
    })),
    [{ type: 'error', message: 'factory' }]
  );
});

test('iif chooses per subscription and accepts any ObservableInput branch', () => {
  let flag = true;
  const source = iif(() => flag, ['T'], of('F'));
  assert.deepEqual(collect(source).map((e) => e.value ?? e.type), ['T', 'complete']);
  flag = false;
  assert.deepEqual(collect(source).map((e) => e.value ?? e.type), ['F', 'complete']);
});

test('range counts, shuffles a single argument, and returns EMPTY for non-positive counts', () => {
  assert.deepEqual(collect(range(2, 3)).map((e) => e.value ?? e.type), [2, 3, 4, 'complete']);
  assert.deepEqual(collect(range(3)).map((e) => e.value ?? e.type), [0, 1, 2, 'complete']);
  assert.equal(range(1, 0), EMPTY);
  assert.equal(range(1, -5), EMPTY);
});

test('range stops emitting on early unsubscribe', () => {
  assert.deepEqual(
    collect(pipeValue(range(0, 1000), take(3))).map((e) => e.value ?? e.type),
    [0, 1, 2, 'complete']
  );
});

test('generate supports positional and options forms with optional condition and selector', () => {
  assert.deepEqual(
    collect(generate(1, (x) => x <= 3, (x) => x + 1)).map((e) => e.value ?? e.type),
    [1, 2, 3, 'complete']
  );
  assert.deepEqual(
    collect(generate(1, (x) => x <= 2, (x) => x + 1, (x) => x * 10)).map((e) => e.value ?? e.type),
    [10, 20, 'complete']
  );
  assert.deepEqual(
    collect(
      generate({
        initialState: 2,
        condition: (x) => x < 20,
        iterate: (x) => x * 2,
        resultSelector: (x) => `v${x}`,
      })
    ).map((e) => e.value ?? e.type),
    ['v2', 'v4', 'v8', 'v16', 'complete']
  );
  // No condition: an infinite loop bounded by take, per RxJS.
  assert.deepEqual(
    collect(pipeValue(generate({ initialState: 0, iterate: (x) => x + 1 }), take(3))).map(
      (e) => e.value ?? e.type
    ),
    [0, 1, 2, 'complete']
  );
});

test('generate routes iterate throws to the error channel', () => {
  assert.deepEqual(
    collect(
      generate(0, () => true, () => {
        throw new Error('iterate');
      })
    ),
    [{ type: 'next', value: 0 }, { type: 'error', message: 'iterate' }]
  );
});

test('using creates a resource per subscription and disposes it on teardown', () => {
  const events = [];
  let id = 0;
  const source = using(
    () => {
      const resource = ++id;
      events.push(`create:${resource}`);
      return { unsubscribe: () => events.push(`dispose:${resource}`) };
    },
    (resource) => of(`value:${resource.unsubscribe ? id : '?'}`)
  );
  subscribe({ next: (v) => events.push(v), complete: () => events.push('complete') })(source);
  subscribe({ next: (v) => events.push(v) })(source);
  assert.deepEqual(events, [
    'create:1',
    'value:1',
    'complete',
    'dispose:1',
    'create:2',
    'value:2',
    'dispose:2',
  ]);
});

test('using subscribes EMPTY for a void observable factory', () => {
  assert.deepEqual(collect(using(() => undefined, () => undefined)), [{ type: 'complete' }]);
});

test('empty() and never() return the shared EMPTY and NEVER', () => {
  assert.equal(empty(), EMPTY);
  assert.equal(never(), NEVER);
  assert.deepEqual(collect(EMPTY), [{ type: 'complete' }]);
  const events = collect(NEVER);
  assert.deepEqual(events, []);
});

test('pairs emits object entries', () => {
  assert.deepEqual(
    collect(pairs({ a: 1, b: 2 })).map((e) => e.value ?? e.type),
    [['a', 1], ['b', 2], 'complete']
  );
});

test('isObservable recognizes constructed observables and subjects only', () => {
  assert.equal(isObservable(of(1)), true);
  assert.equal(isObservable(createObservable(() => undefined)), true);
  assert.equal(isObservable(createSubject()), true);
  assert.equal(isObservable(EMPTY), true);
  assert.equal(isObservable({}), false);
  assert.equal(isObservable(() => undefined), false);
  assert.equal(isObservable(Promise.resolve(1)), false);
  assert.equal(isObservable(null), false);
});

test('observable is Symbol.observable or the @@observable ponyfill key', () => {
  const expected = (typeof Symbol === 'function' && Symbol.observable) || '@@observable';
  assert.equal(observable, expected);
});

test('fromEvent wires EventTarget-shaped targets with options passthrough', () => {
  const events = [];
  const listeners = new Set();
  const target = {
    addEventListener: (name, handler, options) => {
      events.push(`add:${name}:${JSON.stringify(options)}`);
      listeners.add(handler);
    },
    removeEventListener: (name, handler) => {
      events.push(`remove:${name}`);
      listeners.delete(handler);
    },
  };
  const subscription = subscribe({ next: (v) => events.push(`next:${v.type}`) })(
    fromEvent(target, 'click', { capture: true })
  );
  for (const listener of listeners) listener({ type: 'click' });
  subscription.unsubscribe();
  assert.deepEqual(events, ['add:click:{"capture":true}', 'next:click', 'remove:click']);
});

test('fromEvent wires Node-style emitters and emits argument arrays for multi-arg events', () => {
  const events = [];
  let listener = null;
  const emitter = {
    addListener: (name, handler) => {
      events.push(`add:${name}`);
      listener = handler;
    },
    removeListener: (name) => events.push(`remove:${name}`),
  };
  const subscription = subscribe({ next: (v) => events.push(v) })(fromEvent(emitter, 'data'));
  listener('single');
  listener('a', 'b');
  subscription.unsubscribe();
  assert.deepEqual(events, ['add:data', 'single', ['a', 'b'], 'remove:data']);
});

test('fromEvent wires jQuery-style emitters and applies the result selector', () => {
  const events = [];
  let listener = null;
  const emitter = {
    on: (name, handler) => (listener = handler),
    off: (name) => events.push(`off:${name}`),
  };
  const subscription = subscribe({ next: (v) => events.push(v) })(
    fromEvent(emitter, 'evt', (a, b) => `${a}+${b}`)
  );
  listener('x', 'y');
  subscription.unsubscribe();
  assert.deepEqual(events, ['x+y', 'off:evt']);
});

test('fromEvent fans out over array-like targets and rejects invalid ones', () => {
  const listeners = [];
  const makeEmitter = (id) => ({
    addListener: (name, handler) => listeners.push([id, handler]),
    removeListener: () => {},
  });
  const received = [];
  subscribe({ next: (v) => received.push(v) })(
    fromEvent([makeEmitter('a'), makeEmitter('b')], 'evt')
  );
  for (const [id, handler] of listeners) handler(id);
  assert.deepEqual(received, ['a', 'b']);
  assert.throws(() => fromEvent({}, 'evt'), { name: 'TypeError', message: 'Invalid event target' });
});

test('fromEventPattern passes the add-handler signal to the remove handler', () => {
  const events = [];
  let handler = null;
  const source = fromEventPattern(
    (h) => {
      handler = h;
      events.push('add');
      return 'signal';
    },
    (h, signal) => events.push(`remove:${signal}`)
  );
  const subscription = subscribe({ next: (v) => events.push(v) })(source);
  handler('one');
  handler('x', 'y');
  subscription.unsubscribe();
  assert.deepEqual(events, ['add', 'one', ['x', 'y'], 'remove:signal']);
});

test('bindCallback completes synchronously for synchronous callbacks and replays late subscribers', () => {
  const bound = bindCallback((input, callback) => callback(input * 2));
  const source = bound(21);
  assert.deepEqual(collect(source), [{ type: 'next', value: 42 }, { type: 'complete' }]);
  // The AsyncSubject replays without re-invoking the callback.
  assert.deepEqual(collect(source), [{ type: 'next', value: 42 }, { type: 'complete' }]);
});

test('bindCallback emits multi-result callbacks as arrays and defers async completion', async () => {
  const bound = bindCallback((callback) => setTimeout(() => callback('a', 'b')));
  assert.deepEqual(await collectAsync(bound()), [
    { type: 'next', value: ['a', 'b'] },
    { type: 'complete' },
  ]);
});

test('bindCallback invokes the callback function once per argument application', () => {
  let calls = 0;
  const bound = bindCallback((callback) => {
    calls += 1;
    callback(calls);
  });
  const source = bound();
  collect(source);
  collect(source);
  assert.equal(calls, 1);
  assert.equal(collect(bound())[0].value, 2);
});

test('bindNodeCallback splits the error-first protocol across channels', () => {
  const ok = bindNodeCallback((value, callback) => callback(null, value + 1));
  assert.deepEqual(collect(ok(1)), [{ type: 'next', value: 2 }, { type: 'complete' }]);
  const fail = bindNodeCallback((callback) => callback(new Error('cb-error')));
  assert.deepEqual(collect(fail()), [{ type: 'error', message: 'cb-error' }]);
});

test('firstValueFrom resolves the first value and tears the source down', async () => {
  const events = [];
  const source = createObservable((subscriber) => {
    events.push('run');
    subscriber.next('first');
    subscriber.next('second');
    return () => events.push('teardown');
  });
  assert.equal(await firstValueFrom(source), 'first');
  assert.deepEqual(events, ['run', 'teardown']);
});

test('firstValueFrom and lastValueFrom handle empty sources per config', async () => {
  await assert.rejects(firstValueFrom(EMPTY), { name: 'EmptyError' });
  await assert.rejects(lastValueFrom(EMPTY), { name: 'EmptyError' });
  assert.equal(await firstValueFrom(EMPTY, { defaultValue: 'df' }), 'df');
  assert.equal(await lastValueFrom(EMPTY, { defaultValue: 'dl' }), 'dl');
  assert.equal(await lastValueFrom(of(1, 2, 3)), 3);
  await assert.rejects(
    firstValueFrom(defer(() => {
      throw new Error('src');
    })),
    { message: 'src' }
  );
});

test('flattening projections accept any ObservableInput since M16', async () => {
  assert.deepEqual(
    collect(pipeValue(of(1, 2), mergeMap((v) => [v, v * 10]))).map((e) => e.value ?? e.type),
    [1, 10, 2, 20, 'complete']
  );
  assert.deepEqual(
    collect(pipeValue(of('a'), concatMap((v) => new Set([v, `${v}!`])))).map(
      (e) => e.value ?? e.type
    ),
    ['a', 'a!', 'complete']
  );
  assert.deepEqual(
    await collectAsync(pipeValue(of(7), switchMap((v) => Promise.resolve(v * 2)))),
    [{ type: 'next', value: 14 }, { type: 'complete' }]
  );
});

test('coordination inputs accept any ObservableInput since M16', async () => {
  assert.deepEqual(
    collect(concat([[1, 2], of(3)])).map((e) => e.value ?? e.type),
    [1, 2, 3, 'complete']
  );
  assert.deepEqual(
    collect(merge([['a'], ['b']])).map((e) => e.value ?? e.type),
    ['a', 'b', 'complete']
  );
  assert.deepEqual(
    collect(zip([[1, 2], ['x', 'y']])).map((e) => e.value ?? e.type),
    [[1, 'x'], [2, 'y'], 'complete']
  );
  assert.deepEqual(
    collect(combineLatest([[1, 2], ['x']])).map((e) => e.value ?? e.type),
    [[2, 'x'], 'complete']
  );
  assert.deepEqual(
    await collectAsync(forkJoin([Promise.resolve(1), Promise.resolve(2)])),
    [{ type: 'next', value: [1, 2] }, { type: 'complete' }]
  );
  assert.deepEqual(
    collect(race([['sync'], NEVER])).map((e) => e.value ?? e.type),
    ['sync', 'complete']
  );
});

test('notifiers and recovery selectors accept any ObservableInput since M16', async () => {
  assert.deepEqual(
    collect(
      pipeValue(
        defer(() => {
          throw new Error('x');
        }),
        catchError(() => ['recovered'])
      )
    ).map((e) => e.value ?? e.type),
    ['recovered', 'complete']
  );

  const subject = createSubject();
  const gate = new Promise((resolve) => setTimeout(() => resolve('stop'), 10));
  const received = [];
  const done = new Promise((resolve) => {
    subscribe({ next: (v) => received.push(v), complete: () => resolve() })(
      pipeValue(subject, takeUntil(gate))
    );
  });
  subject.next(1);
  await done;
  subject.next(2);
  assert.deepEqual(received, [1]);
});
