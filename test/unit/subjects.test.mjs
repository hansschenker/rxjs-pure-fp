import assert from 'node:assert/strict';
import test from 'node:test';

import { subscribe } from '../../src/compat/observable.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { isBrandedObservable } from '../../src/kernel/observable.ts';
import { map } from '../../src/kernel/operators/map.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { createBehaviorSubject, createSubject } from '../../src/kernel/subject.ts';

test('M10 subjects are branded callable observables usable in pipelines', () => {
  const subject = createSubject();
  assert.equal(isBrandedObservable(subject), true);

  const events = [];
  subscribe({ next: (value) => events.push(value), complete: () => events.push('complete') })(
    pipeValue(subject, map((value) => value * 10))
  );
  subject.next(1);
  subject.next(2);
  subject.complete();
  assert.deepEqual(events, [10, 20, 'complete']);
});

test('M10 the hub is the documented shared topology: one execution, many observers', () => {
  const subject = createSubject();
  const seen = { a: [], b: [] };
  subscribe({ next: (value) => seen.a.push(value) })(subject);
  subscribe({ next: (value) => seen.b.push(value) })(subject);
  subscribe(subject)(of('shared'));
  assert.deepEqual(seen, { a: ['shared'], b: ['shared'] });
});

test('M10 behavior policy keeps a live value field and a throwing getValue', () => {
  const subject = createBehaviorSubject(0);
  subject.next(5);
  assert.equal(subject.value, 5);
  assert.equal(subject.getValue(), 5);
  subject.error(new Error('gone'));
  assert.throws(() => subject.getValue(), /gone/);
});
