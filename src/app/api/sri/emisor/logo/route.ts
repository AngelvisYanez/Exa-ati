import { NextResponse } from 'next/server';
import { verifyAuth } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import { getUserRuc } from '@/services/sri-api/user-resolver';

function asBuffer(value: unknown): Buffer | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string' && value.startsWith('\\x')) {
    const hex = value.slice(2);
    if (/^[0-9a-fA-F]+$/.test(hex)) return Buffer.from(hex, 'hex');
  }
  if (typeof value === 'object' && value !== null && 'data' in value && Array.isArray((value as { data: unknown }).data)) {
    return Buffer.from((value as { data: number[] }).data);
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user, req);
    const row = user.tenantId
      ? await db.queryOne<{ logo: unknown; logo_mime: string | null }>(
          `SELECT logo, logo_mime FROM emisores WHERE ruc = $1 AND tenant_id = $2 AND activo = true LIMIT 1`,
          [userRuc, user.tenantId]
        )
      : await db.queryOne<{ logo: unknown; logo_mime: string | null }>(
          `SELECT logo, logo_mime FROM emisores WHERE ruc = $1 AND activo = true LIMIT 1`,
          [userRuc]
        );
    const logo = asBuffer(row?.logo);
    const mime = row?.logo_mime === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    if (!logo || !row?.logo_mime) {
      return new NextResponse(null, { status: 404 });
    }
    return new NextResponse(new Uint8Array(logo), {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error: any) {
    const status = error.message?.startsWith('No autorizado') ? 401 : 500;
    return NextResponse.json({ message: error.message || 'Error al obtener el logo' }, { status });
  }
}
