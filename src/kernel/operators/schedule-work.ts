import type { Scheduler } from '../scheduler.ts';
import type { Subscription } from '../subscription.ts';

/**
 * Schedules one unit of work owned by `parent`: the action joins the parent's
 * lifecycle so unsubscription cancels pending work, and a completed action
 * removes itself again. Returns the action so callers can cancel just this
 * unit (RxJS's `executeSchedule` non-repeating contract, used by `timeout`).
 */
export const executeScheduledWork = (
  parent: Subscription,
  scheduler: Scheduler,
  work: () => void,
  delay = 0
): Subscription => {
  let action: Subscription | null = null;
  action = scheduler.schedule(() => {
    work();
    action?.unsubscribe();
  }, delay);
  parent.add(action);
  return action;
};

/**
 * Repeating variant (RxJS `executeSchedule` with `repeat: true`, used by the
 * bufferTime/windowTime creation interval): the single action reschedules
 * itself after each run and joins `parent` so unsubscription stops the cycle.
 */
export const executeRepeatingScheduledWork = (
  parent: Subscription,
  scheduler: Scheduler,
  work: () => void,
  delay = 0
): void => {
  parent.add(
    scheduler.schedule<undefined>((_state, action) => {
      work();
      action.schedule(undefined, delay);
    }, delay)
  );
};
