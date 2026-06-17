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
   * Encripta un texto plano usando AES-256-CBC.
   * @param plainText - Texto a encriptar
   * @returns Texto encriptado en formato "iv_hex:encrypted_hex"
   */
  async encrypt(plainText: string): Promise<string> {
    const iv = randomBytes(16);
    const key = await deriveKey();
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
  },

  /**
   * Desencripta un texto encriptado con AES-256-CBC.
   * @param encryptedText - Texto en formato "iv_hex:encrypted_hex"
   * @returns Texto plano original
   */
  async decrypt(encryptedText: string): Promise<string> {
    const [ivHex, encryptedHex] = encryptedText.split(':');

    if (!ivHex || !encryptedHex) {
      throw new Error(
        'Formato de texto encriptado inválido. Se esperaba "iv:encrypted"'
      );
    }

    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const key = await deriveKey();
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
};
