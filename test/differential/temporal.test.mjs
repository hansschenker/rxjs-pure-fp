import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Observable as RxObservable,
  Subject as RxSubject,
  audit as rxAudit,
  auditTime as rxAuditTime,
  debounce as rxDebounce,
  debounceTime as rxDebounceTime,
  delay as rxDelay,
  delayWhen as rxDelayWhen,
  interval as rxInterval,
  of as rxOf,
  repeat as rxRepeat,
  retry as rxRetry,
  sample as rxSample,
  sampleTime as rxSampleTime,
  take as rxTake,
  throttle as rxThrottle,
  throttleTime as rxThrottleTime,
  timeout as rxTimeout,
  timeoutWith as rxTimeoutWith,
  timer as rxTimer,
} from 'rxjs';
import { subscribe } from '../../src/compat/observable.ts';
import { timeoutWith } from '../../src/compat/temporal.ts';
import { interval } from '../../src/kernel/creation/interval.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { timer } from '../../src/kernel/creation/timer.ts';
import { createObservable } from '../../src/kernel/observable.ts';
import { audit } from '../../src/kernel/operators/audit.ts';
import { auditTime } from '../../src/kernel/operators/audit-time.ts';
import { debounce } from '../../src/kernel/operators/debounce.ts';
import { debounceTime } from '../../src/kernel/operators/debounce-time.ts';
import { delay } from '../../src/kernel/operators/delay.ts';
import { delayWhen } from '../../src/kernel/operators/delay-when.ts';
import { repeat } from '../../src/kernel/operators/repeat.ts';
import { retry } from '../../src/kernel/operators/retry.ts';
import { sample } from '../../src/kernel/operators/sample.ts';
import { sampleTime } from '../../src/kernel/operators/sample-time.ts';
import { take } from '../../src/kernel/operators/take.ts';
import { throttle } from '../../src/kernel/operators/throttle.ts';
import { throttleTime } from '../../src/kernel/operators/throttle-time.ts';
import { timeout } from '../../src/kernel/operators/timeout.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { createSubject } from '../../src/kernel/subject.ts';

// Both Subjects expose next/error/complete and act directly as sources and
// notifiers; both `apply` forms produce the piped observable for their side.
const adapters = {
  rxjs: {
    subject: () => new RxSubject(),
    apply: (source, ...operators) => source.pipe(...operators),
    create: (initializer) => new RxObservable(initializer),
    run: (source, observer) => source.subscribe(observer),
    of: rxOf,
    timer: rxTimer,
    interval: rxInterval,
    take: rxTake,
    delay: rxDelay,
    delayWhen: rxDelayWhen,
    debounce: rxDebounce,
    debounceTime: rxDebounceTime,
    audit: rxAudit,
    auditTime: rxAuditTime,
    throttle: rxThrottle,
    throttleTime: rxThrottleTime,
    sample: rxSample,
    sampleTime: rxSampleTime,
    timeout: rxTimeout,
    timeoutWith: rxTimeoutWith,
    retry: rxRetry,
    repeat: rxRepeat,
  },
  pureFp: {
    subject: createSubject,
    apply: (source, ...operators) => pipeValue(source, ...operators),
    create: createObservable,
    run: (source, observer) => subscribe(observer)(source),
    of,
    timer,
    interval,
    take,
    delay,
    delayWhen,
    debounce,
    debounceTime,
    audit,
    auditTime,
    throttle,
    throttleTime,
    sample,
    sampleTime,
    timeout,
    timeoutWith,
    retry,
    repeat,
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Subscribes and resolves the trace once the observable settles. */
const traceUntilSettled = (adapter, source, script) =>
  new Promise((resolve) => {
    const trace = [];
    adapter.run(source, {
      next: (value) => trace.push(`next:${value}`),
      error: (error) => {
        trace.push(
          `error:${error instanceof Error ? `${error.name}:${error.message}` : error}`
        );
        resolve(trace);
      },
      complete: () => {
        trace.push('complete');
        resolve(trace);
      },
    });
    script?.();
  });

/** Subscribes, runs the synchronous script, and returns the trace directly. */
const traceScripted = (adapter, source, script) => {
  const trace = [];
  adapter.run(source, {
    next: (value) => trace.push(`next:${value}`),
    error: (error) =>
      trace.push(`error:${error instanceof Error ? `${error.name}:${error.message}` : error}`),
    complete: () => trace.push('complete'),
  });
  script();
  return trace;
};

const scenarios = {
  timerSingleShot: (adapter) => traceUntilSettled(adapter, adapter.timer(20)),

  timerPastDate: (adapter) =>
    traceUntilSettled(adapter, adapter.timer(new Date(Date.now() - 500))),

  timerPeriodic: (adapter) =>
    traceUntilSettled(adapter, adapter.apply(adapter.timer(20, 15), adapter.take(3))),

  intervalTake: (adapter) =>
    traceUntilSettled(adapter, adapter.apply(adapter.interval(15), adapter.take(3))),

  delayShift: (adapter) =>
    traceUntilSettled(adapter, adapter.apply(adapter.of(1, 2, 3), adapter.delay(25))),

  delayErrorImmediate: (adapter) => {
    const source = adapter.subject();
    const result = traceUntilSettled(adapter, adapter.apply(source, adapter.delay(60)));
    source.next(1);
    source.error(new Error('boom'));
    return result;
  },

  delayWhenReorder: (adapter) => {
    const durations = new Map();
    const source = adapter.subject();
    return traceScripted(
      adapter,
      adapter.apply(
        source,
        adapter.delayWhen((value) => {
          const duration = adapter.subject();
          durations.set(value, duration);
          return duration;
        })
      ),
      () => {
        source.next('a');
        source.next('b');
        source.complete();
        durations.get('b').next(0);
        durations.get('a').next(0);
      }
    );
  },

  delayWhenEmptyDurationDrops: (adapter) => {
    const durations = [];
    const source = adapter.subject();
    return traceScripted(
      adapter,
      adapter.apply(
        source,
        adapter.delayWhen(() => {
          const duration = adapter.subject();
          durations.push(duration);
          return duration;
        })
      ),
      () => {
        source.next('a');
        durations[0].complete();
        source.next('b');
        durations[1].next(0);
        source.complete();
      }
    );
  },

  debounceNotifier: (adapter) => {
    const durations = [];
    const source = adapter.subject();
    return traceScripted(
      adapter,
      adapter.apply(
        source,
        adapter.debounce(() => {
          const duration = adapter.subject();
          durations.push(duration);
          return duration;
        })
      ),
      () => {
        source.next(1);
        source.next(2);
        durations[0].next(0);
        durations[1].next(0);
        source.next(3);
        source.complete();
      }
    );
  },

  auditNotifier: (adapter) => {
    const windows = [];
    const source = adapter.subject();
    return traceScripted(
      adapter,
      adapter.apply(
        source,
        adapter.audit(() => {
          const window = adapter.subject();
          windows.push(window);
          return window;
        })
      ),
      () => {
        source.next(1);
        source.next(2);
        windows[0].next(0);
        source.next(3);
        source.complete();
        windows[1].next(0);
      }
    );
  },

  auditSyncDuration: (adapter) => {
    const source = adapter.subject();
    return traceScripted(
      adapter,
      adapter.apply(source, adapter.audit(() => adapter.of(0))),
      () => {
        source.next(1);
        source.next(2);
        source.complete();
      }
    );
  },

  throttleLeading: (adapter) => {
    const windows = [];
    const source = adapter.subject();
    return traceScripted(
      adapter,
      adapter.apply(
        source,
        adapter.throttle(() => {
          const window = adapter.subject();
          windows.push(window);
          return window;
        })
      ),
      () => {
        source.next(1);
        source.next(2);
        source.next(3);
        windows[0].next(0);
        source.next(4);
        source.complete();
      }
    );
  },

  throttleTrailing: (adapter) => {
    const windows = [];
    const source = adapter.subject();
    return traceScripted(
      adapter,
      adapter.apply(
        source,
        adapter.throttle(
          () => {
            const window = adapter.subject();
            windows.push(window);
            return window;
          },
          { leading: false, trailing: true }
        )
      ),
      () => {
        source.next(1);
        source.next(2);
        windows[0].next(0);
        source.next(3);
        source.complete();
        windows[1].next(0);
      }
    );
  },

  throttleLeadingTrailingSyncDuration: (adapter) => {
    const source = adapter.subject();
    return traceScripted(
      adapter,
      adapter.apply(
        source,
        adapter.throttle(() => adapter.of(0), { leading: true, trailing: true })
      ),
      () => {
        source.next(1);
        source.next(2);
        source.next(3);
        source.complete();
      }
    );
  },

  sampleNotifier: (adapter) => {
    const source = adapter.subject();
    const notifier = adapter.subject();
    return traceScripted(adapter, adapter.apply(source, adapter.sample(notifier)), () => {
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
    });
  },

  sampleTimePeriodic: async (adapter) => {
    const source = adapter.subject();
    const result = traceUntilSettled(adapter, adapter.apply(source, adapter.sampleTime(40)));
    source.next(1);
    source.next(2);
    await sleep(60);
    await sleep(60);
    source.next(3);
    await sleep(60);
    source.complete();
    return result;
  },

  timeoutFirstDeadline: (adapter) => {
    const silent = adapter.subject();
    return traceUntilSettled(adapter, adapter.apply(silent, adapter.timeout({ first: 30 })));
  },

  timeoutEachAfterValue: (adapter) => {
    const source = adapter.subject();
    const result = traceUntilSettled(adapter, adapter.apply(source, adapter.timeout({ each: 40 })));
    source.next('a');
    return result;
  },

  timeoutWithFallback: (adapter) => {
    const silent = adapter.subject();
    return traceUntilSettled(
      adapter,
      adapter.apply(
        silent,
        adapter.timeout({ each: 30, with: (info) => adapter.of(`fallback:${info.seen}`) })
      )
    );
  },

  timeoutSurvivesFastValues: async (adapter) => {
    const source = adapter.subject();
    const result = traceUntilSettled(adapter, adapter.apply(source, adapter.timeout({ each: 60 })));
    source.next('a');
    await sleep(15);
    source.next('b');
    await sleep(15);
    source.complete();
    return result;
  },

  timeoutWithCompat: (adapter) => {
    const silent = adapter.subject();
    return traceUntilSettled(
      adapter,
      adapter.apply(silent, adapter.timeoutWith(30, adapter.of('alt')))
    );
  },

  retryNumericDelay: (adapter) => {
    let attempts = 0;
    const flaky = adapter.create((subscriber) => {
      attempts += 1;
      if (attempts < 3) {
        subscriber.error(new Error(`fail ${attempts}`));
      } else {
        subscriber.next('ok');
        subscriber.complete();
      }
    });
    return traceUntilSettled(adapter, adapter.apply(flaky, adapter.retry({ count: 2, delay: 15 })));
  },

  repeatNumericDelay: (adapter) =>
    traceUntilSettled(adapter, adapter.apply(adapter.of('x'), adapter.repeat({ count: 3, delay: 15 }))),
};

for (const [name, scenario] of Object.entries(scenarios)) {
  test(`M14 ${name} matches RxJS 7.8.2`, async () => {
    assert.deepEqual(await scenario(adapters.pureFp), await scenario(adapters.rxjs));
  });
}
