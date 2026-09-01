import type { PartialObserver } from './sink.ts';

export type NextNotification<T> = {
  readonly kind: 'N';
  readonly value: T;
};

export type ErrorNotification = {
  readonly kind: 'E';
  readonly error: unknown;
};

export type CompleteNotification = {
  readonly kind: 'C';
};

export type ObservableNotification<T> = NextNotification<T> | ErrorNotification | CompleteNotification;

export const nextNotification = <T>(value: T): NextNotification<T> => Object.freeze({ kind: 'N', value });

export const errorNotification = (error: unknown): ErrorNotification => Object.freeze({ kind: 'E', error });

export const COMPLETE_NOTIFICATION: CompleteNotification = Object.freeze({ kind: 'C' });

/**
 * M17 materialization record: the pure-data stand-in for RxJS's deprecated
 * `Notification` class instances — the same four own enumerable fields the
 * class constructor assigns (`kind`, `value`, `error`, `hasValue`), no
 * methods. The deprecated method surface (`observe`/`do`/`accept`/
 * `toObservable`) is compat (`src/compat/notification.ts`).
 */
export type NotificationRecord<T> =
  | { readonly kind: 'N'; readonly value: T; readonly error: undefined; readonly hasValue: true }
  | { readonly kind: 'E'; readonly value: undefined; readonly error: unknown; readonly hasValue: false }
  | { readonly kind: 'C'; readonly value: undefined; readonly error: undefined; readonly hasValue: false };

/**
 * The deprecated constructor preserved `value`/`error` arguments verbatim for
 * any kind, so this generic factory does too; the documented factories below
 * produce the normalized shapes the record type describes.
 */
export const createNotificationRecord = <T>(
  kind: 'N' | 'E' | 'C',
  value?: T,
  error?: unknown
): NotificationRecord<T> =>
  Object.freeze({ kind, value, error, hasValue: kind === 'N' }) as NotificationRecord<T>;

export const nextNotificationRecord = <T>(value: T): NotificationRecord<T> =>
  createNotificationRecord('N', value);

export const errorNotificationRecord = <T = never>(error?: unknown): NotificationRecord<T> =>
  createNotificationRecord<T>('E', undefined, error);

const COMPLETE_NOTIFICATION_RECORD = createNotificationRecord<unknown>('C');

/**
 * Reference-identity parity: RxJS's complete notification is one shared
 * instance across every `materialize` emission.
 */
export const completeNotificationRecord = <T = never>(): NotificationRecord<T> =>
  COMPLETE_NOTIFICATION_RECORD as NotificationRecord<T>;

/**
 * M17: delivers a notification record to a partial observer, mirroring RxJS
 * `observeNotification` — including its validation TypeError and its
 * "unknown string kind completes" fallthrough.
 */
export const observeNotification = <T>(
  notification: ObservableNotification<T>,
  observer: PartialObserver<T>
): void => {
  const { kind } = notification as { readonly kind?: unknown };
  if (typeof kind !== 'string') {
    throw new TypeError('Invalid notification, missing "kind"');
  }
  if (kind === 'N') {
    observer.next?.((notification as NextNotification<T>).value);
  } else if (kind === 'E') {
    observer.error?.((notification as ErrorNotification).error);
  } else {
    observer.complete?.();
  }
};
