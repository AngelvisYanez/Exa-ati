import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const page = pdfDoc.addPage([612, 792]);
      const { width, height } = page.getSize();
      let y = height - 50;

      page.drawText('Reporte de Auditoria - EXA-ATI', {
        x: 50, y, size: 16, font: fontBold, color: rgb(0.1, 0.1, 0.2),
      });
      y -= 10;
      page.drawText(`Generado: ${new Date().toLocaleString('es-EC')}`, {
        x: 50, y, size: 9, font, color: rgb(0.4, 0.4, 0.4),
      });
      y -= 8;
      page.drawText(`Total registros: ${logs.length}`, {
        x: 50, y, size: 9, font, color: rgb(0.4, 0.4, 0.4),
      });
      y -= 25;

      const colX = [50, 160, 230, 300, 400];
      const headers = ['Fecha', 'Usuario', 'Accion', 'Recurso', 'Descripcion'];

      page.drawLine({ start: { x: 50, y }, end: { x: 562, y }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
      y -= 4;

      headers.forEach((h, i) => {
        page.drawText(h, { x: colX[i], y, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.2) });
      });
      y -= 4;
      page.drawLine({ start: { x: 50, y }, end: { x: 562, y }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
      y -= 12;

      for (const log of logs) {
        if (y < 60) {
          const newPage = pdfDoc.addPage([612, 792]);
          y = height - 50;
        }

        const fecha = log.created_at
          ? new Date(log.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '—';

        const desc = (log.descripcion || '—').substring(0, 60);

        page.drawText(fecha, { x: colX[0], y, size: 7, font, color: rgb(0.2, 0.2, 0.2) });
        page.drawText(log.usuario_email || '—', { x: colX[1], y, size: 7, font, color: rgb(0.2, 0.2, 0.2) });
        page.drawText(log.accion, { x: colX[2], y, size: 7, font, color: rgb(0.2, 0.2, 0.2) });
        page.drawText(log.recurso || '—', { x: colX[3], y, size: 7, font, color: rgb(0.2, 0.2, 0.2) });
        page.drawText(desc, { x: colX[4], y, size: 7, font, color: rgb(0.2, 0.2, 0.2) });

        y -= 14;
      }

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      return new NextResponse(pdfBuffer, {
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
