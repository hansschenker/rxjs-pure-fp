import {
  createOperatorSubscriber,
  operate,
  subscribeOperator,
  type OperatorFunction,
} from '../operator.ts';

const removeBuffer = <T>(buffers: T[][], buffer: T[]): void => {
  const at = buffers.indexOf(buffer);
  if (at >= 0) {
    buffers.splice(at, 1);
  }
};

/**
 * Emits arrays of `bufferSize` values. With `startBufferEvery`, a new buffer
 * opens every that many values, so buffers may overlap (or values may be
 * skipped when it exceeds `bufferSize`). Completion flushes every open buffer
 * in opening order.
 */
export const bufferCount = <T>(
  bufferSize: number,
  startBufferEvery: number | null = null
): OperatorFunction<T, T[]> => {
  const startEvery = startBufferEvery ?? bufferSize;
  return operate((source, destination) => {
    let buffers: T[][] | null = [];
    let count = 0;

    subscribeOperator(
      source,
      createOperatorSubscriber<T, T[]>(
        destination,
        (value) => {
          let toEmit: T[][] | null = null;
          if (count++ % startEvery === 0) {
            buffers?.push([]);
          }
          for (const currentBuffer of buffers ?? []) {
            currentBuffer.push(value);
            if (bufferSize <= currentBuffer.length) {
              (toEmit ??= []).push(currentBuffer);
            }
          }
          if (toEmit && buffers) {
            for (const filled of toEmit) {
              removeBuffer(buffers, filled);
              destination.next(filled);
            }
          }
        },
        () => {
          for (const remaining of buffers ?? []) {
            destination.next(remaining);
          }
          destination.complete();
        },
        undefined,
        () => {
          buffers = null;
        }
      )
    );

    return undefined;
  });
};
