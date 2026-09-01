import assert from 'node:assert/strict';
import test from 'node:test';

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

const collect = (source) => {
  const events = [];
  subscribe({
    next: (value) => events.push({ next: value }),
    error: (error) => events.push({ error: error instanceof Error ? error.message : error }),
    complete: () => events.push('complete'),
  })(source);
  return events;
};

const values = (source) => {
  const emitted = [];
  subscribe({ next: (value) => emitted.push(value) })(source);
  return emitted;
};

test('M17 materialize: notifications become data and the result completes', () => {
  assert.deepEqual(collect(materialize()(of(1, 2))), [
    { next: { kind: 'N', value: 1, error: undefined, hasValue: true } },
    { next: { kind: 'N', value: 2, error: undefined, hasValue: true } },
    { next: { kind: 'C', value: undefined, error: undefined, hasValue: false } },
    'complete',
  ]);

  const boom = new Error('boom');
  assert.deepEqual(collect(materialize()(throwError(boom))), [
    { next: { kind: 'E', value: undefined, error: boom, hasValue: false } },
    'complete',
  ]);
});

test('M17 materialize: complete records are one shared frozen instance', () => {
  const first = values(materialize()(EMPTY));
  const second = values(materialize()(EMPTY));
  assert.equal(first[0], second[0]);
  assert.ok(Object.isFrozen(first[0]));
});

test('M17 dematerialize: round trip and record replay', () => {
  assert.deepEqual(collect(dematerialize()(materialize()(of('a', 'b')))), [
    { next: 'a' },
    { next: 'b' },
    'complete',
  ]);
  assert.deepEqual(collect(dematerialize()(materialize()(throwError(new Error('boom'))))), [
    { error: 'boom' },
  ]);
  assert.deepEqual(collect(dematerialize()(of({ kind: 'N', value: 7 }, { kind: 'C' }))), [
    { next: 7 },
    'complete',
  ]);
});

test('M17 dematerialize: invalid records raise the RxJS validation TypeError', () => {
  const events = collect(dematerialize()(of({ value: 1 })));
  assert.deepEqual(events, [{ error: 'Invalid notification, missing "kind"' }]);
});

test('M17 Notification factory: statics produce class-shaped records', () => {
  const next = Notification.createNext(5);
  assert.deepEqual({ ...next }, { kind: 'N', value: 5, error: undefined, hasValue: true });

  const error = Notification.createError('reason');
  assert.deepEqual({ ...error }, { kind: 'E', value: undefined, error: 'reason', hasValue: false });

  assert.equal(Notification.createComplete(), Notification.createComplete());
  assert.deepEqual(
    { ...Notification.createComplete() },
    { kind: 'C', value: undefined, error: undefined, hasValue: false }
  );

  // Deprecated constructor form preserves arguments verbatim.
  assert.deepEqual({ ...Notification('E', 'kept', 'err') }, {
    kind: 'E',
    value: 'kept',
    error: 'err',
    hasValue: false,
  });
});

test('M17 Notification methods: observe/do/accept dispatch, toObservable maps kinds', () => {
  const log = [];
  const observer = {
    next: (value) => log.push(`next:${value}`),
    error: (error) => log.push(`error:${error}`),
    complete: () => log.push('complete'),
  };

  Notification.createNext(1).observe(observer);
  Notification.createError('x').observe(observer);
  Notification.createComplete().observe(observer);
  Notification.createNext(2).do((value) => log.push(`do:${value}`));
  Notification.createNext(3).accept(observer);
  Notification.createError('y').accept(
    () => log.push('wrong'),
    (error) => log.push(`accept-error:${error}`)
  );
  assert.deepEqual(log, ['next:1', 'error:x', 'complete', 'do:2', 'next:3', 'accept-error:y']);

  assert.deepEqual(collect(Notification.createNext(9).toObservable()), [{ next: 9 }, 'complete']);
  assert.deepEqual(collect(Notification.createError(new Error('bad')).toObservable()), [
    { error: 'bad' },
  ]);
  assert.deepEqual(collect(Notification.createComplete().toObservable()), ['complete']);
  assert.equal(Notification.createComplete().toObservable(), EMPTY);
});

test('M17 NotificationKind: string-enum runtime shape', () => {
  assert.deepEqual({ ...NotificationKind }, { NEXT: 'N', ERROR: 'E', COMPLETE: 'C' });
});

test('M17 timeInterval: measures elapsed scheduler time between emissions', () => {
  const ticks = [0, 5, 15, 40];
  let call = 0;
  const scheduler = { now: () => ticks[call++] };
  assert.deepEqual(collect(timeInterval(scheduler)(of('a', 'b', 'c'))), [
    { next: { value: 'a', interval: 5 } },
    { next: { value: 'b', interval: 10 } },
    { next: { value: 'c', interval: 25 } },
    'complete',
  ]);
});

test('M17 timestamp: pairs values with the provider clock', () => {
  let now = 100;
  const provider = { now: () => (now += 1) };
  assert.deepEqual(collect(timestamp(provider)(of('x', 'y'))), [
    { next: { value: 'x', timestamp: 101 } },
    { next: { value: 'y', timestamp: 102 } },
    'complete',
  ]);
});

test('M17 startWith/endWith: prefix and suffix ordering', () => {
  assert.deepEqual(values(startWith(0)(of(1, 2))), [0, 1, 2]);
  assert.deepEqual(values(startWith(-1, 0)(EMPTY)), [-1, 0]);
  assert.deepEqual(collect(startWith('s')(throwError(new Error('late')))), [
    { next: 's' },
    { error: 'late' },
  ]);
  assert.deepEqual(values(endWith(3, 4)(of(1, 2))), [1, 2, 3, 4]);
  assert.deepEqual(collect(endWith('only')(EMPTY)), [{ next: 'only' }, 'complete']);
});

test('M17 ignoreElements: values dropped, terminals pass', () => {
  assert.deepEqual(collect(ignoreElements()(of(1, 2, 3))), ['complete']);
  assert.deepEqual(collect(ignoreElements()(throwError(new Error('kept')))), [{ error: 'kept' }]);
});

test('M17 mapTo: constant projection', () => {
  assert.deepEqual(values(mapTo('k')(of(1, 2, 3))), ['k', 'k', 'k']);
});

test('M17 pluck: nested access with the RxJS undefined short-circuit', () => {
  assert.deepEqual(values(pluck('a', 'b')(of({ a: { b: 1 } }, { a: { b: 2 } }))), [1, 2]);
  assert.deepEqual(values(pluck('a', 'b')(of({ a: null }, {}, { a: { b: 3 } }))), [
    undefined,
    undefined,
    3,
  ]);
  // A present-but-undefined property short-circuits like a missing one.
  assert.deepEqual(values(pluck('a')(of({ a: undefined }))), [undefined]);
  assert.throws(() => pluck(), { message: 'list of properties cannot be empty.' });
});

test('M17 toArray: collects per subscription without shared state', () => {
  const collected = toArray()(of(1, 2, 3));
  const first = values(collected);
  const second = values(collected);
  assert.deepEqual(first, [[1, 2, 3]]);
  assert.deepEqual(second, [[1, 2, 3]]);
  assert.notEqual(first[0], second[0]);
  assert.deepEqual(collect(toArray()(EMPTY)), [{ next: [] }, 'complete']);
});

test('M17 isEmpty: answers on the first decisive event', () => {
  assert.deepEqual(collect(isEmpty()(EMPTY)), [{ next: true }, 'complete']);
  assert.deepEqual(collect(isEmpty()(of(1, 2, 3))), [{ next: false }, 'complete']);
  assert.deepEqual(collect(isEmpty()(throwError(new Error('bad')))), [{ error: 'bad' }]);
});

test('M17 sequenceEqual: buffered symmetric comparison', () => {
  assert.deepEqual(collect(sequenceEqual([1, 2, 3])(of(1, 2, 3))), [{ next: true }, 'complete']);
  assert.deepEqual(collect(sequenceEqual([1, 9, 3])(of(1, 2, 3))), [{ next: false }, 'complete']);
  assert.deepEqual(collect(sequenceEqual([1, 2])(of(1, 2, 3))), [{ next: false }, 'complete']);
  assert.deepEqual(collect(sequenceEqual([1, 2, 3])(of(1, 2))), [{ next: false }, 'complete']);
  assert.deepEqual(
    collect(sequenceEqual(['A', 'B'], (a, b) => a.toUpperCase() === b.toUpperCase())(of('a', 'b'))),
    [{ next: true }, 'complete']
  );
});

test('M17 retryWhen: notifier emissions resubscribe, notifier completion completes', () => {
  let attempts = 0;
  const flaky = createObservable((subscriber) => {
    attempts += 1;
    if (attempts < 3) {
      subscriber.error(new Error(`fail-${attempts}`));
    } else {
      subscriber.next('ok');
      subscriber.complete();
    }
  });
  assert.deepEqual(collect(retryWhen((errors) => errors)(flaky)), [{ next: 'ok' }, 'complete']);
  assert.equal(attempts, 3);

  assert.deepEqual(collect(retryWhen(() => EMPTY)(throwError(new Error('x')))), ['complete']);
});

test('M17 repeatWhen: notifier-driven repetition with joint completion', () => {
  // A synchronous source completes during the syncResub handshake: the second
  // notifier emission both resubscribes and completes the notifier, so the
  // destination completes before the third run can deliver values — RxJS
  // yields [1, 2, 1, 2] here, not the async-source [1, 2, 1, 2, 1, 2].
  assert.deepEqual(
    values(repeatWhen((completions) => take(2)(completions))(of(1, 2))),
    [1, 2, 1, 2]
  );
  assert.deepEqual(collect(repeatWhen(() => EMPTY)(of('once'))), [{ next: 'once' }, 'complete']);
});

test('M17 onErrorResumeNext: swallows terminals, skips unconvertible inputs', () => {
  assert.deepEqual(
    collect(onErrorResumeNext(throwError(new Error('a')), of(1), 42, of(2))),
    [{ next: 1 }, { next: 2 }, 'complete']
  );
  assert.deepEqual(collect(onErrorResumeNext([of('x'), throwError(new Error('b'))])), [
    { next: 'x' },
    'complete',
  ]);
  assert.deepEqual(collect(onErrorResumeNext()), ['complete']);
});

test('M17 onErrorResumeNextWith: source errors resume into the next sources', () => {
  assert.deepEqual(
    values(pipeValue(throwError(new Error('dead')), onErrorResumeNextWith(of(1), of(2)))),
    [1, 2]
  );
  assert.deepEqual(values(pipeValue(of(0), onErrorResumeNextWith([of(1)]))), [0, 1]);
});

test('M17 exhaust: deprecated alias is the exact exhaustAll reference', () => {
  assert.equal(exhaust, exhaustAll);
  assert.deepEqual(values(exhaust()(of(of(1, 2), of(3)))), [1, 2, 3]);
});
