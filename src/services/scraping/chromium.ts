import path from 'path';
import fs from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import { createBrotliDecompress } from 'zlib';

const OUT_DIR = () => path.join(process.cwd(), 'tmp', 'bin');
const BINARY_PATH = () => path.join(OUT_DIR(), 'chromium');

function candidateBinDirs(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, 'node_modules', '@sparticuz', 'chromium', 'bin'),
    path.join(cwd, '.next', 'standalone', 'node_modules', '@sparticuz', 'chromium', 'bin'),
    path.join(cwd, 'standalone', 'node_modules', '@sparticuz', 'chromium', 'bin'),
    path.join(cwd, '.next', 'server', 'node_modules', '@sparticuz', 'chromium', 'bin'),
  ];
}

function findBinDir(): string | undefined {
  for (const dir of candidateBinDirs()) {
    if (fs.existsSync(path.join(dir, 'chromium.br'))) return dir;
  }
  try {
    const pkg = require.resolve('@sparticuz/chromium/package.json');
    const dir = path.join(path.dirname(pkg), 'bin');
    if (fs.existsSync(path.join(dir, 'chromium.br'))) return dir;
  } catch {}
  return undefined;
}

function brotliToFile(src: string, dest: string, mode: number): Promise<void> {
  return new Promise((resolve, reject) => {
    createReadStream(src)
      .pipe(createBrotliDecompress())
      .pipe(createWriteStream(dest, { mode }))
      .on('close', resolve)
      .on('error', reject);
  });
}

function untarToDir(buffer: Buffer, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true });
  let offset = 0;
  let pendingName: string | null = null;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    offset += 512;

    const type = String.fromCharCode(header[156] || 0x30);
    const size = parseInt(header.subarray(124, 136).toString('utf8').replace(/\0[\s\S]*$/, '').trim() || '0', 8) || 0;
    const data = buffer.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;

    if (type === 'L' || type === 'K') {
      pendingName = data.toString('utf8').replace(/\0[\s\S]*$/, '');
      continue;
    }
    if (type === 'x' || type === 'g') {
      const txt = data.toString('utf8');
      const m = txt.match(/path=([^\n]+)/);
      if (m) pendingName = m[1];
      continue;
    }

    let name = header.subarray(0, 100).toString('utf8').replace(/\0[\s\S]*$/, '');
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0[\s\S]*$/, '');
    if (prefix) name = `${prefix}/${name}`;
    if (pendingName) {
      name = pendingName;
      pendingName = null;
    }

    const clean = name.replace(/^\.\/+/, '').replace(/\/+$/, '');
    if (!clean || clean.includes('..')) continue;
    const full = path.join(destDir, ...clean.split('/'));
    const fileMode = parseInt(header.subarray(100, 108).toString('utf8').replace(/\0[\s\S]*$/, '').trim() || '644', 8) || 0o644;

    if (type === '5' || clean.endsWith('/')) {
      fs.mkdirSync(full, { recursive: true });
    } else if (data.length > 0) {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, data, { mode: fileMode & 0o777 });
    }
  }
}

async function extractTarBr(src: string, destDir: string): Promise<void> {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const dec = createBrotliDecompress();
    createReadStream(src)
      .pipe(dec)
      .on('data', (d: Buffer) => chunks.push(d))
      .on('end', resolve)
      .on('error', reject);
  });
  untarToDir(Buffer.concat(chunks), destDir);
}

function ensureExecutable(filePath: string): void {
  try {
    fs.chmodSync(filePath, 0o755);
  } catch {}
}

/**
 * Prepara el binario de Chromium de @sparticuz/chromium en un directorio
 * ejecutable dentro de la app. En cPanel/shared hosting el /tmp suele estar
 * montado con `noexec`, y @sparticuz/chromium siempre extrae a /tmp y devuelve
 * /tmp/chromium -> EACCES al lanzarlo. Aquí extraemos a `process.cwd()/tmp/bin`.
 */
export async function getChromiumExecutablePath(): Promise<string | undefined> {
  // En Windows OS, @sparticuz/chromium (binario Linux ELF) no es ejecutable nativamente.
  // Se debe usar la instalación de Chromium/Chrome/Edge propia del sistema o Playwright.
  if (process.platform === 'win32') {
    if (process.env.CHROMIUM_EXECUTABLE_PATH && fs.existsSync(process.env.CHROMIUM_EXECUTABLE_PATH)) {
      return process.env.CHROMIUM_EXECUTABLE_PATH;
    }
    return undefined;
  }

  const outDir = OUT_DIR();
  const binaryPath = BINARY_PATH();
  try {
    fs.mkdirSync(outDir, { recursive: true });

    if (fs.existsSync(binaryPath)) {
      ensureExecutable(binaryPath);
      return binaryPath;
    }

    const binDir = findBinDir();
    if (!binDir) {
      console.log('[chromium] no se encontró el directorio bin de @sparticuz/chromium');
      return undefined;
    }

    await brotliToFile(path.join(binDir, 'chromium.br'), binaryPath, 0o755);

    const swiftshader = path.join(binDir, 'swiftshader.tar.br');
    if (fs.existsSync(swiftshader)) {
      try {
        await extractTarBr(swiftshader, outDir);
        for (const lib of ['libEGL.so', 'libGLESv2.so', 'libvk_swiftshader.so', 'libvulkan.so.1']) {
          ensureExecutable(path.join(outDir, lib));
        }
      } catch (e: any) {
        console.log('[chromium] swiftshader no extraído:', e?.message || e);
      }
    }

    const fonts = path.join(binDir, 'fonts.tar.br');
    if (fs.existsSync(fonts)) {
      try {
        await extractTarBr(fonts, path.join(outDir, 'fonts'));
      } catch (e: any) {
        console.log('[chromium] fonts no extraído:', e?.message || e);
      }
    }

    ensureExecutable(binaryPath);
    return fs.existsSync(binaryPath) ? binaryPath : undefined;
  } catch (e: any) {
    console.log('[chromium] error preparando binario:', e?.message || e);
    return undefined;
  }
}
