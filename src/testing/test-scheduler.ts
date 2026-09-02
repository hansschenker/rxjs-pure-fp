import { subscribe } from '../compat/observable.ts';
import { isBrandedObservable, type Observable } from '../kernel/observable.ts';
import { installTimerHostDelegate, type FrameHandle, type TimerHost, type TimerId } from '../kernel/runtime.ts';
import type { PartialObserver } from '../kernel/sink.ts';
import type { Subscription } from '../kernel/subscription.ts';
import {
  createVirtualTimeScheduler,
  virtualTimeProtocol,
  type VirtualTimeScheduler,
} from '../kernel/virtual-time.ts';
import { createColdObservable, type ColdObservable } from './cold-observable.ts';
import { createHotObservable, type HotObservable } from './hot-observable.ts';
import { parseMarbles, parseMarblesAsSubscriptions } from './marbles.ts';
import {
  completeTestNotification,
  createTestMessage,
  errorTestNotification,
  nextTestNotification,
  type SubscriptionLog,
  type TestMessage,
} from './test-message.ts';

/**
 * M21: RxJS 7.8.2's `TestScheduler` (the `rxjs/testing` subpath) as a record
 * composed over the M18 virtual-time machine — expectations are closures
 * registered for the next `flush`, cold and hot observables are branded
 * records, and run mode installs one delegate on the runtime's host edge
 * where RxJS fills six provider slots. The factory carries the statics
 * (`frameTimeFactor`, `parseMarbles`, `parseMarblesAsSubscriptions`).
 */

const defaultMaxFrame = 750;

export type MarbleValues<T> = { readonly [marble: string]: T };

export type ObservableToBeFn = (marbles: string, values?: MarbleValues<unknown>, errorValue?: unknown) => void;

export type SubscriptionLogsToBeFn = (marbles: string | string[]) => void;

export type ObservableExpectation<T> = {
  readonly toBe: ObservableToBeFn;
  readonly toEqual: (other: Observable<T>) => void;
};

export type SubscriptionsExpectation = {
  readonly toBe: SubscriptionLogsToBeFn;
};

export type AssertDeepEqual = (actual: unknown, expected: unknown) => boolean | void;

export type TestScheduler = VirtualTimeScheduler & {
  readonly assertDeepEqual: AssertDeepEqual;
  /** @deprecated Internal implementation detail, as in RxJS. */
  readonly hotObservables: HotObservable<unknown>[];
  /** @deprecated Internal implementation detail, as in RxJS. */
  readonly coldObservables: ColdObservable<unknown>[];
  readonly createTime: (marbles: string) => number;
  readonly createColdObservable: <T = string>(
    marbles: string,
    values?: MarbleValues<T>,
    error?: unknown
  ) => ColdObservable<T>;
  readonly createHotObservable: <T = string>(
    marbles: string,
    values?: MarbleValues<T>,
    error?: unknown
  ) => HotObservable<T>;
  readonly expectObservable: <T>(
    observable: Observable<T>,
    subscriptionMarbles?: string | null
  ) => ObservableExpectation<T>;
  readonly expectSubscriptions: (actualSubscriptionLogs: SubscriptionLog[]) => SubscriptionsExpectation;
  readonly flush: () => void;
  readonly run: <T>(callback: (helpers: RunHelpers) => T) => T;
};

export type RunHelpers = {
  readonly cold: TestScheduler['createColdObservable'];
  readonly hot: TestScheduler['createHotObservable'];
  readonly flush: TestScheduler['flush'];
  readonly time: TestScheduler['createTime'];
  readonly expectObservable: TestScheduler['expectObservable'];
  readonly expectSubscriptions: TestScheduler['expectSubscriptions'];
  readonly animate: (marbles: string) => void;
};

export type TestSchedulerFactory = {
  (assertDeepEqual: AssertDeepEqual): TestScheduler;
  /**
   * Virtual time units per marble character; `run` sets it to 1 for the
   * duration of the run block and restores it afterwards.
   */
  frameTimeFactor: number;
  readonly parseMarbles: <T>(
    marbles: string,
    values?: MarbleValues<T>,
    errorValue?: unknown,
    materializeInnerObservables?: boolean,
    runMode?: boolean
  ) => TestMessage[];
  readonly parseMarblesAsSubscriptions: (marbles: string | null, runMode?: boolean) => SubscriptionLog;
};

type FlushableTest = {
  ready: boolean;
  actual?: unknown[];
  expected?: unknown[];
};

type Animator = {
  readonly animate: (marbles: string) => void;
  readonly requestFrame: TimerHost['requestFrame'];
  readonly cancelFrame: TimerHost['cancelFrame'];
};

type ScheduledKind = 'immediate' | 'interval' | 'timeout';

type ScheduledRecord = {
  due: number;
  readonly duration: number;
  readonly handle: number;
  readonly handler: () => void;
  subscription: Subscription;
  readonly kind: ScheduledKind;
};

/**
 * The animation-frame delegate of run mode: frame callbacks queue up in a
 * map until the `animate` helper's marbles fire them, which gives the test
 * author full control over when — or if — frames are painted.
 */
const createAnimator = (scheduler: VirtualTimeScheduler, frameTimeFactor: () => number): Animator => {
  let lastHandle = 0;
  let frames: Map<number, (frameTime: number) => void> | undefined;

  const requestFrame = (handler: (frameTime: number) => void): FrameHandle => {
    if (!frames) {
      throw new Error('animate() was not called within run()');
    }
    const handle = ++lastHandle;
    frames.set(handle, handler);
    return handle;
  };

  const cancelFrame = (handle: FrameHandle): void => {
    if (!frames) {
      throw new Error('animate() was not called within run()');
    }
    frames.delete(handle as number);
  };

  const animate = (marbles: string): void => {
    if (frames) {
      throw new Error('animate() must not be called more than once within run()');
    }
    if (/[|#]/.test(marbles)) {
      throw new Error('animate() must not complete or error');
    }
    const pending = new Map<number, (frameTime: number) => void>();
    frames = pending;
    for (const message of parseMarbles(marbles, undefined, undefined, false, true, frameTimeFactor())) {
      scheduler.schedule(() => {
        const now = scheduler.now();
        // Capture and clear before enumerating: callbacks may request the
        // next frame while running.
        const callbacks = [...pending.values()];
        pending.clear();
        for (const callback of callbacks) {
          callback(now);
        }
      }, message.frame);
    }
  };

  return { animate, requestFrame, cancelFrame };
};

/**
 * The host delegate of run mode: intervals, immediates (asap's microtask
 * batch), and timeouts (the environments' deferral edge) become virtual
 * actions, with RxJS's priority at a shared frame — immediates before
 * intervals before timeouts — and both clocks read the virtual frame.
 */
const createDelegates = (scheduler: VirtualTimeScheduler, animator: Animator): TimerHost => {
  let lastHandle = 0;
  const lookup = new Map<number, ScheduledRecord>();

  const run = (): void => {
    const now = scheduler.now();
    const due = [...lookup.values()].filter((record) => record.due <= now);
    const immediate = due.find((record) => record.kind === 'immediate');
    if (immediate) {
      lookup.delete(immediate.handle);
      immediate.handler();
      return;
    }
    const interval = due.find((record) => record.kind === 'interval');
    if (interval) {
      // Behaves like setInterval: re-arm before running the handler; the
      // chain ends when the clear delegate drops the record.
      interval.due = now + interval.duration;
      interval.subscription = scheduler.schedule(run, interval.duration);
      interval.handler();
      return;
    }
    const timeout = due.find((record) => record.kind === 'timeout');
    if (timeout) {
      lookup.delete(timeout.handle);
      timeout.handler();
      return;
    }
    throw new Error('Expected a due immediate or interval');
  };

  const arm = (kind: ScheduledKind, handler: () => void, duration: number): number => {
    const handle = ++lastHandle;
    lookup.set(handle, {
      due: scheduler.now() + duration,
      duration,
      handle,
      handler,
      subscription: scheduler.schedule(run, duration),
      kind,
    });
    return handle;
  };

  const disarm = (handle: TimerId): void => {
    const record = lookup.get(handle as number);
    if (record) {
      record.subscription.unsubscribe();
      lookup.delete(record.handle);
    }
  };

  return Object.freeze({
    now: scheduler.now,
    performanceNow: scheduler.now,
    interval: (handler: () => void, delayMillis: number): TimerId => arm('interval', handler, delayMillis),
    cancelInterval: disarm,
    microtask: (task: () => void): void => {
      arm('immediate', task, 0);
    },
    timeout: (task: () => void): void => {
      arm('timeout', task, 0);
    },
    requestFrame: animator.requestFrame,
    cancelFrame: animator.cancelFrame,
  });
};

const createTestScheduler = (assertDeepEqual: AssertDeepEqual): TestScheduler => {
  let runMode = false;
  // The frame budget is a live policy: RxJS assigns `maxFrames = Infinity`
  // for the duration of `run` and restores it; here run mode is the policy.
  const virtual = createVirtualTimeScheduler({ maxFrames: () => (runMode ? Infinity : defaultMaxFrame) });
  const hotObservables: HotObservable<unknown>[] = [];
  const coldObservables: ColdObservable<unknown>[] = [];
  let flushTests: FlushableTest[] = [];
  let scheduler!: TestScheduler;

  const factor = (): number => TestScheduler.frameTimeFactor;

  const createTime = (marbles: string): number => {
    const indexOf = runMode ? marbles.trim().indexOf('|') : marbles.indexOf('|');
    if (indexOf === -1) {
      throw new Error('marble diagram for time should have a completion marker "|"');
    }
    return indexOf * factor();
  };

  const cold = <T = string>(marbles: string, values?: MarbleValues<T>, error?: unknown): ColdObservable<T> => {
    if (marbles.indexOf('^') !== -1) {
      throw new Error('cold observable cannot have subscription offset "^"');
    }
    if (marbles.indexOf('!') !== -1) {
      throw new Error('cold observable cannot have unsubscription marker "!"');
    }
    const messages = parseMarbles(marbles, values, error, false, runMode, factor()) as TestMessage<T>[];
    const observable = createColdObservable(messages, scheduler);
    coldObservables.push(observable);
    return observable;
  };

  const hot = <T = string>(marbles: string, values?: MarbleValues<T>, error?: unknown): HotObservable<T> => {
    if (marbles.indexOf('!') !== -1) {
      throw new Error('hot observable cannot have unsubscription marker "!"');
    }
    const messages = parseMarbles(marbles, values, error, false, runMode, factor()) as TestMessage<T>[];
    const subject = createHotObservable(messages, scheduler);
    // Subjects are invariant in their value type; the internal list is untyped as in RxJS.
    hotObservables.push(subject as unknown as HotObservable<unknown>);
    return subject;
  };

  const recorder = (into: TestMessage[]): PartialObserver<unknown> => ({
    next: (value) => {
      // Support Observable-of-Observables
      const recorded = isBrandedObservable(value) ? materializeInnerObservable(value, virtual.frame) : value;
      into.push(createTestMessage(virtual.frame, nextTestNotification(recorded)));
    },
    error: (error) => {
      into.push(createTestMessage(virtual.frame, errorTestNotification(error)));
    },
    complete: () => {
      into.push(createTestMessage(virtual.frame, completeTestNotification()));
    },
  });

  const materializeInnerObservable = (observable: Observable<unknown>, outerFrame: number): TestMessage[] => {
    const messages: TestMessage[] = [];
    subscribe<unknown>({
      next: (value) => {
        messages.push(createTestMessage(virtual.frame - outerFrame, nextTestNotification(value)));
      },
      error: (error) => {
        messages.push(createTestMessage(virtual.frame - outerFrame, errorTestNotification(error)));
      },
      complete: () => {
        messages.push(createTestMessage(virtual.frame - outerFrame, completeTestNotification()));
      },
    })(observable);
    return messages;
  };

  const expectObservable = <T>(
    observable: Observable<T>,
    subscriptionMarbles: string | null = null
  ): ObservableExpectation<T> => {
    const actual: TestMessage[] = [];
    const flushTest: FlushableTest = { ready: false, actual };
    const parsed = parseMarblesAsSubscriptions(subscriptionMarbles, runMode, factor());
    const subscriptionFrame = parsed.subscribedFrame === Infinity ? 0 : parsed.subscribedFrame;
    const unsubscriptionFrame = parsed.unsubscribedFrame;
    let subscription: Subscription | undefined;

    virtual.schedule(() => {
      subscription = subscribe(recorder(actual))(observable);
    }, subscriptionFrame);

    if (unsubscriptionFrame !== Infinity) {
      virtual.schedule(() => subscription?.unsubscribe(), unsubscriptionFrame);
    }

    flushTests.push(flushTest);
    const mode = runMode;

    return {
      toBe: (marbles, values, errorValue) => {
        flushTest.ready = true;
        flushTest.expected = parseMarbles(marbles, values, errorValue, true, mode, factor());
      },
      toEqual: (other) => {
        flushTest.ready = true;
        const expected: TestMessage[] = [];
        flushTest.expected = expected;
        virtual.schedule(() => {
          subscription = subscribe(recorder(expected))(other);
        }, subscriptionFrame);
      },
    };
  };

  const expectSubscriptions = (actualSubscriptionLogs: SubscriptionLog[]): SubscriptionsExpectation => {
    const flushTest: FlushableTest = { ready: false, actual: actualSubscriptionLogs };
    flushTests.push(flushTest);
    const mode = runMode;
    return {
      toBe: (marblesOrMarblesArray) => {
        const marblesArray = typeof marblesOrMarblesArray === 'string' ? [marblesOrMarblesArray] : marblesOrMarblesArray;
        flushTest.ready = true;
        flushTest.expected = marblesArray
          .map((marbles) => parseMarblesAsSubscriptions(marbles, mode, factor()))
          .filter((log) => log.subscribedFrame !== Infinity);
      },
    };
  };

  const flush = (): void => {
    while (hotObservables.length > 0) {
      (hotObservables.shift() as HotObservable<unknown>).setup();
    }
    virtual.flush();
    flushTests = flushTests.filter((flushTest) => {
      if (flushTest.ready) {
        assertDeepEqual(flushTest.actual, flushTest.expected);
        return false;
      }
      return true;
    });
  };

  const run = <T>(callback: (helpers: RunHelpers) => T): T => {
    const prevFrameTimeFactor = TestScheduler.frameTimeFactor;
    TestScheduler.frameTimeFactor = 1;
    runMode = true;

    const animator = createAnimator(virtual, factor);
    installTimerHostDelegate(createDelegates(virtual, animator));

    const helpers: RunHelpers = {
      cold,
      hot,
      flush,
      time: createTime,
      expectObservable,
      expectSubscriptions,
      animate: animator.animate,
    };
    try {
      const result = callback(helpers);
      flush();
      return result;
    } finally {
      TestScheduler.frameTimeFactor = prevFrameTimeFactor;
      runMode = false;
      installTimerHostDelegate(undefined);
    }
  };

  scheduler = Object.freeze({
    get frame() {
      return virtual.frame;
    },
    get index() {
      return virtual.index;
    },
    get maxFrames() {
      return virtual.maxFrames;
    },
    now: virtual.now,
    schedule: virtual.schedule,
    flush,
    assertDeepEqual,
    hotObservables,
    coldObservables,
    createTime,
    createColdObservable: cold,
    createHotObservable: hot,
    expectObservable,
    expectSubscriptions,
    run,
    ...virtualTimeProtocol(virtual),
  }) as TestScheduler;
  return scheduler;
};

/**
 * `rxjs/testing` parity name: a non-constructible functional factory carrying
 * the statics as properties, like the other class-named parity exports.
 */
export const TestScheduler: TestSchedulerFactory = Object.assign(createTestScheduler, {
  frameTimeFactor: 10,
  parseMarbles: <T>(
    marbles: string,
    values?: MarbleValues<T>,
    errorValue?: unknown,
    materializeInnerObservables = false,
    runMode = false
  ): TestMessage[] =>
    parseMarbles(marbles, values, errorValue, materializeInnerObservables, runMode, TestScheduler.frameTimeFactor),
  parseMarblesAsSubscriptions: (marbles: string | null, runMode = false): SubscriptionLog =>
    parseMarblesAsSubscriptions(marbles, runMode, TestScheduler.frameTimeFactor),
});
