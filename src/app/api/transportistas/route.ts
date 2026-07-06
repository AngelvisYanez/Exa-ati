import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { searchParams } = new URL(req.url);
    const activo = searchParams.get('activo');

    const conditions: string[] = ['t.tenant_id = $1'];
    const params: any[] = [tenantId];

    if (activo !== null) {
      conditions.push('t.activo = $' + (params.length + 1));
      params.push(activo === 'true');
    }

    const whereClause = conditions.join(' AND ');

    const transportistas = await db.queryAll<any>(
      `SELECT t.id, t.ruc, t.razon_social, t.tipo_identificacion, t.placa,
              t.direccion, t.telefono, t.email, t.activo, t.created_at, t.updated_at
       FROM transportistas t
       WHERE ${whereClause}
       ORDER BY t.razon_social ASC`,
      params
    );

    return NextResponse.json({
      data: transportistas.map((t: any) => ({
        id: t.id,
        ruc: t.ruc,
        razonSocial: t.razon_social,
        tipoIdentificacion: t.tipo_identificacion,
        placa: t.placa,
        direccion: t.direccion,
        telefono: t.telefono,
        email: t.email,
        activo: Boolean(t.activo),
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('[Get Transportistas Error]', error);
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
    const { ruc, razonSocial, tipoIdentificacion, placa, direccion, telefono, email } = body;

    if (!ruc || !razonSocial || !placa) {
      return NextResponse.json(
        { message: 'ruc, razonSocial y placa son obligatorios' },
        { status: 400 }
      );
    }

    if (!/^\d{13}$/.test(ruc) || ruc.substring(10, 13) !== '001') {
      return NextResponse.json(
        { message: 'El RUC del transportista debe tener 13 dígitos y terminar en 001.' },
        { status: 400 }
      );
    }

    if (placa.trim().length < 6) {
      return NextResponse.json(
        { message: 'La placa del vehículo es requerida (mínimo 6 caracteres).' },
        { status: 400 }
      );
    }

    const existente = await db.queryOne(
      'SELECT id FROM transportistas WHERE tenant_id = $1 AND ruc = $2 AND placa = $3',
      [tenantId, ruc, placa.toUpperCase()]
    );
    if (existente) {
      return NextResponse.json(
        { message: `Ya existe un transportista con RUC ${ruc} y placa ${placa.toUpperCase()}.` },
        { status: 409 }
      );
    }

    const result = await db.queryOne<any>(
      `INSERT INTO transportistas (tenant_id, ruc, razon_social, tipo_identificacion, placa, direccion, telefono, email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [tenantId, ruc, razonSocial, tipoIdentificacion || '04', placa.toUpperCase(), direccion || null, telefono || null, email || null]
    );

    return NextResponse.json({
      data: {
        id: result.id,
        ruc: result.ruc,
        razonSocial: result.razon_social,
        tipoIdentificacion: result.tipo_identificacion,
        placa: result.placa,
        direccion: result.direccion,
        telefono: result.telefono,
        email: result.email,
        activo: Boolean(result.activo),
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Post Transportista Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
