import fs from 'node:fs';
import path from 'node:path';

const roots = ['src', 'test', 'tools'];
const extensions = new Set(['.ts', '.mjs']);
const failures = [];

for (const root of roots) {
  for (const file of walk(root)) {
    if (!extensions.has(path.extname(file))) continue;
    const source = fs.readFileSync(file, 'utf8');
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      if (/[ \t]+$/.test(line)) failures.push(`${file}:${index + 1} trailing whitespace`);
    });
    if (source.length && !source.endsWith('\n')) failures.push(`${file}: missing final newline`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Repository lint checks passed.');

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
