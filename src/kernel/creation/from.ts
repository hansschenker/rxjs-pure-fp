import { innerFrom, type ObservableInput } from '../interop.ts';
import type { Observable } from '../observable.ts';

/**
 * Converts any `ObservableInput` to a functional Observable (M16). A function
 * input already is an Observable and is returned unchanged, mirroring RxJS
 * returning an `instanceof Observable` input as-is. The deprecated
 * `from(input, scheduler)` overload rides `scheduled` and is deferred to the
 * remaining-scheduler-shapes milestone (M18).
 */
export const from = <T>(input: ObservableInput<T>): Observable<T> => innerFrom(input);
