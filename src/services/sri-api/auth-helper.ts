import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { db } from './db';
import { AUTH_COOKIE } from '@/lib/auth-cookies';

export interface JwtPayload {
  sub: string;
  email: string;
  rol: string;
  tenantId: string | null;
  type?: string;
}

type IntegrationKeyEntry = {
  key: string;
  tenantId: string;
  rol?: string;
};

export function requireTenantId(user: JwtPayload): string {
  if (!user.tenantId) {
    throw new Error('Acceso denegado: El usuario no tiene tenant asignado');
  }
  return user.tenantId;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Parse EXA_INTEGRATION_API_KEYS.
 * Formats supported:
 * - JSON: [{"key":"sk_...","tenantId":"uuid","rol":"ADMIN"}]
 * - Pairs: sk_xxx=tenant-uuid;sk_yyy=other-tenant
 * - Single key + EXA_INTEGRATION_TENANT_ID
 */
export function parseIntegrationApiKeys(): IntegrationKeyEntry[] {
  const raw = process.env.EXA_INTEGRATION_API_KEYS?.trim();
  if (raw) {
    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw) as IntegrationKeyEntry[];
        return parsed.filter((e) => e?.key && e?.tenantId);
      } catch {
        console.warn('[auth] EXA_INTEGRATION_API_KEYS JSON inválido');
      }
    }
    return raw
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf('=');
        if (eq <= 0) return null;
        return {
          key: part.slice(0, eq).trim(),
          tenantId: part.slice(eq + 1).trim(),
          rol: 'ADMIN',
        };
      })
      .filter((e): e is IntegrationKeyEntry => Boolean(e?.key && e?.tenantId));
  }

  const singleKey = process.env.EXA_INTEGRATION_API_KEY?.trim();
  const singleTenant = process.env.EXA_INTEGRATION_TENANT_ID?.trim();
  if (singleKey && singleTenant) {
    return [{ key: singleKey, tenantId: singleTenant, rol: 'ADMIN' }];
  }
  return [];
}

function verifyIntegrationApiKey(req: Request | NextRequest): JwtPayload | null {
  const apiKey = req.headers.get('x-exa-api-key')?.trim();
  if (!apiKey) return null;

  const headerTenant = req.headers.get('x-exa-tenant-id')?.trim() || null;
  const entries = parseIntegrationApiKeys();
  if (entries.length === 0) {
    throw new Error('No autorizado: API key de integración no configurada en el servidor');
  }

  const match = entries.find((e) => {
    if (!safeEqual(e.key, apiKey)) return false;
    if (headerTenant && e.tenantId !== headerTenant) return false;
    return true;
  });

  if (!match) {
    throw new Error('No autorizado: API key de integración inválida');
  }

  if (headerTenant && headerTenant !== match.tenantId) {
    throw new Error('No autorizado: tenant de integración no coincide');
  }

  return {
    sub: `integration:clientry:${match.tenantId}`,
    email: 'integration@clientry.local',
    rol: match.rol || 'ADMIN',
    tenantId: match.tenantId,
    type: 'integration',
  };
}

function extractToken(req: Request | NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Fallback: httpOnly cookie (middleware / same-origin fetches)
  if ('cookies' in req && typeof req.cookies?.get === 'function') {
    const cookieToken = req.cookies.get(AUTH_COOKIE)?.value;
    if (cookieToken) return cookieToken;
  }

  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${AUTH_COOKIE}=`));
    if (match) {
      return decodeURIComponent(match.slice(AUTH_COOKIE.length + 1));
    }
  }

  return null;
}

export async function verifyAuth(req: Request | NextRequest): Promise<JwtPayload> {
  // Machine-to-machine (Clientry → Exa): X-Exa-Api-Key (+ optional X-Exa-Tenant-Id)
  if (req.headers.get('x-exa-api-key')) {
    const integration = verifyIntegrationApiKey(req);
    if (integration) return integration;
  }

  const token = extractToken(req);
  if (!token) {
    throw new Error('No autorizado: Token ausente o mal formado');
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Token inválido';
    throw new Error(`No autorizado: ${message}`);
  }

  if (payload.type === 'refresh') {
    throw new Error('No autorizado: Token de refresco no permitido para acceder a recursos');
  }

  const user = await db.queryOne<{ id: string; activo: boolean }>(
    'SELECT id, activo FROM usuarios WHERE id = $1',
    [payload.sub]
  );

  if (!user) {
    throw new Error('No autorizado: Usuario no encontrado');
  }

  if (!user.activo) {
    throw new Error('No autorizado: Usuario inactivo');
  }

  return payload;
}

/** Consistent 401 JSON for unauthorized access. */
export function unauthorizedResponse(message = 'No autorizado') {
  return Response.json({ message }, { status: 401 });
}
