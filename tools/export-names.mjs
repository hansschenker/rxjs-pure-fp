import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/**
 * Shared export-name plumbing for the parity and package tools. The oracle
 * manifest was captured by importing `rxjs` through Node, which resolves the
 * package's `node` export condition to its CommonJS build; every measurement
 * of this package goes through the same door so both sides carry the same
 * interop artifacts (`__esModule`, `default`).
 */

/** Names Node itself adds to a CommonJS namespace on newer versions — never package exports. */
export const NODE_INTEROP_NAMES = new Set(['module.exports']);

/** The CommonJS interop artifacts RxJS's package shape exposes to Node importers. */
export const CJS_INTEROP_ARTIFACTS = ['__esModule', 'default'];

export const PACKAGE_NAME = 'rxjs-pure-fp';

/** Subpaths this package provides, mapped to the oracle's subpath keys. */
export const IMPLEMENTED_SUBPATHS = {
  '.': PACKAGE_NAME,
  './operators': `${PACKAGE_NAME}/operators`,
};

/** Oracle subpaths outside the root-export mission (separate feature surfaces). */
export const OUT_OF_SCOPE_SUBPATHS = ['./ajax', './fetch', './testing', './webSocket'];

export const readManifest = () => {
  const manifestPath = path.resolve('reference/exports.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('reference/exports.json is missing. Run npm run oracle:exports first.');
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
};

export const readFunctionalExports = () => {
  const functionalExportsPath = path.resolve('reference/functional-exports.json');
  return fs.existsSync(functionalExportsPath)
    ? JSON.parse(fs.readFileSync(functionalExportsPath, 'utf8')).root
    : [];
};

const sortedNames = (namespace) =>
  Object.keys(namespace)
    .filter((name) => !NODE_INTEROP_NAMES.has(name))
    .sort();

/** Node's view of a specifier: `import()` through the package's export map. */
export const importedNames = async (specifier) => sortedNames(await import(specifier));

/** The CommonJS view: `require()` through the package's export map. */
export const requiredNames = (specifier) => {
  const require = createRequire(pathToFileURL(path.resolve('package.json')).href);
  return sortedNames(require(specifier));
};

/** A built file's own namespace, bypassing the export map. */
export const fileNames = async (relativePath) =>
  sortedNames(await import(pathToFileURL(path.resolve(relativePath)).href));

export const readPackageJson = () => JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
