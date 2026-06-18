import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { ruc } = await req.json();

    if (!ruc) {
      return NextResponse.json(
        { message: 'El RUC es requerido para desvincular.' },
        { status: 400 }
      );
    }

    // Desactivar el emisor en el tenant
    await db.query(
      `UPDATE emisores SET activo = false, updated_at = NOW()
       WHERE tenant_id = $1 AND ruc = $2 AND activo = true`,
      [tenantId, ruc]
    );

    // Si el tenant tiene este RUC como el principal, buscar otro RUC activo o poner null
    const tenant = await db.queryOne<{ ruc: string }>(
      `SELECT ruc FROM tenants WHERE id = $1`,
      [tenantId]
    );

    if (tenant?.ruc === ruc) {
      const nextEmisor = await db.queryOne<{ ruc: string }>(
        `SELECT ruc FROM emisores WHERE tenant_id = $1 AND activo = true ORDER BY created_at ASC LIMIT 1`,
        [tenantId]
      );
      await db.query(
        `UPDATE tenants SET ruc = $1, updated_at = NOW() WHERE id = $2`,
        [nextEmisor?.ruc || null, tenantId]
      );
    }

    // Auditoría
    await db.query(
      `INSERT INTO auditoria (usuario_email, tenant_id, accion, recurso, descripcion, exitoso)
       VALUES ($1, $2, 'DESVINCULAR_SRI', 'emisores', $3, true)`,
      [user.email, tenantId, `Desvinculación del RUC: ${ruc}`]
    );

    return NextResponse.json({
      success: true,
      message: 'RUC desvinculado correctamente',
    });
  } catch (error: any) {
    console.error('[Desvincular SRI Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al desvincular RUC' },
      { status: 500 }
    );
  }
}
