import assert from 'node:assert/strict';
import test from 'node:test';

import { subscribe } from '../../src/compat/observable.ts';
import { of } from '../../src/kernel/creation/of.ts';
import { throwError } from '../../src/kernel/creation/throw-error.ts';
import { catchError } from '../../src/kernel/operators/catch-error.ts';
import { finalize } from '../../src/kernel/operators/finalize.ts';
import { pipeValue } from '../../src/kernel/pipe.ts';
import { repeat } from '../../src/kernel/operators/repeat.ts';
import { retry } from '../../src/kernel/operators/retry.ts';

const collect = (source) => {
  const events = [];
  subscribe({
    next: (value) => events.push(value),
    error: (error) => events.push(`error:${error.message}`),
    complete: () => events.push('complete'),
  })(source);
  return events;
};

test('M12 operator algebra: retry(0) is identity, repeat(0) is empty', () => {
  const source = of(1);
  assert.equal(retry(0)(source), source);
  assert.deepEqual(collect(repeat(0)(source)), ['complete']);
});

test('M12 catchError + finalize compose: recovery still finalizes once', () => {
  const finalized = [];
  const events = collect(
    pipeValue(
      throwError(new Error('boom')),
      catchError(() => of('recovered')),
      finalize(() => finalized.push('done'))
    )
  );
  assert.deepEqual(events, ['recovered', 'complete']);
  assert.deepEqual(finalized, ['done']);
});
