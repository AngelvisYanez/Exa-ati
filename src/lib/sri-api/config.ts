import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

export function resolveDir(pathStr: string): string {
  if (pathStr.startsWith('/') || pathStr.includes(':')) {
    return pathStr;
  }
  return resolve(process.cwd(), pathStr);
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Variable de entorno requerida: ${name}`);
  }
  return val;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiration: process.env.JWT_EXPIRATION || '24h',
  },
  encryptionKey: requireEnv('ENCRYPTION_KEY'),
  encryptionSalt: requireEnv('ENCRYPTION_SALT'),
  sri: {
    environment: process.env.SRI_ENVIRONMENT || 'development',
    wsdl: {
      reception: process.env.SRI_RECEPTION_WSDL || 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
      authorization: process.env.SRI_AUTHORIZATION_WSDL || 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl',
    }
  },
  directories: {
    get templates(): string {
      const dir = resolveDir(requireEnv('TEMPLATES_DIR'));
      ensureDir(dir);
      return dir;
    },
    get pdfs(): string {
      const dir = resolveDir(requireEnv('PDFS_DIR'));
      ensureDir(dir);
      return dir;
    },
    get certs(): string {
      const dir = resolveDir(requireEnv('CERTS_DIR'));
      ensureDir(dir);
      return dir;
    },
    get xmls(): string {
      const dir = resolveDir(requireEnv('XMLS_DIR'));
      ensureDir(dir);
      return dir;
    },
    get pdfsConFirma(): string {
      const dir = resolve(this.pdfs, 'con_firma');
      ensureDir(dir);
      return dir;
    },
    get pdfsOthers(): string {
      const dir = resolve(this.pdfs, 'others');
      ensureDir(dir);
      return dir;
    },
    get pdfsDocuments(): string {
      const dir = resolve(this.pdfs, 'documents');
      ensureDir(dir);
      return dir;
    },
    get pdfsImages(): string {
      const dir = resolve(this.pdfs, 'images');
      ensureDir(dir);
      return dir;
    }
  }
};
