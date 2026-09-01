import fs from 'node:fs';
import path from 'node:path';
import ts from '@typescript/typescript6';

const sourceRoot = path.resolve('src');
const allowedConstructors = new Set([
  'AbortController', 'AggregateError', 'Array', 'ArrayBuffer', 'DataView', 'Date',
  'Error', 'EvalError', 'Map', 'Promise', 'RangeError', 'ReferenceError', 'RegExp', 'Set',
  'SharedArrayBuffer', 'SyntaxError', 'TypeError', 'URIError', 'URL', 'URLSearchParams',
  'WeakMap', 'WeakSet', 'WebSocket'
]);

const kernelRoot = path.join(sourceRoot, 'kernel') + path.sep;
const files = walk(sourceRoot).filter((file) => file.endsWith('.ts'));
const violations = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const inKernel = file.startsWith(kernelRoot);

  visit(sourceFile, (node) => {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      report(file, sourceFile, node, 'class architecture is forbidden');
    }

    if (node.kind === ts.SyntaxKind.SuperKeyword) {
      report(file, sourceFile, node, 'super is forbidden');
    }

    if (ts.isHeritageClause(node) && node.token === ts.SyntaxKind.ExtendsKeyword) {
      report(file, sourceFile, node, 'extends inheritance is forbidden');
    }

    if (ts.isPropertyAccessExpression(node) && node.name.text === 'prototype') {
      report(file, sourceFile, node, 'prototype manipulation is forbidden');
    }

    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      if (!allowedConstructors.has(name)) {
        report(file, sourceFile, node, `project-defined constructor architecture is forbidden: new ${name}(...)`);
      }
    }

    // F1/F4 kernel purity rules (docs/FP-ROADMAP.md).
    if (inKernel) {
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'Object' &&
        (node.name.text === 'defineProperty' || node.name.text === 'defineProperties')
      ) {
        report(file, sourceFile, node, 'kernel purity: Object.defineProperty/defineProperties is forbidden');
      }

      if (node.kind === ts.SyntaxKind.ThisKeyword) {
        report(file, sourceFile, node, 'kernel purity: this is forbidden');
      }

      if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.name.text === 'this') {
        report(file, sourceFile, node, 'kernel purity: this-parameter types are forbidden');
      }

      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Reflect') {
        report(file, sourceFile, node, 'kernel purity: Reflect is forbidden');
      }

      if (
        ts.isVariableStatement(node) &&
        ts.isSourceFile(node.parent) &&
        !(node.declarationList.flags & ts.NodeFlags.Const)
      ) {
        report(file, sourceFile, node, 'kernel purity: module-scope let/var is forbidden');
      }

      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text.includes('/compat/')
      ) {
        report(file, sourceFile, node, 'kernel purity: kernel must not import compat');
      }

      // F7: method-syntax type members are bivariant; property syntax gets
      // full strictFunctionTypes variance checking.
      if (ts.isMethodSignature(node)) {
        report(file, sourceFile, node, 'kernel purity: method-syntax type members are forbidden (use property syntax)');
      }

      // F6: host timers are the deferral edge owned by runtime.ts; everything
      // else must go through a RuntimeEnv's `defer`.
      if (
        path.basename(file) !== 'runtime.ts' &&
        ts.isIdentifier(node) &&
        ['setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask'].includes(node.text)
      ) {
        report(file, sourceFile, node, 'kernel purity: host timer access is forbidden outside runtime.ts');
      }
    }
  });
}

if (violations.length) {
  console.error('Functional architecture gate failed:\n');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Architecture gate passed for ${files.length} TypeScript source file(s).`);

function report(file, sourceFile, node, message) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  violations.push(`${path.relative(process.cwd(), file)}:${position.line + 1}:${position.character + 1} ${message}`);
}

function visit(node, inspect) {
  inspect(node);
  node.forEachChild((child) => visit(child, inspect));
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
