import assert from 'node:assert/strict';
import test from 'node:test';
import { of } from 'rxjs';
import { traceRxjsObservable } from './trace-harness.mjs';

test('M00 differential harness captures synchronous RxJS notification order', () => {
  const run = traceRxjsObservable(of(1, 2, 3));
  assert.deepEqual(run.trace, [
    { type: 'subscribe' },
    { type: 'next', value: 1 },
    { type: 'next', value: 2 },
    { type: 'next', value: 3 },
    { type: 'complete' }
  ]);
});
