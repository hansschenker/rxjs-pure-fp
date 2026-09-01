import fs from 'node:fs';
import { createRequire } from 'node:module';

import { NODE_INTEROP_NAMES } from './export-names.mjs';

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

// Node resolves `rxjs` through its `node` export condition to the CommonJS
// build, so the namespace carries the CJS interop artifacts `__esModule` and
// `default` — part of the package shape RxJS ships, kept in the manifest.
// Newer Node versions add a `module.exports` name to such namespaces; that
// one belongs to Node, not to the package, and is excluded.
const exportsBySubpath = {};
for (const [subpath, specifier] of Object.entries(subpaths)) {
  const module = await import(specifier);
  exportsBySubpath[subpath] = Object.keys(module)
    .filter((name) => !NODE_INTEROP_NAMES.has(name))
    .sort();
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
