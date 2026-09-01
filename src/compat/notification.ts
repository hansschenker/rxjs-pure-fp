import { EMPTY } from '../kernel/creation/empty.ts';
import { of } from '../kernel/creation/of.ts';
import { throwError } from '../kernel/creation/throw-error.ts';
import {
  createNotificationRecord,
  observeNotification,
  type NotificationRecord,
} from '../kernel/notification.ts';
import type { Observable } from '../kernel/observable.ts';
import type { PartialObserver } from '../kernel/sink.ts';

/**
 * RxJS 7.8.2 root-parity names for the deprecated notification surface. Like
 * the compat `Observable`, `Notification` is a non-constructible functional
 * factory carrying the class statics as function properties. Data fields stay
 * own enumerable properties exactly as the class constructor assigns them;
 * the deprecated methods are attached non-enumerably, as prototype methods
 * are, so materialized data records and these records stay deep-equal.
 */

export type Notification<T> = NotificationRecord<T> & {
  /** Delivers this notification to a partial observer. */
  readonly observe: (observer: PartialObserver<T>) => void;
  /** Delivers this notification to the matching one of three callbacks. */
  readonly do: (
    next?: (value: T) => void,
    error?: (error: unknown) => void,
    complete?: () => void
  ) => void;
  /** Deprecated polymorphic surface: observer form or callback form. */
  readonly accept: (
    nextOrObserver?: PartialObserver<T> | ((value: T) => void) | null,
    error?: (error: unknown) => void,
    complete?: () => void
  ) => void;
  /** The single-notification Observable: `of`, `throwError`, or `EMPTY`. */
  readonly toObservable: () => Observable<T>;
};

const enrichNotification = <T>(record: NotificationRecord<T>): Notification<T> => {
  const { kind, value, error } = record;

  const doNotification = (
    next?: (value: T) => void,
    errorHandler?: (error: unknown) => void,
    complete?: () => void
  ): void => {
    if (kind === 'N') {
      next?.(value as T);
    } else if (kind === 'E') {
      errorHandler?.(error);
    } else {
      complete?.();
    }
  };

  const observe = (observer: PartialObserver<T>): void => observeNotification(record, observer);

  return Object.freeze(
    Object.defineProperties({ ...record }, {
      observe: { value: observe },
      do: { value: doNotification },
      accept: {
        value: (
          nextOrObserver?: PartialObserver<T> | ((value: T) => void) | null,
          errorHandler?: (error: unknown) => void,
          complete?: () => void
        ): void => {
          if (typeof (nextOrObserver as PartialObserver<T> | null | undefined)?.next === 'function') {
            observe(nextOrObserver as PartialObserver<T>);
          } else {
            doNotification(nextOrObserver as ((value: T) => void) | undefined, errorHandler, complete);
          }
        },
      },
      toObservable: {
        value: (): Observable<T> => {
          if (kind === 'N') {
            return of(value as T);
          }
          if (kind === 'E') {
            return throwError(() => error);
          }
          if ((kind as string) === 'C') {
            return EMPTY;
          }
          throw new TypeError(`Unexpected notification kind ${String(kind)}`);
        },
      },
    })
  ) as Notification<T>;
};

const notificationFactory = <T>(
  kind: 'N' | 'E' | 'C',
  value?: T,
  error?: unknown
): Notification<T> => enrichNotification(createNotificationRecord(kind, value, error));

const COMPLETE_ENRICHED = enrichNotification(createNotificationRecord<never>('C'));

export const Notification = Object.assign(notificationFactory, {
  createNext: <T>(value: T): Notification<T> =>
    enrichNotification(createNotificationRecord('N', value)),
  createError: <T = never>(error?: unknown): Notification<T> =>
    enrichNotification(createNotificationRecord<T>('E', undefined, error)),
  /** Reference-identity parity: one shared complete notification. */
  createComplete: <T = never>(): Notification<T> => COMPLETE_ENRICHED as Notification<T>,
});

/**
 * Runtime shape of RxJS's string enum `NotificationKind` (string enums emit
 * no reverse mapping).
 */
export const NotificationKind = Object.freeze({
  NEXT: 'N',
  ERROR: 'E',
  COMPLETE: 'C',
} as const);

export type NotificationKind = (typeof NotificationKind)[keyof typeof NotificationKind];
