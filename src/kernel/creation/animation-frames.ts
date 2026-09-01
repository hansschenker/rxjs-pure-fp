import { createObservable, type Observable } from '../observable.ts';
import { timerHost, type FrameHandle } from '../runtime.ts';
import type { TimestampProvider } from '../scheduler.ts';

export type AnimationFrame = {
  /** The frame callback's timestamp, or the provider's clock when one is given. */
  readonly timestamp: number;
  /** Milliseconds since subscription on the provider's clock. */
  readonly elapsed: number;
};

/** RxJS `performanceTimestampProvider` without the test delegate hook. */
const performanceTimestampProvider: TimestampProvider = Object.freeze({
  now: () => timerHost.performanceNow(),
});

const animationFramesFactory = (timestampProvider?: TimestampProvider): Observable<AnimationFrame> =>
  createObservable((subscriber) => {
    const provider = timestampProvider ?? performanceTimestampProvider;
    const start = provider.now();
    let handle: FrameHandle | null = null;
    const run = (): void => {
      if (!subscriber.closed) {
        handle = timerHost.requestFrame((frameTime) => {
          handle = null;
          const now = provider.now();
          subscriber.next({
            timestamp: timestampProvider ? now : frameTime,
            elapsed: now - start,
          });
          run();
        });
      }
    };
    run();
    return () => {
      if (handle !== null) {
        timerHost.cancelFrame(handle);
      }
    };
  });

const DEFAULT_ANIMATION_FRAMES = animationFramesFactory();

/**
 * M18: one emission per animation frame until unsubscribed, riding the
 * runtime's frame edge. Without a timestamp provider the same shared
 * Observable is returned every call (RxJS reference identity); with one, a
 * fresh Observable whose `timestamp` is the provider's clock.
 */
export const animationFrames = (timestampProvider?: TimestampProvider): Observable<AnimationFrame> =>
  timestampProvider ? animationFramesFactory(timestampProvider) : DEFAULT_ANIMATION_FRAMES;
