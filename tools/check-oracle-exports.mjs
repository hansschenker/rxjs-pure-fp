import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const file = 'reference/exports.json';
if (!fs.existsSync(file)) {
  throw new Error(`${file} is missing. Run npm run oracle:exports and commit the result.`);
}

// Compared modulo line endings: a checkout may carry CRLF while the snapshot
// tool always writes LF.
const normalize = (text) => text.replace(/\r\n/g, '\n');

const before = fs.readFileSync(file, 'utf8');
const run = spawnSync(process.execPath, ['tools/snapshot-rxjs-exports.mjs'], { encoding: 'utf8' });
if (run.status !== 0) {
  process.stderr.write(run.stderr);
  process.exit(run.status ?? 1);
}
const after = fs.readFileSync(file, 'utf8');
if (normalize(before) !== normalize(after)) {
  console.error('Committed RxJS 7.8.2 export manifest is stale.');
  process.exit(1);
}
// Leave the checkout's bytes untouched when only line endings differed.
if (before !== after) {
  fs.writeFileSync(file, before);
}
console.log('Committed RxJS 7.8.2 export manifest matches the pinned oracle.');
