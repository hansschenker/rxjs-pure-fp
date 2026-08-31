import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AsyncSubject as RxAsyncSubject,
  BehaviorSubject as RxBehaviorSubject,
  ReplaySubject as RxReplaySubject,
  Subject as RxSubject,
  of as rxOf,
} from 'rxjs';
import { subscribe } from '../../src/compat/observable.ts';
import { Subject as SubjectFactory } from '../../src/compat/subject.ts';
import { of } from '../../src/kernel/creation/of.ts';
import {
  createAsyncSubject,
  createBehaviorSubject,
  createReplaySubject,
  createSubject,
} from '../../src/kernel/subject.ts';

const adapters = {
  rxjs: {
    subject: () => new RxSubject(),
    behavior: (value) => new RxBehaviorSubject(value),
    replay: (size) => (size === undefined ? new RxReplaySubject() : new RxReplaySubject(size)),
    async: () => new RxAsyncSubject(),
    subjectCreate: (destination, source) => RxSubject.create(destination, source),
    of: rxOf,
    subscribe: (observer) => (source) => source.subscribe(observer),
  },
  pureFp: {
    subject: createSubject,
    behavior: createBehaviorSubject,
    replay: createReplaySubject,
    async: createAsyncSubject,
    subjectCreate: (destination, source) => SubjectFactory.create(destination, source),
    of,
    subscribe,
  },
};

const observerInto = (events, tag) => ({
  next: (value) => events.push(`${tag}:${value}`),
  error: (error) => events.push(`${tag}!${error.message}`),
  complete: () => events.push(`${tag}.`),
});

const snapshot = (s) => ({
  closed: s.closed,
  isStopped: s.isStopped,
  hasError: s.hasError,
  observed: s.observed,
});

const multicastTrace = (adapter) => {
  const s = adapter.subject();
  const events = [];
  const states = [snapshot(s)];
  const subA = adapter.subscribe(observerInto(events, 'a'))(s);
  states.push(snapshot(s));
  s.next(1);
  adapter.subscribe(observerInto(events, 'b'))(s);
  s.next(2);
  subA.unsubscribe();
  states.push(snapshot(s));
  s.next(3);
  return { events, states };
};

const terminationTrace = (adapter) => {
  const done = adapter.subject();
  const events = [];
  adapter.subscribe(observerInto(events, 'a'))(done);
  done.next(1);
  done.complete();
  done.next(2);
  done.complete();
  adapter.subscribe(observerInto(events, 'late'))(done);
  const completedState = snapshot(done);

  const failed = adapter.subject();
  adapter.subscribe(observerInto(events, 'x'))(failed);
  failed.error(new Error('subject-boom'));
  adapter.subscribe(observerInto(events, 'lateX'))(failed);
  return {
    events,
    completedState,
    failedState: snapshot(failed),
    thrownMessage: failed.thrownError.message,
  };
};

const unsubscribedTrace = (adapter) => {
  const s = adapter.subject();
  s.unsubscribe();
  const caught = [];
  for (const call of [
    () => s.next(1),
    () => s.error(new Error('e')),
    () => s.complete(),
    () => adapter.subscribe({ next() {} })(s),
  ]) {
    try {
      call();
      caught.push('no-throw');
    } catch (error) {
      caught.push({ name: error.name, message: error.message });
    }
  }
  return { caught, state: snapshot(s) };
};

const reentrantSubscribeTrace = (adapter) => {
  const s = adapter.subject();
  const events = [];
  let added = false;
  adapter.subscribe({
    next: (value) => {
      events.push(`a:${value}`);
      if (!added) {
        added = true;
        adapter.subscribe(observerInto(events, 'b'))(s);
      }
    },
  })(s);
  s.next(1);
  s.next(2);
  return events;
};

const behaviorTrace = (adapter) => {
  const s = adapter.behavior('seed');
  const events = [];
  adapter.subscribe(observerInto(events, 'a'))(s);
  s.next('v1');
  const valueAfterNext = s.value;
  adapter.subscribe(observerInto(events, 'b'))(s);
  s.complete();
  adapter.subscribe(observerInto(events, 'late'))(s);
  const valueAfterComplete = s.getValue();

  const failing = adapter.behavior(0);
  failing.error(new Error('behavior-boom'));
  let thrown;
  try {
    failing.getValue();
  } catch (error) {
    thrown = error.message;
  }
  return { events, valueAfterNext, valueAfterComplete, thrown };
};

const replayTrace = (adapter) => {
  const events = [];
  const all = adapter.replay();
  all.next(1);
  all.next(2);
  adapter.subscribe(observerInto(events, 'all'))(all);
  all.next(3);

  const sized = adapter.replay(2);
  sized.next('a');
  sized.next('b');
  sized.next('c');
  adapter.subscribe(observerInto(events, 'sized'))(sized);

  const completed = adapter.replay(2);
  completed.next('x');
  completed.complete();
  adapter.subscribe(observerInto(events, 'lateC'))(completed);

  const failed = adapter.replay(2);
  failed.next('y');
  failed.error(new Error('replay-boom'));
  adapter.subscribe(observerInto(events, 'lateE'))(failed);

  return events;
};

const asyncTrace = (adapter) => {
  const events = [];
  const s = adapter.async();
  adapter.subscribe(observerInto(events, 'a'))(s);
  s.next(1);
  s.next(2);
  events.push('pre-complete');
  s.complete();
  adapter.subscribe(observerInto(events, 'late'))(s);
  s.next(3);

  const empty = adapter.async();
  adapter.subscribe(observerInto(events, 'empty'))(empty);
  empty.complete();

  const failed = adapter.async();
  failed.next('v');
  failed.error(new Error('async-boom'));
  adapter.subscribe(observerInto(events, 'lateE'))(failed);
  return events;
};

const subjectAsObserverTrace = (adapter) => {
  const s = adapter.subject();
  const events = [];
  adapter.subscribe(observerInto(events, 'out'))(s);
  adapter.subscribe(s)(adapter.of(10, 20));
  return { events, state: snapshot(s) };
};

const asObservableTrace = (adapter) => {
  const s = adapter.subject();
  const view = s.asObservable();
  const events = [];
  adapter.subscribe(observerInto(events, 'v'))(view);
  s.next(1);
  s.complete();
  return { events, viewHasNext: typeof view.next };
};

const subjectCreateTrace = (adapter) => {
  const received = [];
  const destination = {
    next: (value) => received.push(`d:${value}`),
    complete: () => received.push('d.'),
  };
  const s = adapter.subjectCreate(destination, adapter.of('s1', 's2'));
  const events = [];
  adapter.subscribe(observerInto(events, 'sub'))(s);
  s.next('pushed');
  s.complete();
  return { received, events };
};

for (const [name, trace] of Object.entries({
  multicastTrace,
  terminationTrace,
  unsubscribedTrace,
  reentrantSubscribeTrace,
  behaviorTrace,
  replayTrace,
  asyncTrace,
  subjectAsObserverTrace,
  asObservableTrace,
  subjectCreateTrace,
})) {
  test(`M10 ${name} matches RxJS 7.8.2`, () => {
    assert.deepEqual(trace(adapters.pureFp), trace(adapters.rxjs));
  });
}
