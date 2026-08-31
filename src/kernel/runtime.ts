import type { ObservableNotification } from './notification.ts';
import type { Subscriber } from './sink.ts';

/**
 * F6 (docs/FP-ROADMAP.md): runtime policy as an explicit environment instead
 * of a mutable global. Kernel machinery receives a `RuntimeEnv`; subscribers
 * carry theirs and operator subscribers inherit it from their destination.
 * `defer` is the deferral edge — and the seam the M13 scheduler kernel turns
 * into policy.
 */
export type RuntimeEnv = {
  readonly onUnhandledError: ((error: unknown) => void) | null;
  readonly onStoppedNotification:
    | ((notification: ObservableNotification<unknown>, subscriber: Subscriber<unknown>) => void)
    | null;
  readonly defer: (task: () => void) => void;
};

/**
 * M13: the host scheduling edge. Every clock, interval, and microtask the
 * kernel uses flows through this record — the scheduler kernel consumes it,
 * and the architecture gate keeps host timer access confined to this module.
 */
export type TimerId = ReturnType<typeof globalThis.setInterval>;

export type TimerHost = {
  readonly now: () => number;
  readonly interval: (handler: () => void, delayMillis: number) => TimerId;
  readonly cancelInterval: (id: TimerId) => void;
  readonly microtask: (task: () => void) => void;
};

export const timerHost: TimerHost = Object.freeze({
  now: () => Date.now(),
  interval: (handler: () => void, delayMillis: number): TimerId => globalThis.setInterval(handler, delayMillis),
  cancelInterval: (id: TimerId): void => {
    globalThis.clearInterval(id);
  },
  microtask: (task: () => void): void => {
    globalThis.queueMicrotask(task);
  },
});

/**
 * The environment used when none is injected: silent policies, host timer as
 * the deferral edge. The RxJS 7.8.2 parity environment (backed by the mutable
 * `config` object) is compat surface: `src/compat/config.ts`.
 */
export const defaultEnv: RuntimeEnv = Object.freeze({
  onUnhandledError: null,
  onStoppedNotification: null,
  defer: (task: () => void): void => {
    globalThis.setTimeout(task);
  },
});
