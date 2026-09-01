import {
  IMPLEMENTED_SUBPATHS,
  OUT_OF_SCOPE_SUBPATHS,
  importedNames,
  readFunctionalExports,
  readManifest,
} from './export-names.mjs';

/**
 * Export parity against the pinned oracle manifest, measured the way the
 * manifest was captured: Node's `import()` of the package name through its
 * export map. Since M19 the gate is strict — every oracle name of every
 * implemented subpath must exist, and nothing outside the oracle list and the
 * declared functional extensions may appear.
 */
const manifest = readManifest();
const functionalSet = new Set(readFunctionalExports());
let failed = false;

for (const [subpath, specifier] of Object.entries(IMPLEMENTED_SUBPATHS)) {
  const expected = manifest.exports[subpath];
  if (!expected) {
    throw new Error(`Oracle manifest has no entry for subpath ${subpath}`);
  }
  const actual = await importedNames(specifier);
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const implemented = expected.filter((name) => actualSet.has(name));
  const missing = expected.filter((name) => !actualSet.has(name));
  const extensions = subpath === '.' ? actual.filter((name) => functionalSet.has(name)) : [];
  const unexpected = actual.filter(
    (name) => !expectedSet.has(name) && !(subpath === '.' && functionalSet.has(name))
  );
  const coverage = expected.length === 0 ? 100 : (implemented.length / expected.length) * 100;

  const label = subpath === '.' ? 'Root export parity' : `Subpath ${subpath} export parity`;
  console.log(`${label}: ${implemented.length}/${expected.length} (${coverage.toFixed(1)}%)`);
  console.log(`  missing: ${missing.length}${missing.length ? ` (${missing.join(', ')})` : ''}`);
  if (subpath === '.') {
    console.log(`  declared functional extensions: ${extensions.length}`);
  }
  console.log(`  unexpected: ${unexpected.length}${unexpected.length ? ` (${unexpected.join(', ')})` : ''}`);

  if (missing.length || unexpected.length) {
    failed = true;
  }
}

console.log(
  `Out-of-scope oracle subpaths (separate feature surfaces, not provided): ${OUT_OF_SCOPE_SUBPATHS.join(', ')}`
);

if (failed) {
  console.error('Export parity gate failed.');
  process.exit(1);
}
