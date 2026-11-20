/** Build a deterministic, secret-free Windows source package for the SRI connector. */
import fs from 'node:fs';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../..');
const output = path.join(root, 'assets', 'connector', 'conector-sri-windows.zip');
const entry = 'scripts/connector/sri-local.ts';
const files = new Set([
  'package.json', 'package-lock.json', 'tsconfig.json', 'prisma/schema.prisma',
  entry,
  'scripts/connector/distribution/Panel.ps1',
  'scripts/connector/distribution/Setup.ps1',
  'scripts/connector/distribution/Instalar-Conector.ps1',
  'scripts/connector/distribution/Iniciar-Conector.ps1',
  'scripts/connector/distribution/Instalar-Conector.cmd',
  'scripts/connector/distribution/Iniciar-Conector.cmd',
  'scripts/connector/distribution/LEEME.txt',
]);

function resolveLocal(from, specifier) {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null;
  const base = specifier.startsWith('@/')
    ? path.join(root, 'src', specifier.slice(2))
    : path.resolve(root, path.dirname(from), specifier);
  const candidates = [base, ...['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'].map((ext) => base + ext),
    ...['index.ts', 'index.tsx', 'index.js'].map((name) => path.join(base, name))];
  const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!found) throw new Error(`Importación local no resuelta: ${from} -> ${specifier}`);
  const relative = path.relative(root, found).replaceAll('\\', '/');
  if (relative.startsWith('../') || path.isAbsolute(relative)) throw new Error(`Ruta fuera del proyecto: ${found}`);
  return relative;
}

const queue = [entry];
while (queue.length) {
  const relative = queue.pop();
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const imports = ts.preProcessFile(source, true, true).importedFiles.map((item) => item.fileName);
  for (const match of source.matchAll(/\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    imports.push(match[1]);
  }
  for (const specifier of imports) {
    const resolved = resolveLocal(relative, specifier);
    if (resolved && !files.has(resolved)) {
      files.add(resolved);
      queue.push(resolved);
    }
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [relative, bytes] of entries) {
    const name = Buffer.from(relative, 'utf8');
    const compressed = deflateRawSync(bytes, { level: 9 });
    const checksum = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // DEFLATE
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, compressed);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x0800, 8);
    directory.writeUInt16LE(8, 10);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(bytes.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}

const archive = zip([...files].sort().map((relative) => [relative, fs.readFileSync(path.join(root, relative))]));
if (process.argv.includes('--check')) {
  const current = fs.existsSync(output) ? fs.readFileSync(output) : null;
  if (!current || !current.equals(archive)) {
    console.error('El ZIP del conector está desactualizado. Ejecute npm run connector:package.');
    process.exitCode = 1;
  } else {
    console.log(`Paquete verificado: ${files.size} archivos, ${archive.length} bytes.`);
  }
} else {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, archive);
  console.log(`Paquete creado: ${files.size} archivos, ${archive.length} bytes en ${output}`);
}
