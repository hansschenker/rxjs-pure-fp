/**
 * M06 termination-semantics errors. Functional factories over platform
 * `Error` — no class-based error hierarchy; identity is the `name` field,
 * matching RxJS 7.8.2 messages exactly. The root-export parity names are
 * compat surface (`src/compat/errors.ts`).
 */

export const createEmptyError = (): Error => namedError('EmptyError', 'no elements in sequence');

export const createArgumentOutOfRangeError = (): Error => namedError('ArgumentOutOfRangeError', 'argument out of range');

export const createSequenceError = (message: string): Error => namedError('SequenceError', message);

export const createNotFoundError = (message: string): Error => namedError('NotFoundError', message);

export const createObjectUnsubscribedError = (): Error =>
  namedError('ObjectUnsubscribedError', 'object unsubscribed');

/**
 * M14: RxJS's `TimeoutError` carries the timeout diagnostics record on an
 * `info` property; here that is a plain data property on a named platform
 * `Error`.
 */
export const createTimeoutError = (info: unknown = null): Error => {
  const error = namedError('TimeoutError', 'Timeout has occurred') as Error & { info: unknown };
  error.info = info;
  return error;
};

const namedError = (name: string, message: string): Error => {
  const error = new Error(message);
  error.name = name;
  return error;
};
