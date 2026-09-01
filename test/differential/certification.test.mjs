import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ArgumentOutOfRangeError as RxArgumentOutOfRangeError,
  EmptyError as RxEmptyError,
  NotFoundError as RxNotFoundError,
  ObjectUnsubscribedError as RxObjectUnsubscribedError,
  SequenceError as RxSequenceError,
  TimeoutError as RxTimeoutError,
  UnsubscriptionError as RxUnsubscriptionError,
  asap as rxAsapAlias,
  asapScheduler as rxAsapScheduler,
  async as rxAsyncAlias,
  asyncScheduler as rxAsyncScheduler,
  identity as rxIdentity,
  noop as rxNoop,
  queue as rxQueueAlias,
  queueScheduler as rxQueueScheduler,
} from 'rxjs';
import {
  ArgumentOutOfRangeError,
  EmptyError,
  NotFoundError,
  ObjectUnsubscribedError,
  SequenceError,
  TimeoutError,
} from '../../src/compat/errors.ts';
import { UnsubscriptionError } from '../../src/compat/subscription.ts';
import { identity, noop } from '../../src/kernel/pipe.ts';
import { asapScheduler, asyncScheduler, queueScheduler } from '../../src/kernel/scheduler.ts';

/**
 * M20 certification of the root names no behavioral suite needs to import
 * from the oracle: the error factories' identities and messages, the
 * scheduler alias names, and the two utility functions.
 */
const adapters = {
  rxjs: {
    argumentOutOfRange: () => new RxArgumentOutOfRangeError(),
    empty: () => new RxEmptyError(),
    notFound: (message) => new RxNotFoundError(message),
    objectUnsubscribed: () => new RxObjectUnsubscribedError(),
    sequence: (message) => new RxSequenceError(message),
    timeout: (info) => (info === undefined ? new RxTimeoutError() : new RxTimeoutError(info)),
    unsubscription: (errors) => new RxUnsubscriptionError(errors),
    aliases: {
      asap: rxAsapAlias === rxAsapScheduler,
      async: rxAsyncAlias === rxAsyncScheduler,
      queue: rxQueueAlias === rxQueueScheduler,
      schedule: [rxAsapAlias, rxAsyncAlias, rxQueueAlias].map((s) => typeof s.schedule),
      now: [rxAsapAlias, rxAsyncAlias, rxQueueAlias].map((s) => typeof s.now()),
    },
    identity: rxIdentity,
    noop: rxNoop,
  },
  pureFp: {
    argumentOutOfRange: () => ArgumentOutOfRangeError(),
    empty: () => EmptyError(),
    notFound: (message) => NotFoundError(message),
    objectUnsubscribed: () => ObjectUnsubscribedError(),
    sequence: (message) => SequenceError(message),
    timeout: (info) => (info === undefined ? TimeoutError() : TimeoutError(info)),
    unsubscription: (errors) => UnsubscriptionError(errors),
    aliases: {
      asap: true,
      async: true,
      queue: true,
      schedule: [asapScheduler, asyncScheduler, queueScheduler].map((s) => typeof s.schedule),
      now: [asapScheduler, asyncScheduler, queueScheduler].map((s) => typeof s.now()),
    },
    identity,
    noop,
  },
};

const describeError = (error) => ({
  name: error.name,
  message: error.message,
  isError: error instanceof Error,
});

const errorIdentitiesTrace = (adapter) => {
  const info = { meta: 'm', seen: 2, lastValue: 'v' };
  const timeout = adapter.timeout(info);
  const unsubscription = adapter.unsubscription([new Error('first'), new Error('second')]);
  return {
    argumentOutOfRange: describeError(adapter.argumentOutOfRange()),
    empty: describeError(adapter.empty()),
    notFound: describeError(adapter.notFound('No matching values')),
    objectUnsubscribed: describeError(adapter.objectUnsubscribed()),
    sequence: describeError(adapter.sequence('Too many matching values')),
    timeout: { ...describeError(timeout), info: timeout.info, infoIdentity: timeout.info === info },
    timeoutDefault: adapter.timeout().info,
    unsubscription: {
      ...describeError(unsubscription),
      errors: unsubscription.errors.map((error) => error.message),
    },
  };
};

const utilitiesTrace = (adapter) => {
  const token = { token: true };
  return {
    aliases: adapter.aliases,
    identity: [adapter.identity(token) === token, adapter.identity(3), adapter.identity.length],
    noop: [adapter.noop(), adapter.noop('ignored'), adapter.noop.length],
  };
};

for (const [name, trace] of Object.entries({ errorIdentitiesTrace, utilitiesTrace })) {
  test(`M20 ${name} matches RxJS 7.8.2`, () => {
    assert.deepEqual(trace(adapters.pureFp), trace(adapters.rxjs));
  });
}
