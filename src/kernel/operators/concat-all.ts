import type { ObservableInput } from '../interop.ts';
import type { OperatorFunction } from '../operator.ts';
import { mergeAll } from './merge-all.ts';

/** Policy algebra, exactly as in RxJS: concatenation is merge at concurrency one. */
export const concatAll = <T>(): OperatorFunction<ObservableInput<T>, T> => mergeAll(1);
