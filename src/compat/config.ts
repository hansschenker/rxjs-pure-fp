import type { ObservableNotification } from '../kernel/notification.ts';
import type { RuntimeEnv } from '../kernel/runtime.ts';
import type { Subscriber } from '../kernel/sink.ts';

export type GlobalConfig = {
  onUnhandledError: ((error: unknown) => void) | null;
  onStoppedNotification: ((notification: ObservableNotification<unknown>, subscriber: Subscriber<unknown>) => void) | null;
  Promise?: PromiseConstructorLike | undefined;
  useDeprecatedSynchronousErrorHandling: boolean;
  useDeprecatedNextContext: boolean;
};

/**
 * RxJS 7.8.2 global configuration surface. The mutable-singleton shape is
 * required parity; since F6 it lives in compat and only backs `configEnv`,
 * the environment the parity constructors inject into the kernel.
 */
export const config: GlobalConfig = {
  onUnhandledError: null,
  onStoppedNotification: null,
  Promise: undefined,
  useDeprecatedSynchronousErrorHandling: false,
  useDeprecatedNextContext: false,
};

/**
 * Live, config-backed runtime environment (F6). The getters read `config` at
 * dispatch time, preserving the lazy-read semantics of the global surface.
 */
export const configEnv: RuntimeEnv = Object.freeze({
  get onUnhandledError() {
    return config.onUnhandledError;
  },
  get onStoppedNotification() {
    return config.onStoppedNotification;
  },
  defer: (task: () => void): void => {
    globalThis.setTimeout(task);
  },
});
