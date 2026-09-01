import { createEmptyError } from '../kernel/errors.ts';
import type { Observable } from '../kernel/observable.ts';
import { subscribe } from './observable.ts';
import { createSafeSubscriber } from './sink.ts';

export type FirstValueFromConfig<T> = {
  readonly defaultValue: T;
};

export type LastValueFromConfig<T> = {
  readonly defaultValue: T;
};

/**
 * Resolves with the first emitted value and unsubscribes (RxJS uses a safe
 * subscriber here so the early unsubscribe is a proper consumer boundary);
 * empty sources reject with `EmptyError` unless a `defaultValue` config is
 * given. Observable semantics stay primary — this is a consumption edge, not
 * a replacement (AGENTS rule 14).
 */
export function firstValueFrom<T, D>(source: Observable<T>, config: FirstValueFromConfig<D>): Promise<T | D>;
export function firstValueFrom<T>(source: Observable<T>): Promise<T>;
export function firstValueFrom<T, D>(
  source: Observable<T>,
  config?: FirstValueFromConfig<D>
): Promise<T | D> {
  const hasConfig = typeof config === 'object';
  return new Promise<T | D>((resolve, reject) => {
    const subscriber = createSafeSubscriber<T>({
      next: (value) => {
        resolve(value);
        subscriber.unsubscribe();
      },
      error: reject,
      complete: () => {
        if (hasConfig) {
          resolve((config as FirstValueFromConfig<D>).defaultValue);
        } else {
          reject(createEmptyError());
        }
      },
    });
    subscribe(subscriber)(source);
  });
}

/**
 * Resolves with the final value on completion; empty sources reject with
 * `EmptyError` unless a `defaultValue` config is given.
 */
export function lastValueFrom<T, D>(source: Observable<T>, config: LastValueFromConfig<D>): Promise<T | D>;
export function lastValueFrom<T>(source: Observable<T>): Promise<T>;
export function lastValueFrom<T, D>(
  source: Observable<T>,
  config?: LastValueFromConfig<D>
): Promise<T | D> {
  const hasConfig = typeof config === 'object';
  return new Promise<T | D>((resolve, reject) => {
    let hasValue = false;
    let lastValue: T | undefined;
    subscribe<T>({
      next: (value) => {
        lastValue = value;
        hasValue = true;
      },
      error: reject,
      complete: () => {
        if (hasValue) {
          resolve(lastValue as T);
        } else if (hasConfig) {
          resolve((config as LastValueFromConfig<D>).defaultValue);
        } else {
          reject(createEmptyError());
        }
      },
    })(source);
  });
}
