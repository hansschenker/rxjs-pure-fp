import { innerFrom, type ObservableInput } from '../interop.ts';
import type { Observable } from '../observable.ts';
import { scheduled } from '../scheduled.ts';
import type { Scheduler } from '../scheduler.ts';

/**
 * Converts any `ObservableInput` to a functional Observable (M16). A function
 * input already is an Observable and is returned unchanged, mirroring RxJS
 * returning an `instanceof Observable` input as-is. The deprecated scheduler
 * argument (M18) routes the same conversion through `scheduled` instead.
 */
export const from = <T>(input: ObservableInput<T>, scheduler?: Scheduler): Observable<T> =>
  scheduler ? scheduled(input, scheduler) : innerFrom(input);
