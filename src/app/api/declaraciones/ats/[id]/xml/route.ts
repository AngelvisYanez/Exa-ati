import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { id } = await params;
    const numId = parseInt(id, 10);

    const reporte = await db.queryOne<any>(
      `SELECT r.id, r.tipo, r.periodo, r.data, r.xml_generado
       FROM reportes_fiscales r
       WHERE r.id = $1 AND r.tenant_id = $2 AND r.tipo = 'ATS'`,
      [numId, tenantId]
    );

    if (!reporte) {
      return NextResponse.json(
        { message: `Reporte ATS con ID ${id} no encontrado` },
        { status: 404 }
      );
    }

    const data = typeof reporte.data === 'string' ? JSON.parse(reporte.data) : reporte.data;

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<ats>\n';
    xml += `  <periodo>${data.periodo}</periodo>\n`;
    xml += `  <razonSocial>${escapeXml(data.razonSocial || '')}</razonSocial>\n`;
    xml += `  <ruc>${data.ruc || ''}</ruc>\n`;

    xml += '  <ventas>\n';
    for (const v of data.ventas || []) {
      xml += '    <venta>\n';
      xml += `      <tpIdCliente>${v.tpIdCliente}</tpIdCliente>\n`;
      xml += `      <idCliente>${escapeXml(v.idCliente)}</idCliente>\n`;
      xml += `      <razonSocial>${escapeXml(v.razonSocial)}</razonSocial>\n`;
      xml += `      <tipoComprobante>${v.tipoComprobante}</tipoComprobante>\n`;
      xml += `      <numeroComprobantes>${v.numeroComprobantes}</numeroComprobantes>\n`;
      xml += `      <baseImponible>${(v.baseImponible || 0).toFixed(2)}</baseImponible>\n`;
      xml += `      <baseNoGraIva>${(v.baseNoGraIva || 0).toFixed(2)}</baseNoGraIva>\n`;
      xml += `      <montoIva>${(v.montoIva || 0).toFixed(2)}</montoIva>\n`;
      xml += `      <valorRetenidoIva>${(v.valorRetenidoIva || 0).toFixed(2)}</valorRetenidoIva>\n`;
      xml += `      <valorRetenidoRenta>${(v.valorRetenidoRenta || 0).toFixed(2)}</valorRetenidoRenta>\n`;
      xml += '    </venta>\n';
    }
    xml += '  </ventas>\n';

    xml += '  <compras>\n';
    for (const c of data.compras || []) {
      xml += '    <compra>\n';
      xml += `      <tpIdProveedor>${c.tpIdProveedor}</tpIdProveedor>\n`;
      xml += `      <idProveedor>${escapeXml(c.idProveedor)}</idProveedor>\n`;
      xml += `      <razonSocial>${escapeXml(c.razonSocial)}</razonSocial>\n`;
      xml += `      <tipoComprobante>${c.tipoComprobante}</tipoComprobante>\n`;
      xml += `      <numeroComprobantes>${c.numeroComprobantes}</numeroComprobantes>\n`;
      xml += `      <baseImponible>${(c.baseImponible || 0).toFixed(2)}</baseImponible>\n`;
      xml += `      <baseNoGraIva>${(c.baseNoGraIva || 0).toFixed(2)}</baseNoGraIva>\n`;
      xml += `      <montoIva>${(c.montoIva || 0).toFixed(2)}</montoIva>\n`;
      xml += `      <valorRetenidoIva>${(c.valorRetenidoIva || 0).toFixed(2)}</valorRetenidoIva>\n`;
      xml += `      <valorRetenidoRenta>${(c.valorRetenidoRenta || 0).toFixed(2)}</valorRetenidoRenta>\n`;
      xml += '    </compra>\n';
    }
    xml += '  </compras>\n';

    xml += '  <retenciones>\n';
    for (const r of data.retenciones || []) {
      xml += '    <retencion>\n';
      xml += `      <tipoComprobante>${r.tipoComprobante}</tipoComprobante>\n`;
      xml += `      <numeroComprobantes>${r.numeroComprobantes}</numeroComprobantes>\n`;
      xml += `      <baseImponible>${(r.baseImponible || 0).toFixed(2)}</baseImponible>\n`;
      xml += `      <valorRetenidoIva>${(r.valorRetenidoIva || 0).toFixed(2)}</valorRetenidoIva>\n`;
      xml += `      <valorRetenidoRenta>${(r.valorRetenidoRenta || 0).toFixed(2)}</valorRetenidoRenta>\n`;
      xml += '    </retencion>\n';
    }
    xml += '  </retenciones>\n';

    xml += '</ats>\n';

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="ATS_${data.periodo}.xml"`,
      },
    });
  } catch (error: any) {
    console.error('[Export ATS XML Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
