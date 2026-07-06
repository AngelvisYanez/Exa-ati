import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get('tipo');
    const search = searchParams.get('search');
    const activo = searchParams.get('activo');

    const conditions: string[] = ['c.tenant_id = $1'];
    const params: any[] = [tenantId];

    if (tipo === 'cliente') {
      conditions.push('c.es_cliente = true');
    } else if (tipo === 'proveedor') {
      conditions.push('c.es_proveedor = true');
    }

    if (activo !== null) {
      conditions.push('c.activo = $' + (params.length + 1));
      params.push(activo === 'true');
    }

    if (search) {
      const idx = params.length + 1;
      conditions.push(`(c.razon_social ILIKE $${idx} OR c.identificacion ILIKE $${idx} OR COALESCE(c.nombre_comercial, '') ILIKE $${idx})`);
      params.push(`%${search}%`);
    }

    const whereClause = conditions.join(' AND ');

    const contactos = await db.queryAll<any>(
      `SELECT c.id, c.tipo_identificacion, c.identificacion, c.razon_social,
              c.nombre_comercial, c.email, c.telefono, c.direccion,
              c.tipo_contribuyente_sri, c.obligado_contabilidad,
              c.agente_retencion, c.es_cliente, c.es_proveedor,
              c.activo, c.created_at, c.updated_at
       FROM contactos c
       WHERE ${whereClause}
       ORDER BY c.razon_social ASC`,
      params
    );

    return NextResponse.json({
      data: contactos.map((c: any) => ({
        id: c.id,
        tipoIdentificacion: c.tipo_identificacion,
        identificacion: c.identificacion,
        razonSocial: c.razon_social,
        nombreComercial: c.nombre_comercial,
        email: c.email,
        telefono: c.telefono,
        direccion: c.direccion,
        tipoContribuyenteSri: c.tipo_contribuyente_sri,
        obligadoContabilidad: c.obligado_contabilidad,
        agenteRetencion: Boolean(c.agente_retencion),
        esCliente: Boolean(c.es_cliente),
        esProveedor: Boolean(c.es_proveedor),
        activo: Boolean(c.activo),
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('[Get Contactos Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const body = await req.json();
    const {
      tipoIdentificacion, identificacion, razonSocial, nombreComercial,
      email, telefono, direccion, tipoContribuyenteSri, obligadoContabilidad,
      agenteRetencion, esCliente, esProveedor,
    } = body;

    if (!tipoIdentificacion || !identificacion || !razonSocial) {
      return NextResponse.json(
        { message: 'tipoIdentificacion, identificacion y razonSocial son obligatorios' },
        { status: 400 }
      );
    }

    const existente = await db.queryOne(
      'SELECT id FROM contactos WHERE tenant_id = $1 AND tipo_identificacion = $2 AND identificacion = $3',
      [tenantId, tipoIdentificacion, identificacion]
    );
    if (existente) {
      const tipoLabel = tipoIdentificacion === '05' ? 'cédula' : 'RUC';
      return NextResponse.json(
        { message: `Ya existe un contacto con ${tipoLabel} ${identificacion}` },
        { status: 409 }
      );
    }

    const result = await db.queryOne<any>(
      `INSERT INTO contactos (tenant_id, tipo_identificacion, identificacion, razon_social, nombre_comercial,
        email, telefono, direccion, tipo_contribuyente_sri, obligado_contabilidad,
        agente_retencion, es_cliente, es_proveedor, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
       RETURNING *`,
      [
        tenantId, tipoIdentificacion, identificacion, razonSocial, nombreComercial || null,
        email || null, telefono || null, direccion || null, tipoContribuyenteSri || null,
        obligadoContabilidad || null, agenteRetencion ?? false, esCliente ?? true, esProveedor ?? false,
      ]
    );

    return NextResponse.json({
      data: {
        id: result.id,
        tipoIdentificacion: result.tipo_identificacion,
        identificacion: result.identificacion,
        razonSocial: result.razon_social,
        nombreComercial: result.nombre_comercial,
        email: result.email,
        telefono: result.telefono,
        direccion: result.direccion,
        tipoContribuyenteSri: result.tipo_contribuyente_sri,
        obligadoContabilidad: result.obligado_contabilidad,
        agenteRetencion: Boolean(result.agente_retencion),
        esCliente: Boolean(result.es_cliente),
        esProveedor: Boolean(result.es_proveedor),
        activo: Boolean(result.activo),
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Post Contacto Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
