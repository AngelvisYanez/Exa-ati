import { JwtPayload } from './auth-helper';
import { db } from './db';

const RUC_PATTERN = /^\d{13}$/;

export async function getUserRuc(user: JwtPayload, req?: Request | any): Promise<string> {
  // 1. Si es un usuario cliente (USER), su RUC está fijado en su perfil
  if (user.rol === 'USER') {
    const dbUser = await db.queryOne<{ ruc: string }>(
      `SELECT ruc FROM usuarios WHERE id = $1`,
      [user.sub]
    );
    if (dbUser?.ruc) return dbUser.ruc;
  }

  // 2. Si es ADMIN o SUPERADMIN y se pasa el request, revisar RUC seleccionado
  if (req) {
    let selectedRuc: string | null = null;
    try {
      if (typeof req.headers?.get === 'function') {
        selectedRuc = req.headers.get('x-selected-ruc');
      }
    } catch {}

    if (!selectedRuc) {
      try {
        const url = new URL(req.url);
        selectedRuc = url.searchParams.get('ruc');
      } catch {}
    }

    if (selectedRuc && RUC_PATTERN.test(selectedRuc)) {
      if (user.rol === 'SUPERADMIN') {
        return selectedRuc;
      }
      // Si es ADMIN, verificar que el RUC esté vinculado a su tenant
      const emisor = await db.queryOne<{ ruc: string }>(
        `SELECT ruc FROM emisores WHERE tenant_id = $1 AND ruc = $2 AND activo = true`,
        [user.tenantId, selectedRuc]
      );
      if (emisor?.ruc) return emisor.ruc;
    }
  }

  // 3. Fallback al emisor por defecto del tenant
  if (user.tenantId) {
    const emisor = await db.queryOne<{ ruc: string }>(
      `SELECT ruc FROM emisores WHERE tenant_id = $1 AND activo = true ORDER BY created_at ASC LIMIT 1`,
      [user.tenantId]
    );
    if (emisor?.ruc) return emisor.ruc;

    const tenant = await db.queryOne<{ ruc: string }>(
      `SELECT ruc FROM tenants WHERE id = $1 AND activo = true`,
      [user.tenantId]
    );
    if (tenant?.ruc && RUC_PATTERN.test(tenant.ruc)) return tenant.ruc;
  }

  if (RUC_PATTERN.test(user.email)) {
    const emisor = await db.queryOne<{ ruc: string }>(
      `SELECT ruc FROM emisores WHERE ruc = $1 AND activo = true LIMIT 1`,
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
