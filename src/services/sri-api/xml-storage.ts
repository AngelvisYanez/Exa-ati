import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { config } from './config';

export const xmlStorage = {
  getBaseDir(): string {
    const base = config.directories.xmls;
    if (!existsSync(base)) {
      mkdirSync(base, { recursive: true });
    }
    return base;
  },

  getComprobantePath(ruc: string, fecha: Date): string {
    const base = this.getBaseDir();
    const year = fecha.getFullYear().toString();
    const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
    return join(base, ruc, year, month);
  },

  ensureDirectoryExists(dirPath: string): void {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
  },

  saveXml(
    ruc: string,
    claveAcceso: string,
    fechaEmision: Date,
    tipo: 'sin_firma' | 'firmado' | 'autorizado',
    xmlContent: string
  ): string {
    const subdirMap: Record<string, string> = {
      sin_firma: 'sin_firmar',
      firmado: 'firmados',
      autorizado: 'autorizados',
    };
    const subdir = subdirMap[tipo] || tipo;

    const baseDirPath = this.getComprobantePath(ruc, fechaEmision);
    const dirPath = join(baseDirPath, subdir);
    this.ensureDirectoryExists(dirPath);

    const filename = `${claveAcceso}.xml`;
    const fullPath = join(dirPath, filename);
    const year = fechaEmision.getFullYear().toString();
    const month = (fechaEmision.getMonth() + 1).toString().padStart(2, '0');
    const relativePath = join(ruc, year, month, subdir, filename);

    writeFileSync(fullPath, xmlContent, 'utf-8');
    console.log(`[Storage] XML guardado: ${relativePath}`);

    return relativePath;
  },

  saveAllXmls(
    ruc: string,
    claveAcceso: string,
    fechaEmision: Date,
    xmlSinFirma?: string,
    xmlFirmado?: string,
    xmlAutorizado?: string
  ): { sinFirmaPath?: string; firmadoPath?: string; autorizadoPath?: string } {
    const paths: {
      sinFirmaPath?: string;
      firmadoPath?: string;
      autorizadoPath?: string;
    } = {};

    if (xmlSinFirma) {
      paths.sinFirmaPath = this.saveXml(
        ruc,
        claveAcceso,
        fechaEmision,
        'sin_firma',
        xmlSinFirma
      );
    }
    if (xmlFirmado) {
      paths.firmadoPath = this.saveXml(
        ruc,
        claveAcceso,
        fechaEmision,
        'firmado',
        xmlFirmado
      );
    }
    if (xmlAutorizado) {
      paths.autorizadoPath = this.saveXml(
        ruc,
        claveAcceso,
        fechaEmision,
        'autorizado',
        xmlAutorizado
      );
    }

    return paths;
  },

  readXml(relativePath: string): string | null {
    const base = this.getBaseDir();
    const fullPath = join(base, relativePath);
    if (existsSync(fullPath)) {
      return readFileSync(fullPath, 'utf-8');
    }
    return null;
  },

  getFullPath(relativePath: string): string {
    const base = this.getBaseDir();
    return join(base, relativePath);
  }
};
