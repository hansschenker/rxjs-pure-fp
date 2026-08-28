import fs from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

const sourceRoot = path.resolve('src');
const allowedConstructors = new Set([
  'AbortController', 'AggregateError', 'Array', 'ArrayBuffer', 'DataView', 'Date',
  'Error', 'EvalError', 'Map', 'RangeError', 'ReferenceError', 'RegExp', 'Set',
  'SharedArrayBuffer', 'SyntaxError', 'TypeError', 'URIError', 'URL', 'URLSearchParams',
  'WeakMap', 'WeakSet', 'WebSocket'
]);

const files = walk(sourceRoot).filter((file) => file.endsWith('.ts'));
const violations = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

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
