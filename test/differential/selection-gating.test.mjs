import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMPTY as RX_EMPTY,
  Observable as RxObservable,
  defaultIfEmpty as rxDefaultIfEmpty,
  elementAt as rxElementAt,
  first as rxFirst,
  last as rxLast,
  of as rxOf,
  single as rxSingle,
  skip as rxSkip,
  skipLast as rxSkipLast,
  skipUntil as rxSkipUntil,
  skipWhile as rxSkipWhile,
  take as rxTake,
  takeLast as rxTakeLast,
  takeUntil as rxTakeUntil,
  takeWhile as rxTakeWhile,
  throwIfEmpty as rxThrowIfEmpty,
} from 'rxjs';
import { subscribe } from '../../src/compat/observable.ts';
import { EMPTY } from '../../src/kernel/creation/empty.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { defaultIfEmpty, throwIfEmpty } from '../../src/kernel/operators/presence.ts';
import { elementAt } from '../../src/kernel/operators/element-at.ts';
import { first } from '../../src/kernel/operators/first.ts';
import { last } from '../../src/kernel/operators/last.ts';
import { single } from '../../src/kernel/operators/single.ts';
import { skip } from '../../src/kernel/operators/skip.ts';
import { skipLast } from '../../src/kernel/operators/skip-last.ts';
import { skipUntil } from '../../src/kernel/operators/skip-until.ts';
import { skipWhile } from '../../src/kernel/operators/skip-while.ts';
import { take } from '../../src/kernel/operators/take.ts';
import { takeLast } from '../../src/kernel/operators/take-last.ts';
import { takeUntil } from '../../src/kernel/operators/take-until.ts';
import { takeWhile } from '../../src/kernel/operators/take-while.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';

const adapters = {
  rxjs: {
    create: (initializer) => new RxObservable(initializer),
    of: rxOf,
    empty: RX_EMPTY,
    subscribe: (observer) => (source) => source.subscribe(observer),
    compose: (source, ...operators) => operators.reduce((current, operator) => operator(current), source),
    take: rxTake,
    takeLast: rxTakeLast,
    takeWhile: rxTakeWhile,
    takeUntil: rxTakeUntil,
    skip: rxSkip,
    skipLast: rxSkipLast,
    skipWhile: rxSkipWhile,
    skipUntil: rxSkipUntil,
    first: rxFirst,
    last: rxLast,
    single: rxSingle,
    elementAt: rxElementAt,
    defaultIfEmpty: rxDefaultIfEmpty,
    throwIfEmpty: rxThrowIfEmpty,
  },
  pureFp: {
    create: createObservable,
    of,
    empty: EMPTY,
    subscribe,
    compose: pipeValue,
    take,
    takeLast,
    takeWhile,
    takeUntil,
    skip,
    skipLast,
    skipWhile,
    skipUntil,
    first,
    last,
    single,
    elementAt,
    defaultIfEmpty,
    throwIfEmpty,
  },
};

const collect = (adapter, source) => {
  const events = [];
  const subscription = adapter.subscribe({
    next: (value) => events.push({ type: 'next', value }),
    error: (error) => events.push({ type: 'error', name: error.name, message: error.message }),
    complete: () => events.push({ type: 'complete' }),
  })(source);
  return { events, subscription };
};

const takeTrace = ({ create, take, compose, subscribe }) => {
  const events = [];
  const source = create((subscriber) => {
    events.push('run');
    subscriber.next(1);
    subscriber.next(2);
    subscriber.next(3);
    events.push('after-3');
    return () => events.push('teardown');
  });

  const subscription = subscribe({
    next: (value) => events.push(`next:${value}`),
    complete: () => events.push('complete'),
  })(compose(source, take(2)));

  return { events, closed: subscription.closed };
};

const takeZeroTrace = ({ create, take, compose, subscribe }) => {
  let executions = 0;
  const source = create(() => {
    executions += 1;
  });
  const zero = collect({ subscribe }, compose(source, take(0))).events;
  const negative = collect({ subscribe }, compose(source, take(-1))).events;
  return { executions, zero, negative };
};

const takeLastTrace = ({ create, of, takeLast, compose, subscribe }) => {
  let executions = 0;
  const lazySource = create(() => {
    executions += 1;
  });
  return {
    basic: collect({ subscribe }, compose(of(1, 2, 3, 4, 5), takeLast(2))).events,
    underCount: collect({ subscribe }, compose(of(1), takeLast(3))).events,
    empty: collect({ subscribe }, compose(of(), takeLast(2))).events,
    zero: collect({ subscribe }, compose(lazySource, takeLast(0))).events,
    executions,
  };
};

const skipTrace = ({ of, skip, compose, subscribe }) => ({
  two: collect({ subscribe }, compose(of(1, 2, 3, 4), skip(2))).events,
  zero: collect({ subscribe }, compose(of(1, 2), skip(0))).events,
  over: collect({ subscribe }, compose(of(1, 2), skip(5))).events,
});

const skipLastTrace = ({ of, skipLast, compose, subscribe }) => {
  const source = of(1, 2);
  return {
    basic: collect({ subscribe }, compose(of(1, 2, 3, 4, 5), skipLast(2))).events,
    over: collect({ subscribe }, compose(of(1, 2), skipLast(5))).events,
    zeroIsIdentity: compose(source, skipLast(0)) === source,
  };
};

const takeWhileTrace = ({ of, takeWhile, compose, subscribe }) => {
  const indexes = [];
  return {
    exclusive: collect({ subscribe }, compose(of(1, 2, 3, 4), takeWhile((value) => value < 3))).events,
    inclusive: collect({ subscribe }, compose(of(1, 2, 3, 4), takeWhile((value) => value < 3, true))).events,
    firstFails: collect({ subscribe }, compose(of(1, 2), takeWhile(() => false))).events,
    indexed: collect({ subscribe }, compose(of('a', 'b', 'c'), takeWhile((_value, index) => {
      indexes.push(index);
      return index < 2;
    }))).events,
    indexes,
  };
};

const takeWhileErrorTrace = ({ of, takeWhile, compose, subscribe }) =>
  collect({ subscribe }, compose(of(1, 2, 3), takeWhile((value) => {
    if (value === 2) throw new Error('takeWhile-boom');
    return true;
  }))).events;

const skipWhileTrace = ({ of, skipWhile, compose, subscribe }) => {
  const indexes = [];
  return {
    basic: collect({ subscribe }, compose(of(1, 2, 3, 1), skipWhile((value) => value < 3))).events,
    never: collect({ subscribe }, compose(of(1, 2), skipWhile(() => true))).events,
    indexed: collect({ subscribe }, compose(of(5, 6, 7), skipWhile((_value, index) => {
      indexes.push(index);
      return index < 1;
    }))).events,
    indexes,
  };
};

const skipWhileErrorTrace = ({ of, skipWhile, compose, subscribe }) =>
  collect({ subscribe }, compose(of(1, 2), skipWhile((value) => {
    if (value === 2) throw new Error('skipWhile-boom');
    return true;
  }))).events;

const takeUntilFireTrace = ({ create, takeUntil, compose, subscribe }) => {
  const events = [];
  let sourceSubscriber;
  let notifierSubscriber;
  const source = create((subscriber) => {
    sourceSubscriber = subscriber;
    return () => events.push('source-teardown');
  });
  const notifier = create((subscriber) => {
    notifierSubscriber = subscriber;
    return () => events.push('notifier-teardown');
  });

  const subscription = subscribe({
    next: (value) => events.push(`next:${value}`),
    complete: () => events.push('complete'),
  })(compose(source, takeUntil(notifier)));

  sourceSubscriber.next(1);
  notifierSubscriber.next('stop');
  sourceSubscriber.next(2);

  return { events, closed: subscription.closed };
};

const takeUntilSyncFireTrace = ({ create, of, takeUntil, compose, subscribe }) => {
  let executions = 0;
  const source = create(() => {
    executions += 1;
  });
  const events = collect({ subscribe }, compose(source, takeUntil(of('x')))).events;
  return { executions, events };
};

const takeUntilQuietTrace = ({ create, takeUntil, compose, subscribe }) => {
  const events = [];
  let sourceSubscriber;
  const notifier = create((subscriber) => {
    subscriber.complete();
    return () => events.push('notifier-teardown');
  });
  const source = create((subscriber) => {
    sourceSubscriber = subscriber;
    return () => events.push('source-teardown');
  });

  subscribe({
    next: (value) => events.push(`next:${value}`),
    complete: () => events.push('complete'),
  })(compose(source, takeUntil(notifier)));

  sourceSubscriber.next(1);
  sourceSubscriber.complete();

  return events;
};

const takeUntilErrorTrace = ({ create, takeUntil, compose, subscribe }) => {
  const events = [];
  let sourceSubscriber;
  let notifierSubscriber;
  const source = create((subscriber) => {
    sourceSubscriber = subscriber;
    return () => events.push('source-teardown');
  });
  const notifier = create((subscriber) => {
    notifierSubscriber = subscriber;
  });

  subscribe({
    next: (value) => events.push(`next:${value}`),
    error: (error) => events.push(`error:${error.message}`),
  })(compose(source, takeUntil(notifier)));

  sourceSubscriber.next(1);
  notifierSubscriber.error(new Error('notifier-boom'));

  return events;
};

const skipUntilTrace = ({ create, skipUntil, compose, subscribe }) => {
  const events = [];
  let sourceSubscriber;
  let notifierSubscriber;
  const source = create((subscriber) => {
    sourceSubscriber = subscriber;
    return () => events.push('source-teardown');
  });
  const notifier = create((subscriber) => {
    notifierSubscriber = subscriber;
    return () => events.push('notifier-teardown');
  });

  const subscription = subscribe({
    next: (value) => events.push(`next:${value}`),
    complete: () => events.push('complete'),
  })(compose(source, skipUntil(notifier)));

  sourceSubscriber.next(1);
  notifierSubscriber.next('go');
  sourceSubscriber.next(2);
  sourceSubscriber.next(3);
  sourceSubscriber.complete();

  return { events, closed: subscription.closed };
};

const skipUntilQuietTrace = ({ create, skipUntil, compose, subscribe }) => {
  const events = [];
  let sourceSubscriber;
  const notifier = create((subscriber) => {
    subscriber.complete();
  });
  const source = create((subscriber) => {
    sourceSubscriber = subscriber;
  });

  subscribe({
    next: (value) => events.push(`next:${value}`),
    complete: () => events.push('complete'),
  })(compose(source, skipUntil(notifier)));

  sourceSubscriber.next(1);
  sourceSubscriber.next(2);
  sourceSubscriber.complete();

  return events;
};

const firstTrace = ({ of, first, compose, subscribe }) => {
  const src = of(1, 2, 3);
  let sourceMatches = null;
  const predicated = collect({ subscribe }, compose(src, first((value, _index, source) => {
    sourceMatches = source === src;
    return value > 1;
  }))).events;

  return {
    basic: collect({ subscribe }, compose(of(1, 2, 3), first())).events,
    predicated,
    sourceMatches,
    defaulted: collect({ subscribe }, compose(of(), first(null, 'fallback'))).events,
    empty: collect({ subscribe }, compose(of(), first())).events,
    noMatch: collect({ subscribe }, compose(of(1), first((value) => value > 5))).events,
  };
};

const lastTrace = ({ of, last, compose, subscribe }) => ({
  basic: collect({ subscribe }, compose(of(1, 2, 3), last())).events,
  predicated: collect({ subscribe }, compose(of(1, 2, 3), last((value) => value < 3))).events,
  defaulted: collect({ subscribe }, compose(of(), last(null, 'fallback'))).events,
  empty: collect({ subscribe }, compose(of(), last())).events,
  noMatch: collect({ subscribe }, compose(of(1), last((value) => value > 5))).events,
});

const singleTrace = ({ of, single, compose, subscribe }) => ({
  one: collect({ subscribe }, compose(of(7), single())).events,
  tooMany: collect({ subscribe }, compose(of(1, 2), single())).events,
  empty: collect({ subscribe }, compose(of(), single())).events,
  noMatch: collect({ subscribe }, compose(of(1, 2), single((value) => value > 5))).events,
  match: collect({ subscribe }, compose(of(1, 2, 3), single((value) => value === 2))).events,
});

const elementAtTrace = ({ of, elementAt, compose, subscribe }) => {
  let negative;
  try {
    elementAt(-1);
    negative = 'no-throw';
  } catch (error) {
    negative = { name: error.name, message: error.message };
  }
  return {
    found: collect({ subscribe }, compose(of(1, 2, 3), elementAt(1))).events,
    outOfRange: collect({ subscribe }, compose(of(1, 2), elementAt(5))).events,
    defaulted: collect({ subscribe }, compose(of(1, 2), elementAt(5, 'fallback'))).events,
    negative,
  };
};

const defaultThrowIfEmptyTrace = ({ of, defaultIfEmpty, throwIfEmpty, compose, subscribe }) => ({
  defaultEmpty: collect({ subscribe }, compose(of(), defaultIfEmpty('fallback'))).events,
  defaultNonEmpty: collect({ subscribe }, compose(of(1), defaultIfEmpty('fallback'))).events,
  throwEmpty: collect({ subscribe }, compose(of(), throwIfEmpty())).events,
  throwCustom: collect({ subscribe }, compose(of(), throwIfEmpty(() => new Error('custom-empty')))).events,
  throwNonEmpty: collect({ subscribe }, compose(of(1), throwIfEmpty())).events,
});

const emptyConstTrace = ({ empty, subscribe }) => {
  const firstRun = collect({ subscribe }, empty);
  const secondRun = collect({ subscribe }, empty);
  return {
    first: firstRun.events,
    second: secondRun.events,
    closed: firstRun.subscription.closed,
  };
};

for (const [name, trace] of Object.entries({
  takeTrace,
  takeZeroTrace,
  takeLastTrace,
  skipTrace,
  skipLastTrace,
  takeWhileTrace,
  takeWhileErrorTrace,
  skipWhileTrace,
  skipWhileErrorTrace,
  takeUntilFireTrace,
  takeUntilSyncFireTrace,
  takeUntilQuietTrace,
  takeUntilErrorTrace,
  skipUntilTrace,
  skipUntilQuietTrace,
  firstTrace,
  lastTrace,
  singleTrace,
  elementAtTrace,
  defaultThrowIfEmptyTrace,
  emptyConstTrace,
})) {
  test(`M06 ${name} matches RxJS 7.8.2`, () => {
    assert.deepEqual(trace(adapters.pureFp), trace(adapters.rxjs));
  });
}
