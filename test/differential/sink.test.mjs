import assert from 'node:assert/strict';
import test from 'node:test';

import { Subscriber as RxSubscriber, config as rxConfig } from 'rxjs';
import { config as pureConfig } from '../../src/core/config.ts';
import { Subscriber, createSubscriber } from '../../src/core/sink.ts';

const adapters = {
  rxjs: {
    config: rxConfig,
    raw(destination) {
      return new RxSubscriber(destination);
    },
    safe(next, error, complete) {
      return RxSubscriber.create(next, error, complete);
    },
  },
  pureFp: {
    config: pureConfig,
    raw(destination) {
      return createSubscriber(destination);
    },
    safe(next, error, complete) {
      return Subscriber.create(next, error, complete);
    },
  },
};

const notificationTrace = ({ raw }) => {
  const events = [];
  const subscriber = raw({
    next(value) {
      events.push(`next:${value}`);
    },
    error(error) {
      events.push(`error:${error.message}`);
    },
    complete() {
      events.push('complete');
    },
  });

  subscriber.add(() => events.push('teardown'));
  subscriber.next(1);
  subscriber.next(2);
  subscriber.complete();
  subscriber.next(3);
  subscriber.error(new Error('late'));
  subscriber.complete();

  return {
    events,
    closed: subscriber.closed,
    isStopped: subscriber.isStopped,
  };
};

const directUnsubscribeTrace = ({ raw }) => {
  const events = [];
  const subscriber = raw({
    next(value) {
      events.push(`next:${value}`);
    },
    error(error) {
      events.push(`error:${error.message}`);
    },
    complete() {
      events.push('complete');
    },
  });
  subscriber.add(() => events.push('teardown'));

  subscriber.unsubscribe();
  subscriber.next(1);
  subscriber.error(new Error('ignored'));
  subscriber.complete();
  subscriber.unsubscribe();

  return {
    events,
    closed: subscriber.closed,
    isStopped: subscriber.isStopped,
  };
};

const destinationChainTrace = ({ raw }) => {
  const events = [];
  const parent = raw({
    next(value) {
      events.push(`parent-next:${value}`);
    },
    error(error) {
      events.push(`parent-error:${error.message}`);
    },
    complete() {
      events.push('parent-complete');
    },
  });
  const child = raw(parent);

  child.next('before');
  parent.unsubscribe();
  child.next('after');

  return {
    events,
    parentClosed: parent.closed,
    parentStopped: parent.isStopped,
    childClosed: child.closed,
    childStopped: child.isStopped,
  };
};

const rawNextThrowTrace = ({ raw }) => {
  const expected = new Error('next-handler');
  const subscriber = raw({
    next() {
      throw expected;
    },
    error() {},
    complete() {},
  });

  let caught = null;
  try {
    subscriber.next(1);
  } catch (error) {
    caught = error.message;
  }

  const stateAfterThrow = {
    closed: subscriber.closed,
    isStopped: subscriber.isStopped,
  };
  subscriber.unsubscribe();

  return {
    caught,
    stateAfterThrow,
    closedFinally: subscriber.closed,
    stoppedFinally: subscriber.isStopped,
  };
};

const rawErrorThrowTrace = ({ raw }) => {
  const events = [];
  const expected = new Error('error-handler');
  const subscriber = raw({
    next() {},
    error() {
      events.push('error-handler');
      throw expected;
    },
    complete() {},
  });
  subscriber.add(() => events.push('teardown'));

  let caught = null;
  try {
    subscriber.error(new Error('source'));
  } catch (error) {
    caught = error.message;
  }

  return {
    caught,
    events,
    closed: subscriber.closed,
    isStopped: subscriber.isStopped,
  };
};

const safeCallbackTrace = ({ safe }) => {
  const events = [];
  const subscriber = safe(
    (value) => events.push(`next:${value}`),
    (error) => events.push(`error:${error.message}`),
    () => events.push('complete')
  );
  subscriber.add(() => events.push('teardown'));

  subscriber.next(1);
  subscriber.complete();
  subscriber.next(2);

  return {
    events,
    closed: subscriber.closed,
    isStopped: subscriber.isStopped,
  };
};

const safeHandlerErrorTrace = async ({ safe, config }) => {
  const previous = config.onUnhandledError;
  const events = [];
  const expected = new Error('safe-next-handler');

  try {
    let resolveReported;
    const reported = new Promise((resolve) => {
      resolveReported = resolve;
    });
    config.onUnhandledError = (error) => {
      events.push(`reported:${error.message}`);
      resolveReported();
    };

    const subscriber = safe(() => {
      events.push('next-handler');
      throw expected;
    });

    subscriber.next(1);
    const stateAfterNext = {
      closed: subscriber.closed,
      isStopped: subscriber.isStopped,
    };

    await reported;
    subscriber.unsubscribe();

    return {
      events,
      stateAfterNext,
      closedFinally: subscriber.closed,
      stoppedFinally: subscriber.isStopped,
    };
  } finally {
    config.onUnhandledError = previous;
  }
};

const missingErrorHandlerTrace = async ({ safe, config }) => {
  const previous = config.onUnhandledError;
  const events = [];

  try {
    let resolveReported;
    const reported = new Promise((resolve) => {
      resolveReported = resolve;
    });
    config.onUnhandledError = (error) => {
      events.push(`reported:${error.message}`);
      resolveReported();
    };

    const subscriber = safe();
    subscriber.error(new Error('source-error'));
    const stateImmediately = {
      closed: subscriber.closed,
      isStopped: subscriber.isStopped,
    };

    await reported;

    return {
      events,
      stateImmediately,
      closedFinally: subscriber.closed,
      stoppedFinally: subscriber.isStopped,
    };
  } finally {
    config.onUnhandledError = previous;
  }
};

const stoppedNotificationTrace = async ({ raw, config }) => {
  const previous = config.onStoppedNotification;
  const events = [];

  try {
    let count = 0;
    let resolveReported;
    const reported = new Promise((resolve) => {
      resolveReported = resolve;
    });
    config.onStoppedNotification = (notification, subscriber) => {
      events.push({
        notification: normalizeNotification(notification),
        closed: subscriber.closed,
        isStopped: subscriber.isStopped,
      });
      count += 1;
      if (count === 3) {
        resolveReported();
      }
    };

    const subscriber = raw({
      next() {},
      error() {},
      complete() {},
    });

    subscriber.complete();
    subscriber.next('late-next');
    subscriber.error(new Error('late-error'));
    subscriber.complete();

    await reported;
    return events;
  } finally {
    config.onStoppedNotification = previous;
  }
};

const normalizeNotification = (notification) => {
  if (notification.kind === 'N') {
    return { kind: 'N', value: notification.value };
  }
  if (notification.kind === 'E') {
    return { kind: 'E', error: notification.error.message };
  }
  return { kind: 'C' };
};

for (const [name, trace] of Object.entries({
  notificationTrace,
  directUnsubscribeTrace,
  destinationChainTrace,
  rawNextThrowTrace,
  rawErrorThrowTrace,
  safeCallbackTrace,
})) {
  test(`M02 ${name} matches RxJS 7.8.2`, () => {
    assert.deepEqual(trace(adapters.pureFp), trace(adapters.rxjs));
  });
}

for (const [name, trace] of Object.entries({
  safeHandlerErrorTrace,
  missingErrorHandlerTrace,
  stoppedNotificationTrace,
})) {
  test(`M02 ${name} matches RxJS 7.8.2`, async () => {
    assert.deepEqual(await trace(adapters.pureFp), await trace(adapters.rxjs));
  });
}
