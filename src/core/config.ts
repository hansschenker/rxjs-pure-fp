import type { ObservableNotification } from './notification.ts';
import type { Subscriber } from './sink.ts';

export type GlobalConfig = {
  onUnhandledError: ((error: unknown) => void) | null;
  onStoppedNotification: ((notification: ObservableNotification<unknown>, subscriber: Subscriber<unknown>) => void) | null;
  Promise?: PromiseConstructorLike | undefined;
  useDeprecatedSynchronousErrorHandling: boolean;
  useDeprecatedNextContext: boolean;
};

export const config: GlobalConfig = {
  onUnhandledError: null,
  onStoppedNotification: null,
  Promise: undefined,
  useDeprecatedSynchronousErrorHandling: false,
  useDeprecatedNextContext: false,
};
