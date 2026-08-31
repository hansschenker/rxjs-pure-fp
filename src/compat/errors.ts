import {
  createArgumentOutOfRangeError,
  createEmptyError,
  createNotFoundError,
  createObjectUnsubscribedError,
  createSequenceError,
  createTimeoutError,
} from '../kernel/errors.ts';

/**
 * Root-export parity names for RxJS 7.8.2. Like `UnsubscriptionError`, these
 * are functional factories rather than constructible error classes.
 */

export const EmptyError = (): Error => createEmptyError();

export const ArgumentOutOfRangeError = (): Error => createArgumentOutOfRangeError();

export const SequenceError = (message: string): Error => createSequenceError(message);

export const NotFoundError = (message: string): Error => createNotFoundError(message);

export const ObjectUnsubscribedError = (): Error => createObjectUnsubscribedError();

export const TimeoutError = (info: unknown = null): Error => createTimeoutError(info);
