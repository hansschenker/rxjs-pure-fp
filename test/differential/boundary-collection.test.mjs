import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Observable as RxObservable,
  Subject as RxSubject,
  buffer as rxBuffer,
  bufferCount as rxBufferCount,
  bufferTime as rxBufferTime,
  bufferToggle as rxBufferToggle,
  bufferWhen as rxBufferWhen,
  count as rxCount,
  every as rxEvery,
  find as rxFind,
  findIndex as rxFindIndex,
  groupBy as rxGroupBy,
  max as rxMax,
  min as rxMin,
  of as rxOf,
  partition as rxPartition,
  window as rxWindow,
  windowCount as rxWindowCount,
  windowTime as rxWindowTime,
  windowToggle as rxWindowToggle,
  windowWhen as rxWindowWhen,
} from 'rxjs';
import {
  every,
  find,
  findIndex,
  groupBy,
  partition,
} from '../../src/compat/collection.ts';
import { subscribe } from '../../src/compat/observable.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { buffer } from '../../src/kernel/operators/buffer.ts';
import { bufferCount } from '../../src/kernel/operators/buffer-count.ts';
import { bufferTime } from '../../src/kernel/operators/buffer-time.ts';
import { bufferToggle } from '../../src/kernel/operators/buffer-toggle.ts';
import { bufferWhen } from '../../src/kernel/operators/buffer-when.ts';
import { count } from '../../src/kernel/operators/count.ts';
import { max } from '../../src/kernel/operators/max.ts';
import { min } from '../../src/kernel/operators/min.ts';
import { window } from '../../src/kernel/operators/window.ts';
import { windowCount } from '../../src/kernel/operators/window-count.ts';
import { windowTime } from '../../src/kernel/operators/window-time.ts';
import { windowToggle } from '../../src/kernel/operators/window-toggle.ts';
import { windowWhen } from '../../src/kernel/operators/window-when.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { createSubject } from '../../src/kernel/subject.ts';

const adapters = {
  rxjs: {
    subject: () => new RxSubject(),
    apply: (source, ...operators) => source.pipe(...operators),
    create: (initializer) => new RxObservable(initializer),
    run: (source, observer) => source.subscribe(observer),
    of: rxOf,
    buffer: rxBuffer,
    bufferCount: rxBufferCount,
    bufferTime: rxBufferTime,
    bufferToggle: rxBufferToggle,
    bufferWhen: rxBufferWhen,
    window: rxWindow,
    windowCount: rxWindowCount,
    windowTime: rxWindowTime,
    windowToggle: rxWindowToggle,
    windowWhen: rxWindowWhen,
    groupBy: rxGroupBy,
    partition: rxPartition,
    count: rxCount,
    max: rxMax,
    min: rxMin,
    every: rxEvery,
    find: rxFind,
    findIndex: rxFindIndex,
  },
  pureFp: {
    subject: createSubject,
    apply: (source, ...operators) => pipeValue(source, ...operators),
    create: createObservable,
    run: (source, observer) => subscribe(observer)(source),
    of,
    buffer,
    bufferCount,
    bufferTime,
    bufferToggle,
    bufferWhen,
    window,
    windowCount,
    windowTime,
    windowToggle,
    windowWhen,
    groupBy,
    partition,
    count,
    max,
    min,
    every,
    find,
    findIndex,
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatError = (error) =>
  `error:${error instanceof Error ? `${error.name}:${error.message}` : error}`;

/** Subscribes, runs the synchronous script, and returns the trace directly. */
const traceScripted = (adapter, source, script) => {
  const trace = [];
  adapter.run(source, {
    next: (value) => trace.push(`next:${JSON.stringify(value)}`),
    error: (error) => trace.push(formatError(error)),
    complete: () => trace.push('complete'),
  });
  script?.();
  return trace;
};

/** Subscribes and resolves the trace once the observable settles; the script may await. */
const traceUntilSettled = (adapter, source, script) =>
  new Promise((resolve) => {
    const trace = [];
    adapter.run(source, {
      next: (value) => trace.push(`next:${JSON.stringify(value)}`),
      error: (error) => {
        trace.push(formatError(error));
        resolve(trace);
      },
      complete: () => {
        trace.push('complete');
        resolve(trace);
      },
    });
    script?.();
  });

/** Higher-order trace: inner observables are subscribed as they open. */
const windowObserver = (adapter, trace) => {
  let index = 0;
  return {
    next: (inner) => {
      const id = index++;
      trace.push(`open:${id}`);
      adapter.run(inner, {
        next: (value) => trace.push(`w${id}:${JSON.stringify(value)}`),
        error: (error) => trace.push(`w${id}:${formatError(error)}`),
        complete: () => trace.push(`w${id}:complete`),
      });
    },
    error: (error) => trace.push(formatError(error)),
    complete: () => trace.push('complete'),
  };
};

const traceWindowsScripted = (adapter, source, script) => {
  const trace = [];
  adapter.run(source, windowObserver(adapter, trace));
  script?.();
  return trace;
};

const traceWindowsUntilSettled = (adapter, source, script) =>
  new Promise((resolve) => {
    const trace = [];
    const observer = windowObserver(adapter, trace);
    adapter.run(source, {
      next: observer.next,
      error: (error) => {
        observer.error(error);
        resolve(trace);
      },
      complete: () => {
        observer.complete();
        resolve(trace);
      },
    });
    script?.();
  });

const scenarios = {
  countAll: (adapter) =>
    traceScripted(adapter, adapter.apply(adapter.of(1, 2, 3, 4), adapter.count())),

  countPredicate: (adapter) =>
    traceScripted(
      adapter,
      adapter.apply(adapter.of(1, 2, 3, 4, 5), adapter.count((value, index) => value + index > 4))
    ),

  countEmpty: (adapter) => traceScripted(adapter, adapter.apply(adapter.of(), adapter.count())),

  maxNative: (adapter) =>
    traceScripted(adapter, adapter.apply(adapter.of(3, 1, 4, 1, 5), adapter.max())),

  maxComparer: (adapter) =>
    traceScripted(
      adapter,
      adapter.apply(adapter.of('aa', 'a', 'aaa'), adapter.max((x, y) => x.length - y.length))
    ),

  minNative: (adapter) =>
    traceScripted(adapter, adapter.apply(adapter.of(3, 1, 4, 1, 5), adapter.min())),

  minComparer: (adapter) =>
    traceScripted(
      adapter,
      adapter.apply(adapter.of('aa', 'a', 'aaa'), adapter.min((x, y) => x.length - y.length))
    ),

  minEmpty: (adapter) => traceScripted(adapter, adapter.apply(adapter.of(), adapter.min())),

  everyTrue: (adapter) =>
    traceScripted(adapter, adapter.apply(adapter.of(1, 2), adapter.every((value) => value < 3))),

  everyEmpty: (adapter) =>
    traceScripted(adapter, adapter.apply(adapter.of(), adapter.every(() => false))),

  everyShortCircuits: (adapter) => {
    const source = adapter.subject();
    return traceScripted(
      adapter,
      adapter.apply(source, adapter.every((value) => value < 3)),
      () => {
        source.next(1);
        source.next(3);
        source.next(5);
        source.complete();
      }
    );
  },

  everyPredicateThrows: (adapter) =>
    traceScripted(
      adapter,
      adapter.apply(
        adapter.of(1),
        adapter.every(() => {
          throw new Error('bad predicate');
        })
      )
    ),

  findValue: (adapter) => {
    const source = adapter.subject();
    return traceScripted(
      adapter,
      adapter.apply(source, adapter.find((value) => value > 1)),
      () => {
        source.next(1);
        source.next(2);
        source.next(3);
        source.complete();
      }
    );
  },

  findMissEmitsUndefined: (adapter) =>
    traceScripted(adapter, adapter.apply(adapter.of(1, 2), adapter.find((value) => value > 9))),

  findThisArg: (adapter) =>
    traceScripted(
      adapter,
      adapter.apply(
        adapter.of(1, 4, 6),
        adapter.find(function (value) {
          return value >= this.limit;
        }, { limit: 5 })
      )
    ),

  findIndexHit: (adapter) =>
    traceScripted(
      adapter,
      adapter.apply(adapter.of('a', 'b', 'c'), adapter.findIndex((value) => value === 'b'))
    ),

  findIndexMiss: (adapter) =>
    traceScripted(
      adapter,
      adapter.apply(adapter.of('a'), adapter.findIndex((value) => value === 'z'))
    ),

  partitionSplit: (adapter) => {
    const [pass, fail] = adapter.partition(adapter.of(1, 2, 3, 4, 5), (value) => value % 2 === 0);
    const trace = [];
    adapter.run(pass, {
      next: (value) => trace.push(`pass:${value}`),
      complete: () => trace.push('pass:complete'),
    });
    adapter.run(fail, {
      next: (value) => trace.push(`fail:${value}`),
      complete: () => trace.push('fail:complete'),
    });
    return trace;
  },

  bufferNotifier: (adapter) => {
    const source = adapter.subject();
    const notifier = adapter.subject();
    return traceScripted(adapter, adapter.apply(source, adapter.buffer(notifier)), () => {
      source.next(1);
      source.next(2);
      notifier.next('go');
      source.next(3);
      notifier.next('go');
      notifier.next('go');
      source.next(4);
      source.complete();
    });
  },

  bufferNotifierCompleteSwallowed: (adapter) => {
    const source = adapter.subject();
    const notifier = adapter.subject();
    return traceScripted(adapter, adapter.apply(source, adapter.buffer(notifier)), () => {
      notifier.complete();
      source.next(1);
      source.complete();
    });
  },

  bufferSourceErrorDropsBuffer: (adapter) => {
    const source = adapter.subject();
    const notifier = adapter.subject();
    return traceScripted(adapter, adapter.apply(source, adapter.buffer(notifier)), () => {
      source.next(1);
      source.error(new Error('boom'));
    });
  },

  bufferCountExact: (adapter) =>
    traceScripted(adapter, adapter.apply(adapter.of(1, 2, 3, 4, 5), adapter.bufferCount(2))),

  bufferCountOverlap: (adapter) =>
    traceScripted(adapter, adapter.apply(adapter.of(1, 2, 3, 4, 5), adapter.bufferCount(3, 1))),

  bufferCountSkip: (adapter) =>
    traceScripted(
      adapter,
      adapter.apply(adapter.of(1, 2, 3, 4, 5, 6, 7), adapter.bufferCount(2, 3))
    ),

  bufferToggleOverlap: (adapter) => {
    const source = adapter.subject();
    const openings = adapter.subject();
    const closings = { a: adapter.subject(), b: adapter.subject() };
    return traceScripted(
      adapter,
      adapter.apply(source, adapter.bufferToggle(openings, (key) => closings[key])),
      () => {
        openings.next('a');
        source.next(1);
        openings.next('b');
        source.next(2);
        closings.a.next('done');
        source.next(3);
        closings.b.next('done');
        source.next(4);
        source.complete();
      }
    );
  },

  bufferWhenCycles: (adapter) => {
    const source = adapter.subject();
    const closings = [];
    return traceScripted(
      adapter,
      adapter.apply(
        source,
        adapter.bufferWhen(() => {
          const closing = adapter.subject();
          closings.push(closing);
          return closing;
        })
      ),
      () => {
        source.next(1);
        source.next(2);
        closings[0].next('close');
        source.next(3);
        source.complete();
      }
    );
  },

  bufferTimeMaxSizeSync: (adapter) => {
    const source = adapter.subject();
    return traceScripted(
      adapter,
      adapter.apply(source, adapter.bufferTime(5000, null, 2)),
      () => {
        source.next(1);
        source.next(2);
        source.next(3);
        source.next(4);
        source.next(5);
        source.complete();
      }
    );
  },

  bufferTimeSpan: async (adapter) => {
    const source = adapter.subject();
    const settled = traceUntilSettled(adapter, adapter.apply(source, adapter.bufferTime(60)));
    source.next(1);
    source.next(2);
    await sleep(90);
    source.next(3);
    await sleep(45);
    source.complete();
    return settled;
  },

  bufferTimeCreationInterval: async (adapter) => {
    const source = adapter.subject();
    const settled = traceUntilSettled(
      adapter,
      adapter.apply(source, adapter.bufferTime(100, 250))
    );
    source.next(1);
    await sleep(150);
    source.next(2);
    await sleep(150);
    source.next(3);
    await sleep(130);
    source.complete();
    return settled;
  },

  windowBoundaries: (adapter) => {
    const source = adapter.subject();
    const boundaries = adapter.subject();
    return traceWindowsScripted(adapter, adapter.apply(source, adapter.window(boundaries)), () => {
      source.next(1);
      boundaries.next('cut');
      source.next(2);
      source.next(3);
      source.complete();
    });
  },

  windowSourceErrorFansOut: (adapter) => {
    const source = adapter.subject();
    const boundaries = adapter.subject();
    return traceWindowsScripted(adapter, adapter.apply(source, adapter.window(boundaries)), () => {
      source.next(1);
      source.error(new Error('boom'));
    });
  },

  windowCountNonOverlap: (adapter) =>
    traceWindowsScripted(adapter, adapter.apply(adapter.of(1, 2, 3, 4, 5), adapter.windowCount(2))),

  windowCountOverlap: (adapter) =>
    traceWindowsScripted(
      adapter,
      adapter.apply(adapter.of(1, 2, 3, 4), adapter.windowCount(3, 1))
    ),

  windowToggleScripted: (adapter) => {
    const source = adapter.subject();
    const openings = adapter.subject();
    const closings = { a: adapter.subject(), b: adapter.subject() };
    return traceWindowsScripted(
      adapter,
      adapter.apply(source, adapter.windowToggle(openings, (key) => closings[key])),
      () => {
        openings.next('a');
        source.next(1);
        openings.next('b');
        source.next(2);
        closings.a.next('done');
        source.next(3);
        source.complete();
      }
    );
  },

  windowWhenScripted: (adapter) => {
    const source = adapter.subject();
    const closings = [];
    return traceWindowsScripted(
      adapter,
      adapter.apply(
        source,
        adapter.windowWhen(() => {
          const closing = adapter.subject();
          closings.push(closing);
          return closing;
        })
      ),
      () => {
        source.next(1);
        closings[0].next('cut');
        source.next(2);
        closings[1].complete();
        source.next(3);
        source.complete();
      }
    );
  },

  windowTimeMaxSizeSync: (adapter) => {
    const source = adapter.subject();
    return traceWindowsScripted(
      adapter,
      adapter.apply(source, adapter.windowTime(5000, null, 2)),
      () => {
        source.next(1);
        source.next(2);
        source.next(3);
        source.complete();
      }
    );
  },

  windowTimeSpan: async (adapter) => {
    const source = adapter.subject();
    const settled = traceWindowsUntilSettled(
      adapter,
      adapter.apply(source, adapter.windowTime(60))
    );
    source.next(1);
    source.next(2);
    await sleep(90);
    source.next(3);
    await sleep(45);
    source.complete();
    return settled;
  },

  groupByOddEven: (adapter) => {
    const trace = [];
    adapter.run(
      adapter.apply(
        adapter.of(1, 2, 3, 4, 5),
        adapter.groupBy((value) => (value % 2 === 0 ? 'even' : 'odd'))
      ),
      {
        next: (group) => {
          trace.push(`open:${group.key}`);
          adapter.run(group, {
            next: (value) => trace.push(`${group.key}:${value}`),
            complete: () => trace.push(`${group.key}:complete`),
          });
        },
        complete: () => trace.push('complete'),
      }
    );
    return trace;
  },

  groupByElement: (adapter) => {
    const trace = [];
    adapter.run(
      adapter.apply(
        adapter.of('alpha', 'beta', 'avocado'),
        adapter.groupBy((word) => word[0], { element: (word) => word.length })
      ),
      {
        next: (group) => {
          adapter.run(group, { next: (value) => trace.push(`${group.key}:${value}`) });
        },
        complete: () => trace.push('complete'),
      }
    );
    return trace;
  },

  groupByDurationReopens: (adapter) => {
    const source = adapter.subject();
    const durations = new Map();
    const trace = [];
    let opening = 0;
    adapter.run(
      adapter.apply(
        source,
        adapter.groupBy((value) => value.key, {
          duration: (group) => {
            const duration = adapter.subject();
            durations.set(group.key, duration);
            return duration;
          },
        })
      ),
      {
        next: (group) => {
          const id = opening++;
          trace.push(`open${id}:${group.key}`);
          adapter.run(group, {
            next: (value) => trace.push(`g${id}:${value.n}`),
            complete: () => trace.push(`g${id}:complete`),
          });
        },
        complete: () => trace.push('complete'),
      }
    );
    source.next({ key: 'a', n: 1 });
    durations.get('a').next('expire');
    source.next({ key: 'a', n: 2 });
    source.next({ key: 'a', n: 3 });
    source.complete();
    return trace;
  },

  groupByKeyThrowsFansOut: (adapter) => {
    const source = adapter.subject();
    const trace = [];
    adapter.run(
      adapter.apply(
        source,
        adapter.groupBy((value) => {
          if (value === 'poison') {
            throw new Error('bad key');
          }
          return value[0];
        })
      ),
      {
        next: (group) => {
          adapter.run(group, {
            next: (value) => trace.push(`${group.key}:${value}`),
            error: (error) => trace.push(`${group.key}:${formatError(error)}`),
            complete: () => trace.push(`${group.key}:complete`),
          });
        },
        error: (error) => trace.push(formatError(error)),
        complete: () => trace.push('complete'),
      }
    );
    source.next('apple');
    source.next('poison');
    return trace;
  },

  groupByRefCountedTeardown: (adapter) => {
    const trace = [];
    const hub = adapter.subject();
    const source = adapter.create((subscriber) => {
      const subscription = adapter.run(hub, subscriber);
      return () => {
        trace.push('source-teardown');
        subscription.unsubscribe();
      };
    });
    let groupSubscription = null;
    const outer = adapter.run(adapter.apply(source, adapter.groupBy(() => 'all')), {
      next: (group) => {
        groupSubscription = adapter.run(group, {
          next: (value) => trace.push(`group:${value}`),
        });
      },
    });
    hub.next(1);
    outer.unsubscribe();
    trace.push('outer-unsubscribed');
    hub.next(2);
    groupSubscription.unsubscribe();
    trace.push('group-unsubscribed');
    return trace;
  },
};

for (const [name, scenario] of Object.entries(scenarios)) {
  test(`M15 ${name} matches RxJS 7.8.2`, async () => {
    assert.deepEqual(await scenario(adapters.pureFp), await scenario(adapters.rxjs));
  });
}
