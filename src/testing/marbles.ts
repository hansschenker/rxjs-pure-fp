import { isColdObservable } from './cold-observable.ts';
import {
  completeTestNotification,
  createSubscriptionLog,
  createTestMessage,
  errorTestNotification,
  nextTestNotification,
  type SubscriptionLog,
  type TestMessage,
  type TestNotification,
} from './test-message.ts';

/**
 * M21: RxJS's marble parsers (`TestScheduler.parseMarbles` and
 * `parseMarblesAsSubscriptions`) as pure functions of the diagram, the mode,
 * and the frame time factor — the statics on the `TestScheduler` factory
 * read the live factor and pass it in. Diagrams are spread into code points
 * so emoji marbles are single characters, as in RxJS.
 */

const TIME_PROGRESSION = /^([0-9]+(?:\.[0-9]+)?)(ms|s|m) /;

const durationInMillis = (duration: number, unit: string): number =>
  unit === 'ms' ? duration : unit === 's' ? duration * 1000 : duration * 1000 * 60;

/**
 * Run-mode time progression (`10ms `, `1.5s `, `2m `) starting at
 * `characters[i]`: the frames it spans and the characters it consumes, or
 * null when none starts there. A progression must be preceded by a space
 * unless it opens the diagram.
 */
const timeProgressionAt = (
  characters: string[],
  i: number,
  frameTimeFactor: number
): { readonly frames: number; readonly length: number } | null => {
  const c = characters[i] as string;
  if (!/^[0-9]$/.test(c) || !(i === 0 || characters[i - 1] === ' ')) {
    return null;
  }
  const match = TIME_PROGRESSION.exec(characters.slice(i).join(''));
  if (!match) {
    return null;
  }
  return {
    frames: durationInMillis(parseFloat(match[1] as string), match[2] as string) / frameTimeFactor,
    length: match[0].length,
  };
};

export const parseMarbles = (
  marbles: string,
  values: unknown,
  errorValue: unknown,
  materializeInnerObservables: boolean,
  runMode: boolean,
  frameTimeFactor: number
): TestMessage[] => {
  if (marbles.indexOf('!') !== -1) {
    throw new Error('conventional marble diagrams cannot have the unsubscription marker "!"');
  }
  const characters = [...marbles];
  const len = characters.length;
  const testMessages: TestMessage[] = [];
  const subIndex = runMode ? marbles.replace(/^[ ]+/, '').indexOf('^') : marbles.indexOf('^');
  let frame = subIndex === -1 ? 0 : subIndex * -frameTimeFactor;
  const getValue =
    typeof values !== 'object'
      ? (x: string): unknown => x
      : (x: string): unknown => {
          const value = (values as Record<string, unknown>)[x];
          // Support Observable-of-Observables
          if (materializeInnerObservables && isColdObservable(value)) {
            return value.messages;
          }
          return value;
        };
  let groupStart = -1;

  for (let i = 0; i < len; i++) {
    let nextFrame = frame;
    const advanceFrameBy = (count: number): void => {
      nextFrame += count * frameTimeFactor;
    };

    let notification: TestNotification<unknown> | undefined;
    const c = characters[i] as string;
    switch (c) {
      case ' ':
        // Whitespace no longer advances time in run mode
        if (!runMode) {
          advanceFrameBy(1);
        }
        break;
      case '-':
        advanceFrameBy(1);
        break;
      case '(':
        groupStart = frame;
        advanceFrameBy(1);
        break;
      case ')':
        groupStart = -1;
        advanceFrameBy(1);
        break;
      case '|':
        notification = completeTestNotification();
        advanceFrameBy(1);
        break;
      case '^':
        advanceFrameBy(1);
        break;
      case '#':
        notification = errorTestNotification(errorValue || 'error');
        advanceFrameBy(1);
        break;
      default: {
        // Might be time progression syntax, or a value literal
        const progression = runMode ? timeProgressionAt(characters, i, frameTimeFactor) : null;
        if (progression) {
          i += progression.length - 1;
          advanceFrameBy(progression.frames);
          break;
        }
        notification = nextTestNotification(getValue(c));
        advanceFrameBy(1);
        break;
      }
    }

    if (notification) {
      testMessages.push(createTestMessage(groupStart > -1 ? groupStart : frame, notification));
    }

    frame = nextFrame;
  }
  return testMessages;
};

export const parseMarblesAsSubscriptions = (
  marbles: string | null | undefined,
  runMode: boolean,
  frameTimeFactor: number
): SubscriptionLog => {
  if (typeof marbles !== 'string') {
    return createSubscriptionLog(Infinity);
  }
  const characters = [...marbles];
  const len = characters.length;
  let groupStart = -1;
  let subscriptionFrame = Infinity;
  let unsubscriptionFrame = Infinity;
  let frame = 0;

  for (let i = 0; i < len; i++) {
    let nextFrame = frame;
    const advanceFrameBy = (count: number): void => {
      nextFrame += count * frameTimeFactor;
    };
    const c = characters[i] as string;
    switch (c) {
      case ' ':
        // Whitespace no longer advances time in run mode
        if (!runMode) {
          advanceFrameBy(1);
        }
        break;
      case '-':
        advanceFrameBy(1);
        break;
      case '(':
        groupStart = frame;
        advanceFrameBy(1);
        break;
      case ')':
        groupStart = -1;
        advanceFrameBy(1);
        break;
      case '^':
        if (subscriptionFrame !== Infinity) {
          throw new Error(
            "found a second subscription point '^' in a subscription marble diagram. There can only be one."
          );
        }
        subscriptionFrame = groupStart > -1 ? groupStart : frame;
        advanceFrameBy(1);
        break;
      case '!':
        if (unsubscriptionFrame !== Infinity) {
          throw new Error(
            "found a second unsubscription point '!' in a subscription marble diagram. There can only be one."
          );
        }
        unsubscriptionFrame = groupStart > -1 ? groupStart : frame;
        break;
      default: {
        // time progression syntax
        const progression = runMode ? timeProgressionAt(characters, i, frameTimeFactor) : null;
        if (progression) {
          i += progression.length - 1;
          advanceFrameBy(progression.frames);
          break;
        }
        throw new Error(
          "there can only be '^' and '!' markers in a subscription marble diagram. Found instead '" + c + "'."
        );
      }
    }

    frame = nextFrame;
  }

  if (unsubscriptionFrame < 0) {
    return createSubscriptionLog(subscriptionFrame);
  }
  return createSubscriptionLog(subscriptionFrame, unsubscriptionFrame);
};
