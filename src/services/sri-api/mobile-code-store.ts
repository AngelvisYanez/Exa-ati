import { randomBytes } from 'crypto';

const TTL_MS = 10 * 60 * 1000;

interface MobileCodeEntry {
  userId: string;
  email?: string;
  rol?: string;
  tenantId?: string;
  expiresAt: number;
}

const store = new Map<string, MobileCodeEntry>();

function purgeExpired() {
  const now = Date.now();
  for (const [code, entry] of store.entries()) {
    if (entry.expiresAt <= now) store.delete(code);
  }
}

export function createMobileCode(payload: Omit<MobileCodeEntry, 'expiresAt'>): string {
  purgeExpired();
  const code = randomBytes(16).toString('hex');
  store.set(code, { ...payload, expiresAt: Date.now() + TTL_MS });
  return code;
}

export function consumeMobileCode(code: string): MobileCodeEntry | null {
  purgeExpired();
  const entry = store.get(code);
  if (!entry || entry.expiresAt <= Date.now()) {
    store.delete(code);
    return null;
  }
  store.delete(code);
  return entry;
}
