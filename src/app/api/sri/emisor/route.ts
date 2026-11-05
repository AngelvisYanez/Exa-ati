import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAuth } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import { getUserRuc } from '@/services/sri-api/user-resolver';

const MAX_LOGO_BYTES = 800 * 1024;

const empresaSchema = z.object({
  nombreComercial: z.string().trim().max(300, 'El nombre comercial es demasiado largo'),
  direccion: z.string().trim().max(500, 'La dirección es demasiado larga'),
});

function detectImage(bytes: Buffer): 'image/png' | 'image/jpeg' | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user, req);

    const emisor = await db.queryOne<any>(
      `SELECT id, ruc, razon_social, nombre_comercial, ambiente, tipo_contribuyente,
              cert_valido_hasta, certificado_valido_hasta, clave_sri_encrypted
       FROM emisores WHERE ruc = ? AND activo = true`,
      [userRuc]
    );

    if (!emisor) {
      return NextResponse.json(
        { message: 'Emisor no encontrado para este RUC' },
        { status: 404 }
      );
    }

    const expiryDate = emisor.certificado_valido_hasta || emisor.cert_valido_hasta || null;
    const tieneCredenciales = Boolean(emisor.clave_sri_encrypted);

    return NextResponse.json({
      success: true,
      emisor: {
        id: emisor.id,
        ruc: emisor.ruc,
        razonSocial: emisor.razon_social,
        nombreComercial: emisor.nombre_comercial,
        tipoContribuyente: emisor.tipo_contribuyente || null,
        ambiente: emisor.ambiente,
        certificadoExpiracion: expiryDate,
        tieneCredenciales,
      }
    });
  } catch (error: any) {
    console.error('[Get Emisor Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user, req);
    const form = await req.formData();
    const parsed = empresaSchema.safeParse({
      nombreComercial: String(form.get('nombreComercial') ?? ''),
      direccion: String(form.get('direccion') ?? ''),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 }
      );
    }

    const quitarLogo = form.get('quitarLogo') === '1';
    const file = form.get('logo');
    let logoAction: 'keep' | 'set' | 'clear' = quitarLogo ? 'clear' : 'keep';
    let logoBytes: Buffer | null = null;
    let logoMime: string | null = null;

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_LOGO_BYTES) {
        return NextResponse.json({ message: 'El logo debe pesar menos de 800 KB' }, { status: 400 });
      }
      logoBytes = Buffer.from(await file.arrayBuffer());
      logoMime = detectImage(logoBytes);
      if (!logoMime) {
        return NextResponse.json({ message: 'El logo debe ser PNG o JPG' }, { status: 400 });
      }
      logoAction = 'set';
    }

    const tenantId = user.tenantId;
    const existing = tenantId
      ? await db.queryOne<{ ruc: string }>(
          `SELECT ruc FROM emisores WHERE ruc = $1 AND tenant_id = $2 AND activo = true LIMIT 1`,
          [userRuc, tenantId]
        )
      : await db.queryOne<{ ruc: string }>(
          `SELECT ruc FROM emisores WHERE ruc = $1 AND activo = true LIMIT 1`,
          [userRuc]
        );
    if (!existing) {
      return NextResponse.json({ message: 'Emisor no encontrado para este RUC' }, { status: 404 });
    }

    const nombre = parsed.data.nombreComercial || null;
    const direccion = parsed.data.direccion || null;
    const where = tenantId
      ? { sql: 'ruc = $X AND tenant_id = $Y AND activo = true', params: [userRuc, tenantId] }
      : { sql: 'ruc = $X AND activo = true', params: [userRuc] };

    if (logoAction === 'set') {
      const params = [nombre, direccion, logoBytes, logoMime, ...where.params];
      const rucIdx = 5;
      const tenantSql = tenantId
        ? `ruc = $${rucIdx} AND tenant_id = $${rucIdx + 1} AND activo = true`
        : `ruc = $${rucIdx} AND activo = true`;
      await db.query(
        `UPDATE emisores SET
           nombre_comercial = $1,
           dir_matriz = $2,
           direccion_matriz = $2,
           logo = $3,
           logo_mime = $4,
           updated_at = NOW()
         WHERE ${tenantSql}`,
        params
      );
    } else if (logoAction === 'clear') {
      const params = [nombre, direccion, ...where.params];
      const rucIdx = 3;
      const tenantSql = tenantId
        ? `ruc = $${rucIdx} AND tenant_id = $${rucIdx + 1} AND activo = true`
        : `ruc = $${rucIdx} AND activo = true`;
      await db.query(
        `UPDATE emisores SET
           nombre_comercial = $1,
           dir_matriz = $2,
           direccion_matriz = $2,
           logo = NULL,
           logo_mime = NULL,
           updated_at = NOW()
         WHERE ${tenantSql}`,
        params
      );
    } else {
      const params = [nombre, direccion, ...where.params];
      const rucIdx = 3;
      const tenantSql = tenantId
        ? `ruc = $${rucIdx} AND tenant_id = $${rucIdx + 1} AND activo = true`
        : `ruc = $${rucIdx} AND activo = true`;
      await db.query(
        `UPDATE emisores SET
           nombre_comercial = $1,
           dir_matriz = $2,
           direccion_matriz = $2,
           updated_at = NOW()
         WHERE ${tenantSql}`,
        params
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Patch Emisor Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
