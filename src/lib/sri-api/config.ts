import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

export function resolveDir(pathStr: string): string {
  if (pathStr.startsWith('/') || pathStr.includes(':')) {
    return pathStr;
  }
  // Se asume que el frontend corre en /frontend, por lo que resolvemos desde la raíz del workspace
  // si es necesario, o desde process.cwd()
  return resolve(process.cwd(), pathStr);
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'sri-jwt-secret-key-32bytes-long-now',
    expiration: process.env.JWT_EXPIRATION || '24h',
  },
  encryptionKey: process.env.ENCRYPTION_KEY || '12345678901234567890123456789012',
  encryptionSalt: process.env.ENCRYPTION_SALT || 'sri-salt-1234',
  sri: {
    environment: process.env.SRI_ENVIRONMENT || 'development',
    wsdl: {
      reception: process.env.SRI_RECEPTION_WSDL || 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
      authorization: process.env.SRI_AUTHORIZATION_WSDL || 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl',
    }
  },
  directories: {
    get templates(): string {
      const dir = resolveDir(process.env.TEMPLATES_DIR || '../backend/templates');
      ensureDir(dir);
      return dir;
    },
    get pdfs(): string {
      const dir = resolveDir(process.env.PDFS_DIR || '../backend/pdfs');
      ensureDir(dir);
      return dir;
    },
    get certs(): string {
      const dir = resolveDir(process.env.CERTS_DIR || '../backend/certs');
      ensureDir(dir);
      return dir;
    },
    get xmls(): string {
      const dir = resolveDir(process.env.XMLS_DIR || '../backend/xmls');
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
