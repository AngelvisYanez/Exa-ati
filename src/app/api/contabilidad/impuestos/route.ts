import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { searchParams } = new URL(req.url);
    const tipoImpuesto = searchParams.get('tipoImpuesto');
    const activo = searchParams.get('activo');

    const conditions: string[] = ['i.tenant_id = $1'];
    const params: any[] = [tenantId];

    if (tipoImpuesto) {
      conditions.push('i.tipo_impuesto = $' + (params.length + 1));
      params.push(tipoImpuesto);
    }
    if (activo !== null) {
      conditions.push('i.activo = $' + (params.length + 1));
      params.push(activo === 'true');
    }

    const whereClause = conditions.join(' AND ');

    const impuestos = await db.queryAll<any>(
      `SELECT i.id, i.codigo, i.codigo_porcentaje, i.nombre, i.porcentaje, i.tarifa,
              i.tipo_impuesto, i.codigo_ats, i.codigo_formulario_103, i.codigo_formulario_104,
              i.activo, i.created_at, i.updated_at
       FROM impuestos i
       WHERE ${whereClause}
       ORDER BY i.tipo_impuesto ASC, i.codigo ASC`,
      params
    );

    return NextResponse.json({
      data: impuestos.map((i: any) => ({
        id: i.id,
        codigo: i.codigo,
        codigoPorcentaje: i.codigo_porcentaje,
        nombre: i.nombre,
        porcentaje: parseFloat(i.porcentaje),
        tarifa: parseFloat(i.tarifa),
        tipoImpuesto: i.tipo_impuesto,
        codigoAts: i.codigo_ats,
        codigoFormulario103: i.codigo_formulario_103,
        codigoFormulario104: i.codigo_formulario_104,
        activo: Boolean(i.activo),
        createdAt: i.created_at,
        updatedAt: i.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('[Get Impuestos Error]', error);
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
    const { codigo, codigoPorcentaje, nombre, porcentaje, tarifa, tipoImpuesto, codigoAts, codigoFormulario103, codigoFormulario104 } = body;

    if (!codigo || !codigoPorcentaje || !nombre || porcentaje === undefined || tarifa === undefined || !tipoImpuesto) {
      return NextResponse.json(
        { message: 'código, códigoPorcentaje, nombre, porcentaje, tarifa y tipoImpuesto son obligatorios' },
        { status: 400 }
      );
    }

    const existing = await db.queryOne(
      'SELECT id FROM impuestos WHERE tenant_id = $1 AND codigo = $2 AND codigo_porcentaje = $3',
      [tenantId, codigo, codigoPorcentaje]
    );
    if (existing) {
      return NextResponse.json(
        { message: `Ya existe un impuesto con código ${codigo}-${codigoPorcentaje}` },
        { status: 409 }
      );
    }

    const result = await db.queryOne<any>(
      `INSERT INTO impuestos (tenant_id, codigo, codigo_porcentaje, nombre, porcentaje, tarifa, tipo_impuesto, codigo_ats, codigo_formulario_103, codigo_formulario_104, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [tenantId, codigo, codigoPorcentaje, nombre, porcentaje, tarifa, tipoImpuesto, codigoAts || null, codigoFormulario103 || null, codigoFormulario104 || null]
    );

    return NextResponse.json({
      data: {
        id: result.id,
        codigo: result.codigo,
        codigoPorcentaje: result.codigo_porcentaje,
        nombre: result.nombre,
        porcentaje: parseFloat(result.porcentaje),
        tarifa: parseFloat(result.tarifa),
        tipoImpuesto: result.tipo_impuesto,
        codigoAts: result.codigo_ats,
        codigoFormulario103: result.codigo_formulario_103,
        codigoFormulario104: result.codigo_formulario_104,
        activo: Boolean(result.activo),
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Post Impuesto Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
