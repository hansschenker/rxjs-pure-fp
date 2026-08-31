import { executeSource } from '../observable.ts';
import { operate, type MonoTypeOperatorFunction } from '../operator.ts';

/**
 * Registers `callback` on the subscriber after the source is connected, so it
 * runs exactly once after the source's own teardown — on completion, error,
 * or unsubscription.
 */
export const finalize = <T>(callback: () => void): MonoTypeOperatorFunction<T> =>
  operate((source, destination) => {
    try {
      executeSource(source, destination);
    } finally {
      destination.add(callback);
    }
    return undefined;
  });
