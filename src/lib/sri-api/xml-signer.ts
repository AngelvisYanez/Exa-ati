import * as forge from 'node-forge';
import { Crypto } from '@peculiar/webcrypto';
import * as xadesjs from 'xadesjs';
import * as xmlCore from 'xml-core';
import { DOMParser, XMLSerializer } from 'xmldom';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { db } from './db';
import { encryption } from './encryption';
import { config } from './config';

// Configurar dependencias de Node para xadesjs
xmlCore.setNodeDependencies({
  DOMParser,
  XMLSerializer,
});

const webCrypto = new Crypto();
xadesjs.Application.setEngine('NodeJS', webCrypto);

interface EmisorCertificado {
  certificado_p12: Buffer | null;
  password_certificado: string | null;
  certificado_nombre?: string | null;
  certificado_password_encrypted?: string | null;
}

const emisorCertificateCache: Map<
  string,
  { privateKey: CryptoKey; certificate: string; loadedAt: number }
> = new Map();

const CERT_CACHE_TTL_MS = 3600000; // 1h

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
    .replace(/-----END RSA PRIVATE KEY-----/, '')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binaryDer = Buffer.from(pemContents, 'base64');

  try {
    return await webCrypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-1',
      },
      true,
      ['sign']
    );
  } catch {
    console.log('[Signer] conversion fallback PKCS#1 to PKCS#8');
    const privateKey = forge.pki.privateKeyFromPem(pem);
    const pkcs8Pem = forge.pki.privateKeyInfoToPem(
      forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(privateKey))
    );

    const pkcs8Contents = pkcs8Pem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '');

    const pkcs8Binary = Buffer.from(pkcs8Contents, 'base64');

    return await webCrypto.subtle.importKey(
      'pkcs8',
      pkcs8Binary,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-1',
      },
      true,
      ['sign']
    );
  }
}

export const xmlSigner = {
  async loadEmisorCertificate(
    ruc: string
  ): Promise<{ privateKey: CryptoKey; certificate: string }> {
    const cached = emisorCertificateCache.get(ruc);
    const now = Date.now();
    if (cached && now - cached.loadedAt < CERT_CACHE_TTL_MS) {
      return { privateKey: cached.privateKey, certificate: cached.certificate };
    }

    if (cached) {
      emisorCertificateCache.delete(ruc);
    }

    console.log(`[Signer] Loading certificate for emisor RUC: ${ruc}`);

    const emisor = await db.queryOne<EmisorCertificado>(
      `SELECT certificado_p12, password_certificado,
              certificado_nombre, certificado_password_encrypted
       FROM emisores
       WHERE ruc = ? AND activo = 1`,
      [ruc]
    );

    if (!emisor) {
      throw new Error(`El emisor con RUC ${ruc} no fue encontrado o está inactivo.`);
    }

    let p12Buffer: Buffer | null = null;
    let password = '';

    if (emisor.certificado_p12) {
      p12Buffer = Buffer.isBuffer(emisor.certificado_p12)
        ? emisor.certificado_p12
        : Buffer.from(emisor.certificado_p12 as unknown as ArrayBuffer);
    }

    if (emisor.password_certificado) {
      try {
        password = await encryption.decrypt(emisor.password_certificado);
      } catch {
        password = emisor.password_certificado;
      }
    } else if (emisor.certificado_password_encrypted) {
      password = await encryption.decrypt(emisor.certificado_password_encrypted);
    }

    if (!p12Buffer && emisor.certificado_nombre) {
      const certsDir = config.directories.certs;
      const certPath = join(certsDir, emisor.certificado_nombre);
      const resolvedPath = resolve(certPath);
      const certsBaseDir = resolve(certsDir);
      if (resolvedPath.startsWith(certsBaseDir) && existsSync(resolvedPath)) {
        p12Buffer = readFileSync(resolvedPath);
      }
    }

    if (!p12Buffer) {
      const fallbackPath = join(config.directories.certs, `${ruc}.p12`);
      if (existsSync(fallbackPath)) {
        p12Buffer = readFileSync(fallbackPath);
      }
    }

    if (!p12Buffer || !password) {
      throw new Error(
        `El emisor con RUC ${ruc} no tiene certificado digital .p12 configurado.`
      );
    }

    const p12Der = forge.util.createBuffer(p12Buffer.toString('binary'));
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    let forgePrivateKey: forge.pki.PrivateKey | null = null;
    let signingCert: forge.pki.Certificate | null = null;

    p12.safeContents.forEach((safeContent) => {
      safeContent.safeBags.forEach((safeBag) => {
        if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
          forgePrivateKey = safeBag.key as forge.pki.PrivateKey;
        } else if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
          const cert = safeBag.cert;
          const isCA =
            cert.extensions &&
            cert.extensions.some(
              (ext: any) => ext.name === 'basicConstraints' && ext.cA === true
            );

          if (!isCA) {
            signingCert = cert;
          }
        }
      });
    });

    if (!forgePrivateKey || !signingCert) {
      throw new Error(
        'No se encontró clave privada o certificado en el archivo P12'
      );
    }

    const privateKeyPem = forge.pki.privateKeyToPem(forgePrivateKey);
    const privateKey = await importPrivateKey(privateKeyPem);

    const certificate = forge.util.encode64(
      forge.asn1.toDer(forge.pki.certificateToAsn1(signingCert)).getBytes()
    );

    const result = { privateKey, certificate, loadedAt: Date.now() };
    emisorCertificateCache.set(ruc, result);
    return result;
  },

  async signXmlForEmisor(xmlString: string, ruc: string): Promise<string> {
    console.log(`[Signer] Signing XML for emisor RUC: ${ruc}`);

    const { privateKey, certificate } = await this.loadEmisorCertificate(ruc);

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

    const rootElement = xmlDoc.documentElement;
    if (!rootElement) {
      throw new Error('El documento XML no tiene un elemento raíz');
    }

    if (!rootElement.hasAttribute('id') && !rootElement.hasAttribute('Id')) {
      rootElement.setAttribute('Id', 'comprobante');
    }

    const referenceId =
      rootElement.getAttribute('id') ||
      rootElement.getAttribute('Id') ||
      'comprobante';

    const signedXml = new xadesjs.SignedXml();

    const reference = await signedXml.Sign(
      {
        name: 'RSA-SHA1',
      },
      privateKey,
      xmlDoc,
      {
        x509: [certificate],
        references: [
          {
            id: 'Reference-' + referenceId,
            uri: '#' + referenceId,
            hash: 'SHA-1',
            transforms: ['enveloped', 'c14n'],
          },
        ],
        signerRole: {
          claimed: ['Emisor'],
        },
        signingTime: {
          value: new Date(),
        },
      }
    );

    const signedXmlDoc = reference.GetXml();
    if (!signedXmlDoc) {
      throw new Error('Error al generar el XML firmado');
    }

    rootElement.appendChild(signedXmlDoc);

    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
  },

  clearEmisorCache(ruc: string): void {
    emisorCertificateCache.delete(ruc);
  },

  clearAllCache(): void {
    emisorCertificateCache.clear();
  }
};
