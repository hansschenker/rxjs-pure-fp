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
