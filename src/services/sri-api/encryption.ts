import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import { config } from './config';

const scryptAsync = promisify(scrypt);
let derivedKeyCache: Buffer | null = null;

async function deriveKey(): Promise<Buffer> {
  if (derivedKeyCache) {
    return derivedKeyCache;
  }

  derivedKeyCache = (await scryptAsync(
    config.encryptionKey,
    config.encryptionSalt,
    32
  )) as Buffer;

  return derivedKeyCache;
}

export const encryption = {
  /**
   * Encripta un texto plano usando AES-256-GCM (autenticado).
   * Format: "gcm:<iv_hex>:<authTag_hex>:<encrypted_hex>"
   */
  async encrypt(plainText: string): Promise<string> {
    const iv = randomBytes(12); // standard 96-bit IV for GCM
    const key = await deriveKey();
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return `gcm:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  },

  /**
   * Desencripta un texto encriptado (soporta formato GCM nuevo y CBC legacy).
   */
  async decrypt(encryptedText: string): Promise<string> {
    if (!encryptedText) return '';

    const key = await deriveKey();

    // Formato GCM: "gcm:ivHex:tagHex:encryptedHex"
    if (encryptedText.startsWith('gcm:')) {
      const parts = encryptedText.split(':');
      if (parts.length !== 4) {
        throw new Error('Formato GCM inválido. Se esperaba "gcm:iv:tag:ciphertext"');
      }
      const [, ivHex, tagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const encrypted = Buffer.from(encryptedHex, 'hex');

      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    }

    // Formato CBC Legacy: "ivHex:encryptedHex" o "cbc:ivHex:encryptedHex"
    const cleanText = encryptedText.startsWith('cbc:') ? encryptedText.slice(4) : encryptedText;
    const parts = cleanText.split(':');
    if (parts.length !== 2) {
      throw new Error('Formato de texto encriptado inválido');
    }
    const [ivHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
};
