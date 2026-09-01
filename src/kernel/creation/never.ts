import { createObservable, type Observable } from '../observable.ts';
import { noop } from '../pipe.ts';

/** Never emits and never completes; teardown-free by construction. */
export const NEVER: Observable<never> = createObservable(noop);

/** Deprecated RxJS 7.8.2 parity name: always returns the shared `NEVER`. */
export const never = (): Observable<never> => NEVER;
