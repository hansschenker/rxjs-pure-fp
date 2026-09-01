import fs from 'node:fs';
import path from 'node:path';
import ts from '@typescript/typescript6';

import {
  CJS_INTEROP_ARTIFACTS,
  IMPLEMENTED_SUBPATHS,
  fileNames,
  importedNames,
  readPackageJson,
  requiredNames,
} from './export-names.mjs';

/**
 * M19 package-parity gate. The built package must have RxJS 7.8.2's shape —
 * the same export-map conditions in the same order, CommonJS for Node and
 * `require`, ES modules for bundlers, declarations for every entry — and the
 * three views of each entry (Node import, CommonJS require, ESM file) must
 * agree on the export names, with the declaration file naming exactly the
 * runtime's value exports.
 */
const failures = [];
const fail = (message) => failures.push(message);
const same = (label, actual, expected) => {
  const missing = expected.filter((name) => !actual.includes(name));
  const extra = actual.filter((name) => !expected.includes(name));
  if (missing.length || extra.length) {
    fail(`${label}: missing [${missing.join(', ')}] extra [${extra.join(', ')}]`);
  }
};

const pkg = readPackageJson();
const conditions = ['types', 'node', 'require', 'es2015', 'default'];

for (const field of ['main', 'module', 'es2015', 'types']) {
  if (typeof pkg[field] !== 'string' || !fs.existsSync(pkg[field])) {
    fail(`package.json "${field}" must point at a built file`);
  }
}
if (pkg.sideEffects !== false) {
  fail('package.json "sideEffects" must be false');
}
if (pkg.exports?.['./package.json'] !== './package.json') {
  fail('package.json exports must expose "./package.json"');
}

const declaredValueExports = (declarationFile) => {
  const program = ts.createProgram([path.resolve(declarationFile)], {
    module: ts.ModuleKind.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    strict: true,
    skipLibCheck: false,
    noEmit: true,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) {
    for (const diagnostic of diagnostics.slice(0, 5)) {
      fail(`${declarationFile}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
    }
  }
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(path.resolve(declarationFile));
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  return checker
    .getExportsOfModule(moduleSymbol)
    .filter((symbol) => {
      const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      return (resolved.flags & ts.SymbolFlags.Value) !== 0;
    })
    .map((symbol) => symbol.name)
    .sort();
};

for (const [subpath, specifier] of Object.entries(IMPLEMENTED_SUBPATHS)) {
  const entry = pkg.exports?.[subpath];
  if (!entry || typeof entry !== 'object') {
    fail(`package.json exports must map ${subpath}`);
    continue;
  }
  if (JSON.stringify(Object.keys(entry)) !== JSON.stringify(conditions)) {
    fail(`${subpath}: export conditions must be ${conditions.join(', ')} in that order`);
  }
  for (const [condition, file] of Object.entries(entry)) {
    if (!fs.existsSync(file)) {
      fail(`${subpath} ${condition}: ${file} does not exist`);
    }
  }
  if (entry.node !== entry.require || !entry.node?.includes('/cjs/')) {
    fail(`${subpath}: node and require must both resolve to the CommonJS build`);
  }
  if (entry.es2015 !== entry.default || !entry.default?.includes('/esm/')) {
    fail(`${subpath}: es2015 and default must both resolve to the ES module build`);
  }
  if (!entry.types?.endsWith('.d.ts')) {
    fail(`${subpath}: types must resolve to a declaration file`);
  }

  const nodeView = await importedNames(specifier);
  const requireView = requiredNames(specifier);
  const esmView = await fileNames(entry.default);
  const withArtifacts = [...new Set([...esmView, ...CJS_INTEROP_ARTIFACTS])].sort();

  same(`${subpath} Node import view vs ESM build + interop artifacts`, nodeView, withArtifacts);
  same(`${subpath} require view vs ESM build`, requireView, esmView);
  same(`${subpath} declarations vs ESM build`, declaredValueExports(entry.types), esmView);
  console.log(`${subpath}: ${esmView.length} exports agree across import, require, ESM file, and declarations.`);
}

if (failures.length) {
  console.error('Package parity gate failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Package parity gate passed.');
