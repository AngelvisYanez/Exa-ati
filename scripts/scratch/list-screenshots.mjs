import fs from 'fs';
import path from 'path';

const dir = 'downloads';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));

for (const f of files) {
  const stat = fs.statSync(path.join(dir, f));
  console.log(`${f}: size = ${stat.size}, modified = ${stat.mtime.toISOString()}`);
}
