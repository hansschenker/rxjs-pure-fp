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
 * trampoline at zero delay), asap (microtask-batched at zero delay).
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

export const asyncScheduler: Scheduler = Object.freeze({
  now: timerHost.now,
  schedule: <S>(work: SchedulerWork<S>, delay = 0, state?: S): Subscription =>
    createAsyncAction(work).schedule(state, delay),
});

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
    now: timerHost.now,
    schedule: <S>(work: SchedulerWork<S>, delay = 0, state?: S): Subscription =>
      delay > 0
        ? asyncScheduler.schedule(work, delay, state)
        : createDeferredAction(work, trampoline, state),
  });
};

const createAsapScheduler = (): Scheduler => {
  const pending: Array<() => void> = [];
  let flushArmed = false;
  const batch = (run: () => void): void => {
    pending.push(run);
    if (flushArmed) {
      return;
    }
    flushArmed = true;
    timerHost.microtask(() => {
      try {
        while (pending.length > 0) {
          (pending.shift() as () => void)();
        }
      } finally {
        flushArmed = false;
        pending.length = 0;
      }
    });
  };
  return Object.freeze({
    now: timerHost.now,
    schedule: <S>(work: SchedulerWork<S>, delay = 0, state?: S): Subscription =>
      delay > 0
        ? asyncScheduler.schedule(work, delay, state)
        : createDeferredAction(work, batch, state),
  });
};

export const queueScheduler: Scheduler = createQueueScheduler();

export const asapScheduler: Scheduler = createAsapScheduler();
