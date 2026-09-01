import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMPTY as RX_EMPTY,
  NEVER as RX_NEVER,
  bindCallback as rxBindCallback,
  bindNodeCallback as rxBindNodeCallback,
  catchError as rxCatchError,
  combineLatest as rxCombineLatest,
  concat as rxConcat,
  concatMap as rxConcatMap,
  defer as rxDefer,
  empty as rxEmpty,
  firstValueFrom as rxFirstValueFrom,
  forkJoin as rxForkJoin,
  from as rxFrom,
  fromEvent as rxFromEvent,
  fromEventPattern as rxFromEventPattern,
  generate as rxGenerate,
  iif as rxIif,
  isObservable as rxIsObservable,
  lastValueFrom as rxLastValueFrom,
  mergeMap as rxMergeMap,
  never as rxNever,
  observable as rxObservableSymbol,
  of as rxOf,
  pairs as rxPairs,
  race as rxRace,
  range as rxRange,
  takeUntil as rxTakeUntil,
  throwError as rxThrowError,
  using as rxUsing,
  zip as rxZip,
} from 'rxjs';
import { bindCallback, bindNodeCallback } from '../../src/compat/bind-callback.ts';
import { combineLatest, forkJoin, race, zip } from '../../src/compat/coordination.ts';
import { subscribe } from '../../src/compat/observable.ts';
import { firstValueFrom, lastValueFrom } from '../../src/compat/promise.ts';
import { concat } from '../../src/compat/coordination.ts';
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
import { throwError } from '../../src/kernel/creation/throw-error.ts';
import { using } from '../../src/kernel/creation/using.ts';
import { isObservable, observable as observableSymbol } from '../../src/kernel/interop.ts';
import { catchError } from '../../src/kernel/operators/catch-error.ts';
import { concatMap } from '../../src/kernel/operators/concat-map.ts';
import { mergeMap } from '../../src/kernel/operators/merge-map.ts';
import { takeUntil } from '../../src/kernel/operators/take-until.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';

const adapters = {
  rxjs: {
    from: rxFrom,
    of: rxOf,
    defer: rxDefer,
    iif: rxIif,
    range: rxRange,
    generate: rxGenerate,
    using: rxUsing,
    pairs: rxPairs,
    empty: rxEmpty,
    never: rxNever,
    EMPTY: RX_EMPTY,
    NEVER: RX_NEVER,
    fromEvent: rxFromEvent,
    fromEventPattern: rxFromEventPattern,
    bindCallback: rxBindCallback,
    bindNodeCallback: rxBindNodeCallback,
    firstValueFrom: rxFirstValueFrom,
    lastValueFrom: rxLastValueFrom,
    isObservable: rxIsObservable,
    observableSymbol: rxObservableSymbol,
    throwError: rxThrowError,
    concat: rxConcat,
    combineLatest: rxCombineLatest,
    forkJoin: rxForkJoin,
    race: rxRace,
    zip: rxZip,
    mergeMap: rxMergeMap,
    concatMap: rxConcatMap,
    takeUntil: rxTakeUntil,
    catchError: rxCatchError,
    apply: (source, ...operators) => source.pipe(...operators),
    run: (source, observer) => source.subscribe(observer),
  },
  pureFp: {
    from,
    of,
    defer,
    iif,
    range,
    generate,
    using,
    pairs,
    empty,
    never,
    EMPTY,
    NEVER,
    fromEvent,
    fromEventPattern,
    bindCallback,
    bindNodeCallback,
    firstValueFrom,
    lastValueFrom,
    isObservable,
    observableSymbol,
    throwError,
    concat,
    combineLatest,
    forkJoin,
    race,
    zip,
    mergeMap,
    concatMap,
    takeUntil,
    catchError,
    apply: pipeValue,
    run: (source, observer) => subscribe(observer)(source),
  },
};

const trace = (adapter, source) => {
  const events = [];
  const subscription = adapter.run(source, {
    next: (value) => events.push({ type: 'next', value }),
    error: (error) => events.push({ type: 'error', name: error?.name, message: error?.message }),
    complete: () => events.push({ type: 'complete' }),
  });
  return { events, subscription };
};

const traceAsync = (adapter, source) =>
  new Promise((resolve) => {
    const events = [];
    adapter.run(source, {
      next: (value) => events.push({ type: 'next', value }),
      error: (error) => {
        events.push({ type: 'error', name: error?.name, message: error?.message });
        resolve(events);
      },
      complete: () => {
        events.push({ type: 'complete' });
        resolve(events);
      },
    });
  });

const compareSync = (scenario) => {
  const actual = scenario(adapters.pureFp);
  const expected = scenario(adapters.rxjs);
  assert.deepEqual(actual, expected);
  return expected;
};

const compareAsync = async (scenario) => {
  const actual = await scenario(adapters.pureFp);
  const expected = await scenario(adapters.rxjs);
  assert.deepEqual(actual, expected);
  return expected;
};

test('differential: from over synchronous input kinds', () => {
  compareSync((a) => trace(a, a.from([1, 2, 3])).events);
  compareSync((a) => trace(a, a.from('ab')).events);
  compareSync((a) => trace(a, a.from(new Set(['x', 'y']))).events);
  compareSync((a) => trace(a, a.from({ length: 2, 0: 'p', 1: 'q' })).events);
});

test('differential: from over promises and async iterables', async () => {
  await compareAsync((a) => traceAsync(a, a.from(Promise.resolve('v'))));
  await compareAsync((a) => traceAsync(a, a.from(Promise.reject(new Error('boom')))));
  await compareAsync((a) => {
    async function* numbers() {
      yield 1;
      yield 2;
    }
    return traceAsync(a, a.from(numbers()));
  });
});

test('differential: from over Symbol.observable interop carriers', () => {
  compareSync((a) => {
    const interop = {
      [a.observableSymbol]() {
        return {
          subscribe(subscriber) {
            subscriber.next('interop');
            subscriber.complete();
            return { unsubscribe: () => {} };
          },
        };
      },
    };
    return trace(a, a.from(interop)).events;
  });
});

test('differential: from rejects unconvertible inputs with identical TypeErrors', () => {
  for (const input of [42, null, undefined, {}]) {
    compareSync((a) => {
      try {
        a.from(input);
        return 'no-throw';
      } catch (error) {
        return { name: error.name, message: error.message };
      }
    });
  }
});

test('differential: defer counts factory calls per subscription and routes throws', () => {
  compareSync((a) => {
    const calls = [];
    const source = a.defer(() => {
      calls.push('factory');
      return a.of(calls.length);
    });
    const first = trace(a, source).events;
    const second = trace(a, source).events;
    return { calls, first, second };
  });
  compareSync(
    (a) =>
      trace(
        a,
        a.defer(() => {
          throw new Error('factory');
        })
      ).events
  );
});

test('differential: iif selects the branch at subscription time', () => {
  compareSync((a) => {
    let flag = true;
    const source = a.iif(() => flag, a.of('T'), a.of('F'));
    const whenTrue = trace(a, source).events;
    flag = false;
    const whenFalse = trace(a, source).events;
    return { whenTrue, whenFalse };
  });
});

test('differential: range argument shuffle and shared EMPTY on non-positive counts', () => {
  compareSync((a) => trace(a, a.range(2, 3)).events);
  compareSync((a) => trace(a, a.range(3)).events);
  compareSync((a) => trace(a, a.range(5, 0)).events);
  compareSync((a) => a.range(5, -1) === a.EMPTY);
});

test('differential: generate positional and options forms', () => {
  compareSync((a) => trace(a, a.generate(1, (x) => x <= 3, (x) => x + 1)).events);
  compareSync((a) => trace(a, a.generate(1, (x) => x <= 2, (x) => x + 1, (x) => x * 10)).events);
  compareSync(
    (a) =>
      trace(
        a,
        a.generate({
          initialState: 2,
          condition: (x) => x < 20,
          iterate: (x) => x * 2,
          resultSelector: (x) => `v${x}`,
        })
      ).events
  );
  compareSync(
    (a) =>
      trace(
        a,
        a.generate(0, () => true, () => {
          throw new Error('iterate');
        })
      ).events
  );
});

test('differential: using resource lifecycle ordering', () => {
  compareSync((a) => {
    const events = [];
    const source = a.using(
      () => {
        events.push('create');
        return { unsubscribe: () => events.push('dispose') };
      },
      () => a.of('value')
    );
    trace(a, source);
    return events;
  });
  // Undefined observable factory result subscribes EMPTY.
  compareSync((a) => trace(a, a.using(() => undefined, () => undefined)).events);
});

test('differential: pairs, empty(), never() and the shared constants', () => {
  compareSync((a) => trace(a, a.pairs({ a: 1, b: 2 })).events);
  compareSync((a) => a.empty() === a.EMPTY);
  compareSync((a) => a.never() === a.NEVER);
  compareSync((a) => trace(a, a.EMPTY).events);
  compareSync((a) => {
    const { events, subscription } = trace(a, a.NEVER);
    subscription.unsubscribe();
    return events;
  });
});

test('differential: isObservable over own observables and foreign values', () => {
  compareSync((a) => a.isObservable(a.of(1)));
  compareSync((a) => a.isObservable({}));
  compareSync((a) => a.isObservable(Promise.resolve(1)));
  compareSync((a) => a.isObservable(null));
});

test('differential: fromEvent over node-style emitters, multi-arg events, result selectors', () => {
  const makeEmitter = (log) => {
    const listeners = new Set();
    return {
      addListener: (name, handler) => {
        log.push(`add:${name}`);
        listeners.add(handler);
      },
      removeListener: (name, handler) => {
        log.push(`remove:${name}`);
        listeners.delete(handler);
      },
      emit: (...args) => {
        for (const listener of [...listeners]) listener(...args);
      },
    };
  };

  compareSync((a) => {
    const log = [];
    const emitter = makeEmitter(log);
    const { subscription } = trace(a, a.fromEvent(emitter, 'data'));
    emitter.emit('single');
    emitter.emit('x', 'y');
    subscription.unsubscribe();
    return log;
  });

  compareSync((a) => {
    const log = [];
    const emitter = makeEmitter([]);
    const { subscription } = trace(a, a.fromEvent(emitter, 'data', (x, y) => `${x}+${y}`));
    const received = trace(a, a.fromEvent(emitter, 'data', (x, y) => `${x}+${y}`));
    emitter.emit('a', 'b');
    subscription.unsubscribe();
    received.subscription.unsubscribe();
    return received.events;
  });

  compareSync((a) => {
    try {
      a.fromEvent({}, 'evt');
      return 'no-throw';
    } catch (error) {
      return { name: error.name, message: error.message };
    }
  });
});

test('differential: fromEventPattern passes the registration signal to removal', () => {
  compareSync((a) => {
    const log = [];
    let handler = null;
    const source = a.fromEventPattern(
      (h) => {
        handler = h;
        log.push('add');
        return 'signal';
      },
      (h, signal) => log.push(`remove:${signal}`)
    );
    const { events, subscription } = trace(a, source);
    handler('one');
    handler('x', 'y');
    subscription.unsubscribe();
    return { log, events };
  });
});

test('differential: bindCallback sync completion, replay, and async multi-results', async () => {
  compareSync((a) => {
    let calls = 0;
    const bound = a.bindCallback((input, callback) => {
      calls += 1;
      callback(input * 2);
    });
    const source = bound(21);
    const first = trace(a, source).events;
    const second = trace(a, source).events;
    return { calls, first, second };
  });
  await compareAsync((a) => {
    const bound = a.bindCallback((callback) => setTimeout(() => callback('a', 'b')));
    return traceAsync(a, bound());
  });
});

test('differential: bindNodeCallback error-first protocol', () => {
  compareSync((a) => {
    const ok = a.bindNodeCallback((value, callback) => callback(null, value + 1));
    return trace(a, ok(1)).events;
  });
  compareSync((a) => {
    const fail = a.bindNodeCallback((callback) => callback(new Error('cb-error')));
    return trace(a, fail()).events;
  });
});

test('differential: firstValueFrom and lastValueFrom settle identically', async () => {
  await compareAsync((a) => a.firstValueFrom(a.of(1, 2)));
  await compareAsync((a) => a.lastValueFrom(a.of(1, 2)));
  await compareAsync((a) => a.firstValueFrom(a.EMPTY, { defaultValue: 'd' }));
  await compareAsync((a) => a.lastValueFrom(a.EMPTY, { defaultValue: 'd' }));
  await compareAsync((a) =>
    a.firstValueFrom(a.EMPTY).catch((error) => ({ name: error.name }))
  );
  await compareAsync((a) =>
    a.lastValueFrom(a.throwError(() => new Error('bang'))).catch((error) => error.message)
  );
});

test('differential: flattening projections accept ObservableInput inners', async () => {
  compareSync((a) =>
    trace(a, a.apply(a.of(1, 2), a.mergeMap((v) => [v, v * 10]))).events
  );
  compareSync((a) =>
    trace(a, a.apply(a.of('a'), a.concatMap((v) => new Set([v, `${v}!`])))).events
  );
  await compareAsync((a) =>
    traceAsync(a, a.apply(a.of(7), a.mergeMap((v) => Promise.resolve(v * 2))))
  );
});

test('differential: coordination surfaces accept ObservableInput sources', async () => {
  compareSync((a) => trace(a, a.concat([1, 2], a.of(3))).events);
  compareSync((a) => trace(a, a.zip([1, 2], ['x', 'y'])).events);
  compareSync((a) => trace(a, a.combineLatest([[1, 2], ['x']])).events);
  compareSync((a) => trace(a, a.race(['sync'], a.NEVER)).events);
  await compareAsync((a) =>
    traceAsync(a, a.forkJoin({ one: Promise.resolve(1), two: Promise.resolve(2) }))
  );
});

test('differential: notifiers and recovery selectors accept ObservableInput', async () => {
  compareSync((a) =>
    trace(
      a,
      a.apply(
        a.defer(() => {
          throw new Error('x');
        }),
        a.catchError(() => ['recovered'])
      )
    ).events
  );
  await compareAsync(async (a) => {
    const events = [];
    const source = a.apply(
      a.of('kept'),
      a.takeUntil(new Promise((resolve) => setTimeout(() => resolve('stop'), 20)))
    );
    await new Promise((resolve) => {
      a.run(source, {
        next: (value) => events.push(value),
        error: () => resolve(),
        complete: () => resolve(),
      });
    });
    return events;
  });
});
