import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('M00 pins the RxJS behavioral oracle', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.devDependencies.rxjs, '7.8.2');
});

test('M00 keeps the runtime implementation independent from the ES3 reference', () => {
  const source = fs.readFileSync('src/index.ts', 'utf8');
  assert.equal(source.includes('reference/rxjs-7.8.2-es3'), false);
});
