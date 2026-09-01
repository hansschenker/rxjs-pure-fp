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
 * M16: the RxJS `reportUnhandledError` policy through the F6 environment —
 * deferred to a later tick, dispatched to `onUnhandledError` when the
 * environment provides one (config-backed envs read the live config at that
 * later moment) and rethrown as an uncaught host error otherwise.
 */
export const reportUnhandledError = (env: RuntimeEnv, error: unknown): void => {
  env.defer(() => {
    const { onUnhandledError } = env;
    if (onUnhandledError) {
      onUnhandledError(error);
    } else {
      throw error;
    }
  });
};

/**
 * M13: the host scheduling edge. Every clock, interval, and microtask the
 * kernel uses flows through this record — the scheduler kernel consumes it,
 * and the architecture gate keeps host timer access confined to this module.
 * M18 adds the animation-frame edge (`requestFrame`/`cancelFrame`) and the
 * high-resolution clock behind `animationFrames`.
 */
export type TimerId = ReturnType<typeof globalThis.setInterval>;

/** Opaque host animation-frame handle: the request id, or a timer under polyfills. */
export type FrameHandle = unknown;

export type TimerHost = {
  readonly now: () => number;
  readonly performanceNow: () => number;
  readonly interval: (handler: () => void, delayMillis: number) => TimerId;
  readonly cancelInterval: (id: TimerId) => void;
  readonly microtask: (task: () => void) => void;
  readonly requestFrame: (handler: (frameTime: number) => void) => FrameHandle;
  readonly cancelFrame: (handle: FrameHandle) => void;
};

/**
 * The frame edge is looked up on the host at call time, exactly as RxJS's
 * `animationFrameProvider` resolves `requestAnimationFrame` per call: hosts
 * (and tests) may install it after module load. A missing host API surfaces
 * as RxJS's `ReferenceError`.
 */
type FrameHost = {
  readonly requestAnimationFrame?: (handler: (frameTime: number) => void) => FrameHandle;
  readonly cancelAnimationFrame?: (handle: FrameHandle) => void;
  readonly performance?: { readonly now: () => number };
};

const frameHost = (): FrameHost => globalThis as FrameHost;

export const timerHost: TimerHost = Object.freeze({
  now: () => Date.now(),
  performanceNow: (): number => {
    const { performance } = frameHost();
    if (!performance) {
      throw new ReferenceError('performance is not defined');
    }
    return performance.now();
  },
  interval: (handler: () => void, delayMillis: number): TimerId => globalThis.setInterval(handler, delayMillis),
  cancelInterval: (id: TimerId): void => {
    globalThis.clearInterval(id);
  },
  microtask: (task: () => void): void => {
    globalThis.queueMicrotask(task);
  },
  requestFrame: (handler: (frameTime: number) => void): FrameHandle => {
    const { requestAnimationFrame } = frameHost();
    if (!requestAnimationFrame) {
      throw new ReferenceError('requestAnimationFrame is not defined');
    }
    return requestAnimationFrame(handler);
  },
  cancelFrame: (handle: FrameHandle): void => {
    const { cancelAnimationFrame } = frameHost();
    if (!cancelAnimationFrame) {
      throw new ReferenceError('cancelAnimationFrame is not defined');
    }
    cancelAnimationFrame(handle);
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
