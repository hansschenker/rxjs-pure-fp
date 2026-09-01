import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMPTY as RX_EMPTY,
  Notification as RxNotification,
  NotificationKind as RxNotificationKind,
  Observable as RxObservable,
  dematerialize as rxDematerialize,
  endWith as rxEndWith,
  exhaust as rxExhaust,
  exhaustAll as rxExhaustAll,
  ignoreElements as rxIgnoreElements,
  isEmpty as rxIsEmpty,
  mapTo as rxMapTo,
  materialize as rxMaterialize,
  of as rxOf,
  onErrorResumeNext as rxOnErrorResumeNext,
  onErrorResumeNextWith as rxOnErrorResumeNextWith,
  pluck as rxPluck,
  repeatWhen as rxRepeatWhen,
  retryWhen as rxRetryWhen,
  sequenceEqual as rxSequenceEqual,
  startWith as rxStartWith,
  take as rxTake,
  throwError as rxThrowError,
  timeInterval as rxTimeInterval,
  timestamp as rxTimestamp,
  toArray as rxToArray,
} from 'rxjs';
import { subscribe } from '../../src/compat/observable.ts';
import { Notification, NotificationKind } from '../../src/compat/notification.ts';
import {
  onErrorResumeNext,
  onErrorResumeNextWith,
} from '../../src/compat/on-error-resume-next.ts';
import { EMPTY } from '../../src/kernel/creation/empty.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { throwError } from '../../src/kernel/creation/throw-error.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { dematerialize } from '../../src/kernel/operators/dematerialize.ts';
import { endWith } from '../../src/kernel/operators/end-with.ts';
import { exhaust } from '../../src/kernel/operators/exhaust.ts';
import { exhaustAll } from '../../src/kernel/operators/exhaust-all.ts';
import { ignoreElements } from '../../src/kernel/operators/ignore-elements.ts';
import { isEmpty } from '../../src/kernel/operators/is-empty.ts';
import { mapTo } from '../../src/kernel/operators/map-to.ts';
import { materialize } from '../../src/kernel/operators/materialize.ts';
import { pluck } from '../../src/kernel/operators/pluck.ts';
import { repeatWhen } from '../../src/kernel/operators/repeat-when.ts';
import { retryWhen } from '../../src/kernel/operators/retry-when.ts';
import { sequenceEqual } from '../../src/kernel/operators/sequence-equal.ts';
import { startWith } from '../../src/kernel/operators/start-with.ts';
import { take } from '../../src/kernel/operators/take.ts';
import { timeInterval } from '../../src/kernel/operators/time-interval.ts';
import { timestamp } from '../../src/kernel/operators/timestamp.ts';
import { toArray } from '../../src/kernel/operators/to-array.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';

const adapters = {
  rxjs: {
    create: (initializer) => new RxObservable(initializer),
    of: rxOf,
    EMPTY: RX_EMPTY,
    throwError: rxThrowError,
    Notification: RxNotification,
    NotificationKind: RxNotificationKind,
    makeNotification: (kind, value, error) => new RxNotification(kind, value, error),
    materialize: rxMaterialize,
    dematerialize: rxDematerialize,
    timeInterval: rxTimeInterval,
    timestamp: rxTimestamp,
    startWith: rxStartWith,
    endWith: rxEndWith,
    ignoreElements: rxIgnoreElements,
    mapTo: rxMapTo,
    pluck: rxPluck,
    toArray: rxToArray,
    isEmpty: rxIsEmpty,
    sequenceEqual: rxSequenceEqual,
    retryWhen: rxRetryWhen,
    repeatWhen: rxRepeatWhen,
    onErrorResumeNext: rxOnErrorResumeNext,
    onErrorResumeNextWith: rxOnErrorResumeNextWith,
    exhaust: rxExhaust,
    exhaustAll: rxExhaustAll,
    take: rxTake,
    apply: (source, ...operators) => source.pipe(...operators),
    run: (source, observer) => source.subscribe(observer),
  },
  pureFp: {
    create: createObservable,
    of,
    EMPTY,
    throwError,
    Notification,
    NotificationKind,
    makeNotification: (kind, value, error) => Notification(kind, value, error),
    materialize,
    dematerialize,
    timeInterval,
    timestamp,
    startWith,
    endWith,
    ignoreElements,
    mapTo,
    pluck,
    toArray,
    isEmpty,
    sequenceEqual,
    retryWhen,
    repeatWhen,
    onErrorResumeNext,
    onErrorResumeNextWith,
    exhaust,
    exhaustAll,
    take,
    apply: pipeValue,
    run: (source, observer) => subscribe(observer)(source),
  },
};

const trace = (adapter, source) => {
  const events = [];
  adapter.run(source, {
    next: (value) => events.push({ type: 'next', value }),
    error: (error) => events.push({ type: 'error', name: error?.name, message: error?.message }),
    complete: () => events.push({ type: 'complete' }),
  });
  return events;
};

const compareSync = (scenario) => {
  const actual = scenario(adapters.pureFp);
  const expected = scenario(adapters.rxjs);
  assert.deepEqual(actual, expected);
  return expected;
};

// A cold source whose behavior per run is scripted: numbers emit, 'error'
// errors, 'complete' completes; run and teardown ordering is part of the trace.
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

// Strict deepEqual compares prototypes, so RxJS Notification instances must be
// normalized to plain records (their own enumerable data) before comparison;
// error records additionally carry the error object as data.
const plainNotifications = (events) =>
  events.map((event) =>
    event.type === 'next'
      ? {
          ...event,
          value: {
            ...event.value,
            ...(event.value.kind === 'E' ? { error: event.value.error?.message } : {}),
          },
        }
      : event
  );

test('differential: materialize reifies value, complete, and error protocols', () => {
  compareSync((a) => plainNotifications(trace(a, a.materialize()(a.of(1, 2)))));
  compareSync((a) => plainNotifications(trace(a, a.materialize()(a.EMPTY))));
  compareSync((a) =>
    plainNotifications(trace(a, a.materialize()(a.throwError(() => new Error('boom')))))
  );
});

test('differential: materialize/dematerialize round trips', () => {
  compareSync((a) => trace(a, a.apply(a.of('a', 'b'), a.materialize(), a.dematerialize())));
  compareSync((a) =>
    trace(a, a.apply(a.throwError(() => new Error('boom')), a.materialize(), a.dematerialize()))
  );
});

test('differential: dematerialize replays plain records, unknown kinds, invalid records', () => {
  compareSync((a) => trace(a, a.dematerialize()(a.of({ kind: 'N', value: 7 }, { kind: 'C' }))));
  compareSync((a) => trace(a, a.dematerialize()(a.of({ kind: 'E', error: 'plain' }))));
  // Unknown string kinds fall through to complete in RxJS.
  compareSync((a) => trace(a, a.dematerialize()(a.of({ kind: 'X' }, { kind: 'N', value: 1 }))));
  // Records without a string kind raise the validation TypeError.
  compareSync((a) => trace(a, a.dematerialize()(a.of({ value: 1 }))));
  compareSync((a) => trace(a, a.dematerialize()(a.of(42))));
});

test('differential: Notification factory statics and deprecated constructor', () => {
  compareSync((a) => ({ ...a.Notification.createNext('v') }));
  compareSync((a) => ({ ...a.Notification.createError('reason') }));
  compareSync((a) => ({ ...a.Notification.createComplete() }));
  compareSync((a) => a.Notification.createComplete() === a.Notification.createComplete());
  compareSync((a) => ({ ...a.makeNotification('E', 'kept', 'err') }));
  compareSync((a) => ({ ...a.NotificationKind }));
});

test('differential: Notification observe/do/accept dispatch and toObservable', () => {
  compareSync((a) => {
    const log = [];
    const observer = {
      next: (value) => log.push(`next:${value}`),
      error: (error) => log.push(`error:${error}`),
      complete: () => log.push('complete'),
    };
    a.Notification.createNext(1).observe(observer);
    a.Notification.createError('x').observe(observer);
    a.Notification.createComplete().observe(observer);
    a.Notification.createNext(2).do((value) => log.push(`do:${value}`));
    a.Notification.createNext(3).accept(observer);
    a.Notification.createError('y').accept(
      () => log.push('wrong'),
      (error) => log.push(`accept-error:${error}`)
    );
    return log;
  });
  compareSync((a) => trace(a, a.Notification.createNext(9).toObservable()));
  compareSync((a) => trace(a, a.Notification.createError(new Error('bad')).toObservable()));
  compareSync((a) => trace(a, a.Notification.createComplete().toObservable()));
});

test('differential: timeInterval measures the scheduler clock deterministically', () => {
  compareSync((a) => {
    const ticks = [0, 5, 15, 40];
    let call = 0;
    const scheduler = { now: () => ticks[call++] };
    return trace(a, a.timeInterval(scheduler)(a.of('a', 'b', 'c'))).map((event) =>
      event.type === 'next' ? { ...event, value: { ...event.value } } : event
    );
  });
});

test('differential: timestamp pairs values with the provider clock', () => {
  compareSync((a) => {
    let now = 100;
    const provider = { now: () => (now += 1) };
    return trace(a, a.timestamp(provider)(a.of('x', 'y')));
  });
});

test('differential: startWith and endWith ordering across terminals', () => {
  compareSync((a) => trace(a, a.startWith(0)(a.of(1, 2))));
  compareSync((a) => trace(a, a.startWith(-1, 0)(a.EMPTY)));
  compareSync((a) => trace(a, a.startWith('s')(a.throwError(() => new Error('late')))));
  compareSync((a) => trace(a, a.endWith(3, 4)(a.of(1, 2))));
  compareSync((a) => trace(a, a.endWith('only')(a.EMPTY)));
  compareSync((a) => trace(a, a.endWith('never')(a.throwError(() => new Error('early')))));
});

test('differential: ignoreElements, mapTo, pluck projections', () => {
  compareSync((a) => trace(a, a.ignoreElements()(a.of(1, 2, 3))));
  compareSync((a) => trace(a, a.ignoreElements()(a.throwError(() => new Error('kept')))));
  compareSync((a) => trace(a, a.mapTo('k')(a.of(1, 2, 3))));
  compareSync((a) => trace(a, a.pluck('a', 'b')(a.of({ a: { b: 1 } }, { a: null }, {}))));
  compareSync((a) => trace(a, a.pluck('a')(a.of({ a: undefined }, { a: 0 }))));
  compareSync((a) => {
    try {
      a.pluck();
      return 'no-throw';
    } catch (error) {
      return { name: error.name, message: error.message };
    }
  });
});

test('differential: toArray and isEmpty aggregation', () => {
  compareSync((a) => trace(a, a.toArray()(a.of(1, 2, 3))));
  compareSync((a) => trace(a, a.toArray()(a.EMPTY)));
  compareSync((a) => trace(a, a.toArray()(a.throwError(() => new Error('lost')))));
  compareSync((a) => trace(a, a.isEmpty()(a.EMPTY)));
  compareSync((a) => trace(a, a.isEmpty()(a.of(1, 2))));
  compareSync((a) => trace(a, a.isEmpty()(a.throwError(() => new Error('bad')))));
});

test('differential: sequenceEqual verdicts and early mismatches', () => {
  compareSync((a) => trace(a, a.sequenceEqual([1, 2, 3])(a.of(1, 2, 3))));
  compareSync((a) => trace(a, a.sequenceEqual([1, 9, 3])(a.of(1, 2, 3))));
  compareSync((a) => trace(a, a.sequenceEqual([1, 2])(a.of(1, 2, 3))));
  compareSync((a) => trace(a, a.sequenceEqual([1, 2, 3])(a.of(1, 2))));
  compareSync((a) => trace(a, a.sequenceEqual([])(a.EMPTY)));
  compareSync((a) =>
    trace(a, a.sequenceEqual(['A'], (x, y) => x.toUpperCase() === y.toUpperCase())(a.of('a')))
  );
});

test('differential: retryWhen resubscription, teardown ordering, notifier endings', () => {
  compareSync((a) => {
    const events = [];
    const source = scripted(a, [['error'], ['error'], [1, 2, 'complete']], events);
    trace(a, a.retryWhen((errors) => errors)(source)).forEach((event) => events.push(event));
    return events;
  });
  compareSync((a) => {
    const events = [];
    const source = scripted(a, [['error']], events);
    trace(a, a.retryWhen(() => a.EMPTY)(source)).forEach((event) => events.push(event));
    return events;
  });
  compareSync((a) => {
    const events = [];
    const source = scripted(a, [['error']], events);
    trace(a, a.retryWhen(() => a.throwError(() => new Error('nope')))(source)).forEach((event) =>
      events.push(event)
    );
    return events;
  });
});

test('differential: repeatWhen resubscription and joint completion', () => {
  compareSync((a) => {
    const events = [];
    const source = scripted(a, [[1, 2, 'complete'], [3, 'complete'], [4, 'complete']], events);
    trace(a, a.repeatWhen((completions) => a.apply(completions, a.take(2)))(source)).forEach(
      (event) => events.push(event)
    );
    return events;
  });
  compareSync((a) => {
    const events = [];
    const source = scripted(a, [[1, 'complete']], events);
    trace(a, a.repeatWhen(() => a.EMPTY)(source)).forEach((event) => events.push(event));
    return events;
  });
});

test('differential: onErrorResumeNext swallows terminals and skips bad inputs', () => {
  compareSync((a) => trace(a, a.onErrorResumeNext(a.throwError(() => new Error('a')), a.of(1), a.of(2))));
  compareSync((a) => trace(a, a.onErrorResumeNext([a.of('x'), a.throwError(() => new Error('b'))])));
  compareSync((a) => trace(a, a.onErrorResumeNext(a.throwError(() => new Error('a')), 42, a.of(9))));
  compareSync((a) => trace(a, a.onErrorResumeNext()));
  compareSync((a) => {
    const events = [];
    const first = scripted(a, [[1, 'error']], events);
    const second = scripted(a, [[2, 'complete']], events);
    trace(a, a.onErrorResumeNext(first, second)).forEach((event) => events.push(event));
    return events;
  });
});

test('differential: onErrorResumeNextWith resumes after source error', () => {
  compareSync((a) =>
    trace(a, a.apply(a.throwError(() => new Error('dead')), a.onErrorResumeNextWith(a.of(1), a.of(2))))
  );
  compareSync((a) => trace(a, a.apply(a.of(0), a.onErrorResumeNextWith([a.of(1)]))));
});

test('differential: exhaust is the exhaustAll alias on both sides', () => {
  compareSync((a) => a.exhaust === a.exhaustAll);
  compareSync((a) => trace(a, a.exhaust()(a.of(a.of(1, 2), a.of(3)))));
});
