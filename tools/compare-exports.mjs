import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const manifestPath = path.resolve('reference/exports.json');
if (!fs.existsSync(manifestPath)) {
  throw new Error('reference/exports.json is missing. Run npm run oracle:exports first.');
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const expected = manifest.exports['.'];
const builtPath = path.resolve('dist/esm/index.js');
const actualModule = await import(pathToFileURL(builtPath).href);
const actual = Object.keys(actualModule).sort();

const expectedSet = new Set(expected);
const actualSet = new Set(actual);
const implemented = expected.filter((name) => actualSet.has(name));
const missing = expected.filter((name) => !actualSet.has(name));
const unexpected = actual.filter((name) => !expectedSet.has(name));
const coverage = expected.length === 0 ? 100 : (implemented.length / expected.length) * 100;

console.log(`Root export parity: ${implemented.length}/${expected.length} (${coverage.toFixed(1)}%)`);
console.log(`Missing root exports: ${missing.length}`);
console.log(`Unexpected root exports: ${unexpected.length}`);

if (unexpected.length) {
  console.error(`Unexpected exports: ${unexpected.join(', ')}`);
  process.exit(1);
}
