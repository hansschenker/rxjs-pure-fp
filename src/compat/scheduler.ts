import {
  createScheduler,
  dateTimestampProvider,
  type Scheduler as SchedulerRecord,
  type SchedulerActionFactory,
  type SchedulerWork,
} from '../kernel/scheduler.ts';
import {
  createVirtualAction,
  createVirtualTimeScheduler,
  sortVirtualActions,
  type VirtualAction as VirtualActionRecord,
  type VirtualActionFactory,
  type VirtualTimeScheduler as VirtualTimeSchedulerRecord,
} from '../kernel/virtual-time.ts';

/**
 * RxJS 7.8.2 root-parity names for the class-shaped scheduler surface. Like
 * the other class-named parity exports these are non-constructible
 * functional factories carrying the class statics as function properties:
 * `Scheduler.now`, `VirtualTimeScheduler.frameTimeFactor`, and
 * `VirtualAction.sortActions`.
 */

export type Scheduler = SchedulerRecord;

export type SchedulerFactory = {
  (createAction: SchedulerActionFactory, now?: () => number): SchedulerRecord;
  readonly now: () => number;
};

export const Scheduler: SchedulerFactory = Object.assign(
  (createAction: SchedulerActionFactory, now: () => number = dateTimestampProvider.now): SchedulerRecord =>
    createScheduler(createAction, now),
  { now: dateTimestampProvider.now }
);

export type VirtualAction<S> = VirtualActionRecord<S>;

export type VirtualActionFactoryShape = {
  <S>(scheduler: VirtualTimeSchedulerRecord, work: SchedulerWork<S>, index?: number): VirtualActionRecord<S>;
  readonly sortActions: typeof sortVirtualActions;
};

export const VirtualAction: VirtualActionFactoryShape = Object.assign(
  <S>(scheduler: VirtualTimeSchedulerRecord, work: SchedulerWork<S>, index?: number): VirtualActionRecord<S> =>
    createVirtualAction(scheduler, work, index),
  { sortActions: sortVirtualActions }
);

export type VirtualTimeScheduler = VirtualTimeSchedulerRecord;

export type VirtualTimeSchedulerFactory = {
  (createAction?: VirtualActionFactory, maxFrames?: number): VirtualTimeSchedulerRecord;
  frameTimeFactor: number;
};

export const VirtualTimeScheduler: VirtualTimeSchedulerFactory = Object.assign(
  (createAction: VirtualActionFactory = VirtualAction, maxFrames = Infinity): VirtualTimeSchedulerRecord =>
    createVirtualTimeScheduler({ createAction, maxFrames }),
  { frameTimeFactor: 10 }
);
