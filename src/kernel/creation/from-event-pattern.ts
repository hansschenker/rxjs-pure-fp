import { createObservable, type Observable } from '../observable.ts';
import { mapOneOrManyArgs } from '../operators/map.ts';
import { pipeValue } from '../pipe.ts';

/**
 * Generalized handler registration: `addHandler` is called with the emitting
 * handler on subscribe; its return value is passed back to `removeHandler` on
 * teardown. A missing removeHandler makes the subscription teardown-free.
 * Multi-argument handler calls emit the argument array; the deprecated
 * result selector maps the emission with `mapOneOrManyArgs`.
 */
export function fromEventPattern<T>(
  addHandler: (handler: (...args: unknown[]) => void) => unknown,
  removeHandler?: (handler: (...args: unknown[]) => void, signal?: unknown) => void
): Observable<T>;
export function fromEventPattern<T, R>(
  addHandler: (handler: (...args: unknown[]) => void) => unknown,
  removeHandler: ((handler: (...args: unknown[]) => void, signal?: unknown) => void) | undefined,
  resultSelector: (...args: unknown[]) => R
): Observable<R>;
export function fromEventPattern<T>(
  addHandler: (handler: (...args: unknown[]) => void) => unknown,
  removeHandler?: (handler: (...args: unknown[]) => void, signal?: unknown) => void,
  resultSelector?: (...args: unknown[]) => T
): Observable<T> {
  if (resultSelector) {
    return pipeValue(
      fromEventPattern<T>(addHandler, removeHandler),
      mapOneOrManyArgs(resultSelector)
    ) as Observable<T>;
  }

  return createObservable((subscriber) => {
    const handler = (...args: unknown[]): void => {
      subscriber.next((args.length === 1 ? args[0] : args) as T);
    };
    const retValue = addHandler(handler);
    return typeof removeHandler === 'function' ? () => removeHandler(handler, retValue) : undefined;
  });
}
