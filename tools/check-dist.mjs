import fs from 'node:fs';
import path from 'node:path';

const jsFiles = walk('dist').filter((file) => /\.(?:js|cjs|mjs)$/.test(file));
const forbidden = [
  ['class declaration/expression', /(^|[;{}\s])class\s+[A-Za-z_$]/m],
  ['prototype mutation', /\.prototype\s*[.=\[]/]
];
const failures = [];

for (const file of jsFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const [label, pattern] of forbidden) {
    if (pattern.test(source)) failures.push(`${file}: ${label}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Distribution architecture check passed for ${jsFiles.length} JavaScript file(s).`);

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
