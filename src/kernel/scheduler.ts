import { timerHost, type TimerId } from './runtime.ts';
import {
  createLifecycleState,
  type LifecycleState,
  type Subscription,
} from './subscription.ts';

/**
 * M13 scheduler kernel: one reschedulable action machine over the runtime's
 * `timerHost` edge, with execution-time policies as scheduler records —
 * async (interval-backed actions with id recycling), queue (synchronous
 * trampoline at zero delay), asap (microtask-batched at zero delay), and
 * since M18 animationFrame (frame-batched at zero delay) — the latter two are
 * one batch machine over different host edges.
 *
 * Work receives its action as a parameter instead of RxJS's `this` binding:
 * `(state, action) => void`, rescheduling via `action.schedule(state, delay)`.
 */
export type SchedulerAction<S> = Subscription & {
  readonly schedule: (state?: S, delay?: number) => Subscription;
};

export type SchedulerWork<S> = (state: S | undefined, action: SchedulerAction<S>) => void;

export type Scheduler = {
  readonly now: () => number;
  readonly schedule: <S>(work: SchedulerWork<S>, delay?: number, state?: S) => Subscription;
};

/** Anything with a clock: schedulers double as timestamp providers, as in RxJS. */
export type TimestampProvider = {
  readonly now: () => number;
};

/** RxJS `dateTimestampProvider` without the test-scheduler delegate hook. */
export const dateTimestampProvider: TimestampProvider = Object.freeze({ now: () => timerHost.now() });

/**
 * M18: the functional stand-in for RxJS's `Scheduler` base class — an action
 * factory plus a clock. Each `schedule` call builds one action and schedules
 * it, exactly `new SchedulerAction(this, work).schedule(state, delay)`.
 */
export type SchedulerActionFactory = <S>(
  scheduler: Scheduler,
  work: SchedulerWork<S>
) => SchedulerAction<S>;

export const createScheduler = (
  createAction: SchedulerActionFactory,
  now: () => number = dateTimestampProvider.now
): Scheduler => {
  let scheduler!: Scheduler;
  scheduler = Object.freeze({
    now,
    schedule: <S>(work: SchedulerWork<S>, delay = 0, state?: S): Subscription =>
      createAction(scheduler, work).schedule(state, delay),
  });
  return scheduler;
};

/**
 * Structural scheduler detection for the polymorphic compat argument
 * positions (`timer(due, intervalOrScheduler)`), mirroring RxJS's
 * `isScheduler` duck check.
 */
export const isScheduler = (value: unknown): value is Scheduler =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { readonly schedule?: unknown }).schedule === 'function';

const composeAction = <S>(
  lifecycle: LifecycleState,
  scheduleSelf: (state?: S, delay?: number) => Subscription
): SchedulerAction<S> => {
  const action = Object.freeze({
    get closed() {
      return lifecycle.isClosed();
    },
    unsubscribe: lifecycle.unsubscribe,
    add: lifecycle.add,
    remove: lifecycle.remove,
    schedule: scheduleSelf,
    ...lifecycle.protocol,
  }) as unknown as SchedulerAction<S>;
  lifecycle.setSelf(action);
  return action;
};

const createAsyncAction = <S>(work: SchedulerWork<S>): SchedulerAction<S> => {
  let id: TimerId | null = null;
  let currentDelay = 0;
  let pending = false;
  let state: S | undefined;
  const lifecycle = createLifecycleState(() => {
    pending = false;
    state = undefined;
    if (id !== null) {
      timerHost.cancelInterval(id);
      id = null;
    }
  });
  let action!: SchedulerAction<S>;

  const execute = (): void => {
    if (lifecycle.isClosed()) {
      return;
    }
    pending = false;
    try {
      work(state, action);
    } catch (error) {
      lifecycle.unsubscribe();
      throw error;
    }
    // An action not rescheduled during its work releases its interval; a
    // same-delay reschedule keeps it ticking (RxJS id recycling).
    if (!pending && id !== null) {
      timerHost.cancelInterval(id);
      id = null;
    }
  };

  const scheduleSelf = (nextState?: S, delay = 0): Subscription => {
    if (lifecycle.isClosed()) {
      return action;
    }
    state = nextState;
    if (id !== null && (currentDelay !== delay || pending)) {
      timerHost.cancelInterval(id);
      id = null;
    }
    pending = true;
    currentDelay = delay;
    id = id ?? timerHost.interval(execute, delay);
    return action;
  };

  action = composeAction(lifecycle, scheduleSelf);
  return action;
};

export const asyncScheduler: Scheduler = createScheduler((_scheduler, work) => createAsyncAction(work));

/** Builds a zero-delay action whose runs are admitted through `admit`. */
const createDeferredAction = <S>(
  work: SchedulerWork<S>,
  admit: (run: () => void) => void,
  initialState: S | undefined
): SchedulerAction<S> => {
  let state = initialState;
  const lifecycle = createLifecycleState();
  let action!: SchedulerAction<S>;
  const run = (): void => {
    if (!lifecycle.isClosed()) {
      work(state, action);
    }
  };
  const scheduleSelf = (nextState?: S, delay = 0): Subscription => {
    if (lifecycle.isClosed()) {
      return action;
    }
    if (delay > 0) {
      return asyncScheduler.schedule(work, delay, nextState);
    }
    state = nextState;
    admit(run);
    return action;
  };
  action = composeAction(lifecycle, scheduleSelf);
  admit(run);
  return action;
};

const createQueueScheduler = (): Scheduler => {
  const pending: Array<() => void> = [];
  let active = false;
  const trampoline = (run: () => void): void => {
    pending.push(run);
    if (active) {
      return;
    }
    active = true;
    try {
      while (pending.length > 0) {
        (pending.shift() as () => void)();
      }
    } finally {
      active = false;
      pending.length = 0;
    }
  };
  return Object.freeze({
    now: dateTimestampProvider.now,
    schedule: <S>(work: SchedulerWork<S>, delay = 0, state?: S): Subscription =>
      delay > 0
        ? asyncScheduler.schedule(work, delay, state)
        : createDeferredAction(work, trampoline, state),
  });
};

/**
 * One batch machine for the two host-batched policies. Work admitted while
 * no batch is armed arms one through `request`; when the host fires it, the
 * batch is closed *before* running, so work admitted during the flush arms
 * the next batch (RxJS clears `_scheduled` at flush start and runs only the
 * actions carrying that flush id). A throw drops the rest of the batch and
 * follows the host's uncaught path.
 */
const createBatchScheduler = (request: (flush: () => void) => void): Scheduler => {
  let batch: Array<() => void> = [];
  let armed = false;
  const admit = (run: () => void): void => {
    batch.push(run);
    if (armed) {
      return;
    }
    armed = true;
    request(() => {
      armed = false;
      const current = batch;
      batch = [];
      for (const scheduledRun of current) {
        scheduledRun();
      }
    });
  };
  return Object.freeze({
    now: dateTimestampProvider.now,
    schedule: <S>(work: SchedulerWork<S>, delay = 0, state?: S): Subscription =>
      delay > 0
        ? asyncScheduler.schedule(work, delay, state)
        : createDeferredAction(work, admit, state),
  });
};

export const queueScheduler: Scheduler = createQueueScheduler();

/** Microtask-batched at zero delay (RxJS `AsapScheduler` over its promise-based `Immediate`). */
export const asapScheduler: Scheduler = createBatchScheduler((flush) => timerHost.microtask(flush));

/**
 * M18: frame-batched at zero delay over the runtime's animation-frame edge —
 * everything admitted before a frame fires runs in that frame, in admission
 * order; work admitted during a frame belongs to the next one.
 */
export const animationFrameScheduler: Scheduler = createBatchScheduler((flush) => {
  timerHost.requestFrame(flush);
});
