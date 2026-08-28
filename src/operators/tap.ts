import { createOperatorSubscriber, operate, subscribeOperator, type MonoTypeOperatorFunction } from '../core/operator.ts';

export type TapObserver<T> = {
  next?: ((value: T) => void) | undefined;
  error?: ((error: unknown) => void) | undefined;
  complete?: (() => void) | undefined;
  subscribe?: (() => void) | undefined;
  unsubscribe?: (() => void) | undefined;
  finalize?: (() => void) | undefined;
};

export function tap<T>(observerOrNext?: TapObserver<T> | ((value: T) => void)): MonoTypeOperatorFunction<T>;
export function tap<T>(
  next?: ((value: T) => void) | null,
  error?: ((error: unknown) => void) | null,
  complete?: (() => void) | null
): MonoTypeOperatorFunction<T>;
export function tap<T>(
  observerOrNext?: TapObserver<T> | ((value: T) => void) | null,
  error?: ((error: unknown) => void) | null,
  complete?: (() => void) | null
): MonoTypeOperatorFunction<T> {
  const tapObserver: TapObserver<T> | null | undefined =
    typeof observerOrNext === 'function' || error || complete
      ? {
          next: typeof observerOrNext === 'function' ? observerOrNext : undefined,
          error: error ?? undefined,
          complete: complete ?? undefined,
        }
      : observerOrNext;

  if (!tapObserver) {
    return (source) => source;
  }

  return operate((source, destination) => {
    tapObserver.subscribe?.();
    let isExplicitUnsubscribe = true;

    const operatorSubscriber = createOperatorSubscriber<T, T>(
      destination,
      (value) => {
        tapObserver.next?.(value);
        destination.next(value);
      },
      () => {
        isExplicitUnsubscribe = false;
        tapObserver.complete?.();
        destination.complete();
      },
      (sourceError) => {
        isExplicitUnsubscribe = false;
        tapObserver.error?.(sourceError);
        destination.error(sourceError);
      },
      () => {
        if (isExplicitUnsubscribe) {
          tapObserver.unsubscribe?.();
        }
        tapObserver.finalize?.();
      }
    );

    return subscribeOperator(source, operatorSubscriber);
  });
}
