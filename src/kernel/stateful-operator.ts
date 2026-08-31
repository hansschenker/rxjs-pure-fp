import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from './operator.ts';

/**
 * F3 (docs/FP-ROADMAP.md): stateful operators as pure step functions over an
 * emission ADT, with the only mutable state cell owned by one runner.
 *
 * M06 extends the ADT with terminal emissions — selection operators are steps
 * that can end participation: `last` emits then completes, `done` completes
 * without emitting. A step that needs the error channel throws; the runner's
 * operator Subscriber routes the throw downstream.
 */
export type Emit<R> =
  | { readonly kind: 'none' }
  | { readonly kind: 'one'; readonly value: R }
  | { readonly kind: 'last'; readonly value: R }
  | { readonly kind: 'done' };

export const emitNone: Emit<never> = { kind: 'none' };

export const emitOne = <R>(value: R): Emit<R> => ({ kind: 'one', value });

export const emitLast = <R>(value: R): Emit<R> => ({ kind: 'last', value });

export const emitDone: Emit<never> = { kind: 'done' };

/**
 * A pure operator step: given the committed state and the current source value,
 * returns the next state plus at most one downstream emission. Steps must not
 * mutate state values; state that requires in-place mutation (such as
 * `distinct`'s Set) stays a fused operator by design.
 */
export type Step<S, T, R> = (state: S, value: T, index: number) => readonly [S, Emit<R>];

/** Completion policy: derives a final emission from the last committed state. */
export type Flush<S, R> = (state: S, index: number) => Emit<R>;

export const statefulOperator = <S, T, R>(
  initial: S,
  step: Step<S, T, R>,
  flush?: Flush<S, R>
): OperatorFunction<T, R> =>
  operate((source, destination) => {
    let state = initial;
    let index = 0;

    const operatorSubscriber = createOperatorSubscriber<T, R>(
      destination,
      (value) => {
        const [nextState, emission] = step(state, value, index++);
        // Committed before emission: downstream code can re-enter synchronously
        // and must observe the post-step state (RxJS reentrancy semantics).
        state = nextState;
        if (emission.kind === 'one') {
          destination.next(emission.value);
        } else if (emission.kind === 'last') {
          destination.next(emission.value);
          destination.complete();
        } else if (emission.kind === 'done') {
          destination.complete();
        }
      },
      flush
        ? () => {
            const emission = flush(state, index);
            if (emission.kind === 'one') {
              destination.next(emission.value);
            }
            destination.complete();
          }
        : undefined
    );

    return subscribeOperator(source, operatorSubscriber);
  });
