export type UnaryFunction<T, R> = (value: T) => R;

/** RxJS 7.8.2 root-parity utility; also the identity operator. */
export const identity = <T>(value: T): T => value;

/** RxJS 7.8.2 root-parity utility; swallows a notification on purpose. */
export const noop = (): void => {};

export function pipe<T>(): UnaryFunction<T, T>;
export function pipe<A, B>(ab: UnaryFunction<A, B>): UnaryFunction<A, B>;
export function pipe<A, B, C>(ab: UnaryFunction<A, B>, bc: UnaryFunction<B, C>): UnaryFunction<A, C>;
export function pipe<A, B, C, D>(
  ab: UnaryFunction<A, B>,
  bc: UnaryFunction<B, C>,
  cd: UnaryFunction<C, D>
): UnaryFunction<A, D>;
export function pipe<A, B, C, D, E>(
  ab: UnaryFunction<A, B>,
  bc: UnaryFunction<B, C>,
  cd: UnaryFunction<C, D>,
  de: UnaryFunction<D, E>
): UnaryFunction<A, E>;
export function pipe<A, B, C, D, E, F>(
  ab: UnaryFunction<A, B>,
  bc: UnaryFunction<B, C>,
  cd: UnaryFunction<C, D>,
  de: UnaryFunction<D, E>,
  ef: UnaryFunction<E, F>
): UnaryFunction<A, F>;
export function pipe(...functions: Array<(value: unknown) => unknown>): (value: unknown) => unknown {
  if (functions.length === 0) {
    return (value) => value;
  }

  return (value) => {
    let result = value;
    for (const fn of functions) {
      result = fn(result);
    }
    return result;
  };
}

export function pipeValue<T>(value: T): T;
export function pipeValue<A, B>(value: A, ab: UnaryFunction<A, B>): B;
export function pipeValue<A, B, C>(value: A, ab: UnaryFunction<A, B>, bc: UnaryFunction<B, C>): C;
export function pipeValue<A, B, C, D>(
  value: A,
  ab: UnaryFunction<A, B>,
  bc: UnaryFunction<B, C>,
  cd: UnaryFunction<C, D>
): D;
export function pipeValue<A, B, C, D, E>(
  value: A,
  ab: UnaryFunction<A, B>,
  bc: UnaryFunction<B, C>,
  cd: UnaryFunction<C, D>,
  de: UnaryFunction<D, E>
): E;
export function pipeValue(value: unknown, ...functions: Array<(value: unknown) => unknown>): unknown {
  let result = value;
  for (const fn of functions) {
    result = fn(result);
  }
  return result;
}
