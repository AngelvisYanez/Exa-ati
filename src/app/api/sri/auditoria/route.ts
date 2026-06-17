import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { buildAuditAlerts, fetchTenantComprobantes, runAudit } from '@/lib/sri-api/audit-engine';
import { getUserRuc } from '@/lib/sri-api/user-resolver';

function parseDateRange(req: Request) {
  const { searchParams } = new URL(req.url);
  const fechaDesde = searchParams.get('fechaDesde') || undefined;
  const fechaHasta = searchParams.get('fechaHasta') || undefined;
  return { fechaDesde, fechaHasta };
}

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user);
    const range = parseDateRange(req);

    const emisor = await db.queryOne<any>(
      `SELECT cert_valido_hasta, certificado_valido_hasta FROM emisores WHERE ruc = ? AND activo = 1`,
      [userRuc]
    );

    const expiry = emisor?.certificado_valido_hasta || emisor?.cert_valido_hasta || null;
    let certDaysLeft: number | null = null;
    if (expiry) {
      certDaysLeft = Math.ceil(
        (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
    }

    const tenantId = requireTenantId(user);
    const comprobantes = await fetchTenantComprobantes(tenantId, userRuc, range);
    const alerts = buildAuditAlerts(comprobantes, userRuc, certDaysLeft);

    const lastRun = await db.queryOne<any>(
      `SELECT created_at, datos_nuevos FROM auditoria
       WHERE tenant_id = ? AND accion = 'AUDITORIA_IA'
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId]
    );

    return NextResponse.json({
      success: true,
      alerts,
      comprobantesRevisados: comprobantes.length,
      lastExecutedAt: lastRun?.created_at || null,
      fechaDesde: range.fechaDesde,
      fechaHasta: range.fechaHasta,
    });
  } catch (error: any) {
    console.error('[Auditoria GET Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al obtener auditoría' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const body = await req.json().catch(() => ({}));
    const userRuc = await getUserRuc(user);
    const range = {
      fechaDesde: body.fechaDesde || undefined,
      fechaHasta: body.fechaHasta || undefined,
    };
    const result = await runAudit(userRuc, requireTenantId(user), range);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[Auditoria POST Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al ejecutar auditoría' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
