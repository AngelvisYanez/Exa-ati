import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { calculateTaxSummary } from '@/lib/sri-api/tax-calculator';
import { fetchTenantComprobantes } from '@/lib/sri-api/audit-engine';
import { getUserRuc } from '@/lib/sri-api/user-resolver';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const { searchParams } = new URL(req.url);
    const fechaDesde = searchParams.get('fechaDesde') || undefined;
    const fechaHasta = searchParams.get('fechaHasta') || undefined;

    const tenantId = requireTenantId(user);

    const conditions = ["tenant_id = ?", "accion = 'PRESENTAR_DECLARACION'", 'exitoso = true'];
    const params: string[] = [tenantId];

    if (fechaDesde) {
      conditions.push(`(
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(datos_nuevos, '$.fechaHasta')), DATE(created_at)) >= ?
      )`);
      params.push(fechaDesde);
    }
    if (fechaHasta) {
      conditions.push(`(
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(datos_nuevos, '$.fechaDesde')), DATE(created_at)) <= ?
      )`);
      params.push(fechaHasta);
    }

    const rows = await db.queryAll<any>(
      `SELECT id, descripcion, datos_nuevos, created_at
       FROM auditoria
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT 50`,
      params
    );

    const declaraciones = rows.map((row) => {
      const data = typeof row.datos_nuevos === 'string'
        ? JSON.parse(row.datos_nuevos)
        : row.datos_nuevos;

      return {
        id: row.id,
        periodo: data?.periodo || null,
        tipo: data?.formulario || null,
        tramite: data?.numeroTramite || null,
        fecha: data?.fechaDesde && data?.fechaHasta
          ? `${data.fechaDesde} – ${data.fechaHasta}`
          : new Date(row.created_at).toLocaleDateString('es-EC', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
        fechaDesde: data?.fechaDesde || null,
        fechaHasta: data?.fechaHasta || null,
        estado: data?.estado || null,
        iva: parseFloat(data?.ivaAPagar || 0),
        createdAt: row.created_at,
      };
    });

    return NextResponse.json({ success: true, data: declaraciones });
  } catch (error: any) {
    console.error('[Declaraciones GET Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al listar declaraciones' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const body = await req.json();
    const userRuc = await getUserRuc(user);
    const tenantId = requireTenantId(user);

    const range = {
      fechaDesde: body.fechaDesde || undefined,
      fechaHasta: body.fechaHasta || undefined,
    };

    const comprobantes = await fetchTenantComprobantes(tenantId, userRuc, range);
    const summary = calculateTaxSummary(comprobantes, userRuc);

    const emisor = await db.queryOne<any>(
      `SELECT razon_social FROM emisores WHERE ruc = ? AND activo = true`,
      [userRuc]
    );

    const periodo =
      body.periodo ||
      new Date().toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });

    const payload = {
      formulario: '104A',
      periodo,
      ruc: userRuc,
      razonSocial: emisor?.razon_social || userRuc,
      ivaAPagar: summary.ivaAPagarNeto,
      casilleros: {
        '401': parseFloat(summary.totalVentasSub.toFixed(2)),
        '411': parseFloat(summary.totalVentasIva.toFixed(2)),
        '500': parseFloat(summary.totalComprasSub.toFixed(2)),
        '553': parseFloat(summary.totalComprasIva.toFixed(2)),
        '604': parseFloat(summary.totalRetencionesImporte.toFixed(2)),
        '699': parseFloat(summary.ivaAPagarNeto.toFixed(2)),
      },
      documentosProcesados: comprobantes.length,
      otpVerificado: !!body.otpVerificado,
      estado: 'REGISTRADA',
      numeroTramite: null as string | null,
      fechaDesde: range.fechaDesde,
      fechaHasta: range.fechaHasta,
    };

    const auditRow = await db.insert<any>('auditoria', {
      usuario_email: userRuc,
      tenant_id: tenantId,
      accion: 'PRESENTAR_DECLARACION',
      recurso: 'declaraciones',
      descripcion: `Declaración IVA ${periodo} registrada. IVA: $${payload.ivaAPagar.toFixed(2)}`,
      datos_nuevos: JSON.stringify(payload),
      exitoso: true,
    });

    const insertedId = auditRow?.id || 0;
    payload.numeroTramite = `SRI-${String(insertedId).padStart(10, '0')}`;

    if (insertedId) {
      await db.update('auditoria', { datos_nuevos: JSON.stringify(payload) }, 'id = ?', [insertedId]);
    }

    return NextResponse.json({
      success: true,
      message: 'Declaración registrada correctamente',
      declaracion: payload,
    });
  } catch (error: any) {
    console.error('[Declaraciones POST Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al registrar declaración' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
