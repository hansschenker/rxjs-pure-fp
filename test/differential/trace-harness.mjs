export function traceRxjsObservable(observable) {
  const trace = [];
  trace.push({ type: 'subscribe' });

  const subscription = observable.subscribe({
    next(value) {
      trace.push({ type: 'next', value });
    },
    error(error) {
      trace.push({ type: 'error', error: normalizeError(error) });
    },
    complete() {
      trace.push({ type: 'complete' });
    }
  });

  return {
    trace,
    unsubscribe() {
      if (!subscription.closed) {
        subscription.unsubscribe();
        trace.push({ type: 'unsubscribe' });
      }
    }
  };
}

function normalizeError(error) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return error;
}
