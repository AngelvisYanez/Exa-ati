import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { getLinkedCompany } from '@/services/sri-api/user-resolver';
import { db } from '@/services/sri-api/db';
import { BrandPdf } from '@/services/pdf/layout';

async function getFilteredLogs(req: Request, user: any) {
  const { searchParams } = new URL(req.url);
  const accion = searchParams.get('accion') || '';
  const recurso = searchParams.get('recurso') || '';
  const usuarioEmail = searchParams.get('email') || '';
  const desde = searchParams.get('desde') || '';
  const hasta = searchParams.get('hasta') || '';

  const conditions: string[] = [];
  const params: any[] = [];

  if (user.rol === 'ADMIN') {
    const tenantId = requireTenantId(user);
    conditions.push('a.tenant_id = $' + (params.length + 1));
    params.push(tenantId);
  }

  if (accion) { conditions.push('a.accion = $' + (params.length + 1)); params.push(accion); }
  if (recurso) { conditions.push('a.recurso = $' + (params.length + 1)); params.push(recurso); }
  if (usuarioEmail) { conditions.push('a.usuario_email ILIKE $' + (params.length + 1)); params.push(`%${usuarioEmail}%`); }
  if (desde) { conditions.push('a.created_at >= $' + (params.length + 1)); params.push(new Date(desde)); }
  if (hasta) { conditions.push('a.created_at <= $' + (params.length + 1)); params.push(new Date(hasta + 'T23:59:59.999Z')); }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  return db.queryAll<any>(
    `SELECT a.id, a.usuario_email, a.accion, a.recurso, a.descripcion, a.exitoso, a.created_at
     FROM auditoria a
     ${whereClause}
     ORDER BY a.created_at DESC`,
    params
  );
}

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';

    const logs = await getFilteredLogs(req, user);

    if (format === 'pdf') {
      const company = await getLinkedCompany(user, req);
      const pdf = await BrandPdf.create(company);
      pdf.drawHeader({
        documentTitle: 'Auditoría',
        subtitle: `Generado ${new Date().toLocaleString('es-EC')} · ${logs.length} registros`,
      });

      const descW = pdf.contentWidth - 92 - 110 - 70 - 70;
      pdf.drawTable(
        [
          { header: 'Fecha', width: 92 },
          { header: 'Usuario', width: 110 },
          { header: 'Acción', width: 70 },
          { header: 'Recurso', width: 70 },
          { header: 'Descripción', width: descW },
        ],
        logs.map((log) => {
          const fecha = log.created_at
            ? new Date(log.created_at).toLocaleString('es-EC', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—';
          return [fecha, log.usuario_email || '—', log.accion || '—', log.recurso || '—', log.descripcion || '—'];
        })
      );

      const pdfBuffer = await pdf.toBuffer();

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="auditoria-${Date.now()}.pdf"`,
        },
      });
    }

    const csvRows = [
      ['ID', 'Fecha', 'Usuario', 'Accion', 'Recurso', 'Descripcion', 'Exitoso'].join(','),
      ...logs.map((l: any) =>
        [
          l.id,
          l.created_at ? new Date(l.created_at).toISOString() : '',
          `"${(l.usuario_email || '').replace(/"/g, '""')}"`,
          `"${l.accion}"`,
          `"${(l.recurso || '').replace(/"/g, '""')}"`,
          `"${(l.descripcion || '').replace(/"/g, '""')}"`,
          l.exitoso ? 'SI' : 'NO',
        ].join(',')
      ),
    ].join('\n');

    return new NextResponse(csvRows, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="auditoria-${Date.now()}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('[Admin Auditoria Export]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
