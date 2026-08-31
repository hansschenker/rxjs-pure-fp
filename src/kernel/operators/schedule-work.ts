import type { Scheduler } from '../scheduler.ts';
import type { Subscription } from '../subscription.ts';

/**
 * Schedules one unit of work owned by `parent`: the action joins the parent's
 * lifecycle so unsubscription cancels pending work, and a completed action
 * removes itself again.
 */
export const executeScheduledWork = (
  parent: Subscription,
  scheduler: Scheduler,
  work: () => void,
  delay = 0
): void => {
  let action: Subscription | null = null;
  action = scheduler.schedule(() => {
    work();
    action?.unsubscribe();
  }, delay);
  parent.add(action);
};
