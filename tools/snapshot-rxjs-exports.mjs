import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('rxjs/package.json');

if (pkg.version !== '7.8.2') {
  throw new Error(`Expected rxjs@7.8.2, found ${pkg.version}`);
}

const subpaths = {
  '.': 'rxjs',
  './ajax': 'rxjs/ajax',
  './fetch': 'rxjs/fetch',
  './operators': 'rxjs/operators',
  './testing': 'rxjs/testing',
  './webSocket': 'rxjs/webSocket'
};

const exportsBySubpath = {};
for (const [subpath, specifier] of Object.entries(subpaths)) {
  const module = await import(specifier);
  exportsBySubpath[subpath] = Object.keys(module).sort();
}

const manifest = {
  package: 'rxjs',
  version: pkg.version,
  generatedBy: 'tools/snapshot-rxjs-exports.mjs',
  exports: exportsBySubpath
};

fs.mkdirSync('reference', { recursive: true });
fs.writeFileSync('reference/exports.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Captured RxJS ${pkg.version} exports across ${Object.keys(subpaths).length} public subpaths.`);
