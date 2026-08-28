import fs from 'node:fs';

fs.mkdirSync('dist/cjs', { recursive: true });
fs.writeFileSync('dist/cjs/package.json', '{"type":"commonjs"}\n');
