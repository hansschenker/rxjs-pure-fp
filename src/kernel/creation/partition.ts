import { innerFrom, type ObservableInput } from '../interop.ts';
import type { Observable } from '../observable.ts';
import { filter } from '../operators/filter.ts';

/**
 * Splits one source into `[matches, rest]` as two independent `filter`ed
 * subscriptions over the same source — RxJS 7.8.2's own construction
 * (`filter(predicate)` / `filter(not(predicate))`). Each half runs its own
 * source execution with its own index sequence; sharing requires an explicit
 * sharing topology upstream. The deprecated `thisArg` binding is compat
 * surface (`src/compat/collection.ts`).
 */
export const partition = <T>(
  source: ObservableInput<T>,
  predicate: (value: T, index: number) => boolean
): [Observable<T>, Observable<T>] => {
  const converted = innerFrom(source);
  return [
    filter<T>(predicate)(converted),
    filter<T>((value, index) => !predicate(value, index))(converted),
  ];
};
