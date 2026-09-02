import type { Scheduler, SchedulerAction, SchedulerWork } from './scheduler.ts';
import { EMPTY_SUBSCRIPTION, createLifecycleState, type Subscription } from './subscription.ts';

/**
 * M18: virtual time over the M13 action machine's shape. Actions are queue
 * entries ordered by (absolute frame, creation index); `flush` runs them in
 * order, advancing the clock to each entry's frame, until the queue is empty
 * or the next entry lies beyond `maxFrames`. Nothing here touches the host
 * timer edge — virtual time is pure data, exactly RxJS's `VirtualTimeScheduler`
 * / `VirtualAction` pair without the class hierarchy.
 */
export type VirtualAction<S> = SchedulerAction<S> & {
  /** Absolute frame this action is queued for (RxJS's `delay` after scheduling). */
  readonly delay: number;
  /** Creation order, the tie-breaker among same-frame actions. */
  readonly index: number;
};

export type VirtualTimeScheduler = Scheduler & {
  readonly frame: number;
  readonly index: number;
  readonly maxFrames: number;
  readonly flush: () => void;
};

export type VirtualActionFactory = <S>(
  scheduler: VirtualTimeScheduler,
  work: SchedulerWork<S>
) => VirtualAction<S>;

/**
 * `maxFrames` is the frame budget a `flush` may advance to — a number, or
 * (M21) a live policy read at every flush step, which is how a TestScheduler
 * lifts the budget for the duration of `run()` without a mutable field.
 */
export type VirtualTimeConfig = {
  readonly maxFrames?: number | (() => number);
  readonly createAction?: VirtualActionFactory;
};

type QueueEntry = {
  readonly delay: number;
  readonly index: number;
  readonly execute: () => unknown;
  readonly unsubscribe: () => void;
};

/** The scheduler-side protocol an action needs: the clock, indexes, and the sorted queue. */
type VirtualQueue = {
  readonly frame: () => number;
  readonly assignIndex: (explicit?: number) => number;
  readonly enqueue: (entry: QueueEntry) => void;
  readonly dequeue: (entry: QueueEntry) => void;
};

const queueSymbol = Symbol('rxjs-pure-fp.virtual-time.queue');

type QueueCarrier = { readonly [queueSymbol]?: VirtualQueue };

/** RxJS `VirtualAction.sortActions`: by absolute frame, then creation index. */
export const sortVirtualActions = (
  a: { readonly delay: number; readonly index: number },
  b: { readonly delay: number; readonly index: number }
): number => {
  if (a.delay === b.delay) {
    if (a.index === b.index) {
      return 0;
    }
    return a.index > b.index ? 1 : -1;
  }
  return a.delay > b.delay ? 1 : -1;
};

const queueOf = (scheduler: VirtualTimeScheduler): VirtualQueue => {
  const queue = (scheduler as QueueCarrier)[queueSymbol];
  if (!queue) {
    throw new TypeError('A virtual action requires a virtual time scheduler');
  }
  return queue;
};

/**
 * M21: the queue protocol as a spreadable carrier, the same pattern as the
 * subscription lifecycle's `protocol`. A record composed over a virtual time
 * scheduler (the TestScheduler) spreads this in so virtual actions accept it
 * as their scheduler.
 */
export const virtualTimeProtocol = (scheduler: VirtualTimeScheduler): object => ({
  [queueSymbol]: queueOf(scheduler),
});

/**
 * One virtual action. Its first `schedule` enqueues it at `frame + delay`;
 * a `schedule` while it is still queued (RxJS: while it holds an id — which
 * includes rescheduling from inside its own work) deactivates it and
 * delegates to a child action owned by this one, so unsubscribing the
 * original cancels the whole reschedule chain. Non-finite delays return the
 * shared empty subscription.
 */
export const createVirtualAction = <S>(
  scheduler: VirtualTimeScheduler,
  work: SchedulerWork<S>,
  index?: number
): VirtualAction<S> => {
  const queue = queueOf(scheduler);
  const actionIndex = queue.assignIndex(index);
  let state: S | undefined;
  let queued = false;
  let pending = false;
  let active = true;
  let absoluteDelay = 0;
  let entry: QueueEntry | null = null;

  const lifecycle = createLifecycleState(() => {
    pending = false;
    state = undefined;
    if (entry !== null) {
      queue.dequeue(entry);
      entry = null;
    }
    queued = false;
  });
  let action!: VirtualAction<S>;

  // RxJS `AsyncAction.execute`: returns the error instead of throwing so the
  // flush can unwind the rest of the queue before rethrowing.
  const execute = (): unknown => {
    if (lifecycle.isClosed()) {
      return new Error('executing a cancelled action');
    }
    pending = false;
    if (active) {
      try {
        work(state, action);
      } catch (error) {
        lifecycle.unsubscribe();
        return error ? error : new Error('Scheduled action threw falsy error');
      }
    }
    if (!pending) {
      queued = false;
      entry = null;
    }
    return undefined;
  };

  const scheduleSelf = (nextState?: S, delay = 0): Subscription => {
    if (!Number.isFinite(delay)) {
      return EMPTY_SUBSCRIPTION;
    }
    if (!queued) {
      if (lifecycle.isClosed()) {
        return action;
      }
      state = nextState;
      pending = true;
      absoluteDelay = queue.frame() + delay;
      entry = { delay: absoluteDelay, index: actionIndex, execute, unsubscribe: lifecycle.unsubscribe };
      queue.enqueue(entry);
      queued = true;
      return action;
    }
    active = false;
    const child = createVirtualAction(scheduler, work);
    lifecycle.add(child);
    return child.schedule(nextState, delay);
  };

  action = Object.freeze({
    get closed() {
      return lifecycle.isClosed();
    },
    get delay() {
      return absoluteDelay;
    },
    index: actionIndex,
    unsubscribe: lifecycle.unsubscribe,
    add: lifecycle.add,
    remove: lifecycle.remove,
    schedule: scheduleSelf,
    ...lifecycle.protocol,
  }) as unknown as VirtualAction<S>;
  lifecycle.setSelf(action);
  return action;
};

/**
 * A scheduler whose clock only advances inside `flush`. `now()` is the
 * current frame; `schedule` enqueues through the action factory (virtual
 * actions by default); `flush` drains the queue in (frame, index) order up to
 * `maxFrames`, unsubscribing the remaining entries and rethrowing when work
 * throws.
 */
export const createVirtualTimeScheduler = (config: VirtualTimeConfig = {}): VirtualTimeScheduler => {
  const { maxFrames: budget = Infinity, createAction = createVirtualAction } = config;
  const maxFrames = typeof budget === 'function' ? budget : () => budget;
  const actions: QueueEntry[] = [];
  let frame = 0;
  let index = -1;
  let scheduler!: VirtualTimeScheduler;

  const queue: VirtualQueue = {
    frame: () => frame,
    assignIndex: (explicit) => {
      index = explicit ?? index + 1;
      return index;
    },
    enqueue: (entry) => {
      actions.push(entry);
      actions.sort(sortVirtualActions);
    },
    dequeue: (entry) => {
      const at = actions.indexOf(entry);
      if (at >= 0) {
        actions.splice(at, 1);
      }
    },
  };

  const flush = (): void => {
    let error: unknown;
    let entry: QueueEntry | undefined;
    while ((entry = actions[0]) && entry.delay <= maxFrames()) {
      actions.shift();
      frame = entry.delay;
      if ((error = entry.execute())) {
        break;
      }
    }
    if (error) {
      while ((entry = actions.shift())) {
        entry.unsubscribe();
      }
      throw error;
    }
  };

  scheduler = Object.freeze({
    get frame() {
      return frame;
    },
    get index() {
      return index;
    },
    get maxFrames() {
      return maxFrames();
    },
    now: () => frame,
    flush,
    schedule: <S>(work: SchedulerWork<S>, delay = 0, state?: S): Subscription =>
      createAction(scheduler, work).schedule(state, delay),
    [queueSymbol]: queue,
  }) as VirtualTimeScheduler;
  return scheduler;
};
