import { JwtPayload } from './auth-helper';
import { db } from './db';

const RUC_PATTERN = /^\d{13}$/;

export async function getUserRuc(user: JwtPayload): Promise<string> {
  if (user.tenantId) {
    const emisor = await db.queryOne<{ ruc: string }>(
      `SELECT ruc FROM emisores WHERE tenant_id = ? AND activo = 1 LIMIT 1`,
      [user.tenantId]
    );
    if (emisor?.ruc) return emisor.ruc;

    const tenant = await db.queryOne<{ ruc: string }>(
      `SELECT ruc FROM tenants WHERE id = ? AND activo = 1`,
      [user.tenantId]
    );
    if (tenant?.ruc && RUC_PATTERN.test(tenant.ruc)) return tenant.ruc;
  }

  if (RUC_PATTERN.test(user.email)) {
    const emisor = await db.queryOne<{ ruc: string }>(
      `SELECT ruc FROM emisores WHERE ruc = ? AND activo = 1 LIMIT 1`,
      [user.email]
    );
    if (emisor?.ruc) return emisor.ruc;
    return user.email;
  }

  throw new Error('No se encontró un emisor vinculado a tu cuenta. Vincula tu RUC del SRI.');
}

export async function hasEmisorLinked(user: JwtPayload): Promise<boolean> {
  try {
    await getUserRuc(user);
    return true;
  } catch {
    return false;
  }
}

export function isValidRuc(ruc: string): boolean {
  return RUC_PATTERN.test(ruc);
}
