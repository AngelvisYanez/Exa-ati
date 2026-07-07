import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const { searchParams } = new URL(req.url);

    const accion = searchParams.get('accion') || '';
    const recurso = searchParams.get('recurso') || '';
    const usuarioEmail = searchParams.get('email') || '';
    const desde = searchParams.get('desde') || '';
    const hasta = searchParams.get('hasta') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));

    const conditions: string[] = [];
    const params: any[] = [];

    if (user.rol === 'ADMIN') {
      const tenantId = requireTenantId(user);
      conditions.push('a.tenant_id = $' + (params.length + 1));
      params.push(tenantId);
    }

    if (accion) {
      conditions.push('a.accion = $' + (params.length + 1));
      params.push(accion);
    }

    if (recurso) {
      conditions.push('a.recurso = $' + (params.length + 1));
      params.push(recurso);
    }

    if (usuarioEmail) {
      conditions.push('a.usuario_email ILIKE $' + (params.length + 1));
      params.push(`%${usuarioEmail}%`);
    }

    if (desde) {
      conditions.push('a.created_at >= $' + (params.length + 1));
      params.push(new Date(desde));
    }

    if (hasta) {
      conditions.push('a.created_at <= $' + (params.length + 1));
      params.push(new Date(hasta + 'T23:59:59.999Z'));
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (page - 1) * pageSize;

    const countResult = await db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM auditoria a ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.count || '0');

    const accionesPosibles = await db.queryAll<{ accion: string }>(
      `SELECT DISTINCT a.accion FROM auditoria a ORDER BY a.accion`
    );

    const recursosPosibles = await db.queryAll<{ recurso: string }>(
      `SELECT DISTINCT a.recurso FROM auditoria a WHERE a.recurso IS NOT NULL ORDER BY a.recurso`
    );

    const logs = await db.queryAll<any>(
      `SELECT a.id, a.usuario_email, a.tenant_id, a.accion, a.recurso,
              a.descripcion, a.datos_nuevos, a.exitoso, a.created_at
       FROM auditoria a
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );

    return NextResponse.json({
      data: logs.map((l: any) => ({
        id: l.id,
        usuarioEmail: l.usuario_email,
        tenantId: l.tenant_id,
        accion: l.accion,
        recurso: l.recurso,
        descripcion: l.descripcion,
        datosNuevos: l.datos_nuevos,
        exitoso: Boolean(l.exitoso),
        createdAt: l.created_at,
      })),
      filtros: {
        acciones: accionesPosibles.map((a: any) => a.accion),
        recursos: recursosPosibles.map((r: any) => r.recurso),
      },
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: any) {
    console.error('[Admin Auditoria GET]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
