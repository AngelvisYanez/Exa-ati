import fs from 'fs';
import path from 'path';

const xmlDir = 'downloads/XML';
const files = fs.readdirSync(xmlDir).filter(f => f.startsWith('03062026'));

for (const f of files) {
  const stat = fs.statSync(path.join(xmlDir, f));
  console.log(`${f}: created at ${stat.birthtime.toISOString()}, modified at ${stat.mtime.toISOString()}`);
}
