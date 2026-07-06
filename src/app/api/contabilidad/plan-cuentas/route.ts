import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get('tipo');
    const nivel = searchParams.get('nivel');
    const activo = searchParams.get('activo');
    const padreId = searchParams.get('padreId');

    const conditions: string[] = ['p.tenant_id = $1'];
    const params: any[] = [tenantId];

    if (tipo) {
      conditions.push('p.tipo = $' + (params.length + 1));
      params.push(tipo);
    }
    if (nivel) {
      conditions.push('p.nivel = $' + (params.length + 1));
      params.push(parseInt(nivel, 10));
    }
    if (activo !== null) {
      conditions.push('p.activo = $' + (params.length + 1));
      params.push(activo === 'true');
    }
    if (padreId) {
      conditions.push('p.cuenta_padre_id = $' + (params.length + 1));
      params.push(parseInt(padreId, 10));
    }

    const whereClause = conditions.join(' AND ');

    const cuentas = await db.queryAll<any>(
      `SELECT p.id, p.codigo, p.nombre, p.nivel, p.tipo, p.es_auxiliar,
              p.permite_movimiento, p.cuenta_padre_id, p.activo, p.created_at, p.updated_at
       FROM plan_cuentas p
       WHERE ${whereClause}
       ORDER BY p.codigo ASC`,
      params
    );

    return NextResponse.json({
      data: cuentas.map((c: any) => ({
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        nivel: c.nivel,
        tipo: c.tipo,
        esAuxiliar: Boolean(c.es_auxiliar),
        permiteMovimiento: Boolean(c.permite_movimiento),
        cuentaPadreId: c.cuenta_padre_id,
        activo: Boolean(c.activo),
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('[Get Plan Cuentas Error]', error);
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
    const { codigo, nombre, nivel, tipo, esAuxiliar, permiteMovimiento, cuentaPadreId } = body;

    if (!codigo || !nombre || nivel === undefined || !tipo) {
      return NextResponse.json(
        { message: 'código, nombre, nivel y tipo son obligatorios' },
        { status: 400 }
      );
    }

    const existing = await db.queryOne(
      'SELECT id FROM plan_cuentas WHERE tenant_id = $1 AND codigo = $2',
      [tenantId, codigo]
    );
    if (existing) {
      return NextResponse.json(
        { message: `Ya existe una cuenta con el código ${codigo}` },
        { status: 409 }
      );
    }

    if (cuentaPadreId) {
      const padre = await db.queryOne(
        'SELECT id, nivel FROM plan_cuentas WHERE id = $1 AND tenant_id = $2',
        [cuentaPadreId, tenantId]
      );
      if (!padre) {
        return NextResponse.json(
          { message: `Cuenta padre ID ${cuentaPadreId} no encontrada` },
          { status: 400 }
        );
      }
      if (nivel !== padre.nivel + 1) {
        return NextResponse.json(
          { message: `El nivel debe ser ${padre.nivel + 1} para la cuenta padre seleccionada` },
          { status: 400 }
        );
      }
    } else if (nivel !== 1) {
      return NextResponse.json(
        { message: 'Una cuenta sin padre debe tener nivel 1' },
        { status: 400 }
      );
    }

    const result = await db.queryOne<any>(
      `INSERT INTO plan_cuentas (tenant_id, codigo, nombre, nivel, tipo, es_auxiliar, permite_movimiento, cuenta_padre_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [tenantId, codigo, nombre, nivel, tipo, esAuxiliar ?? false, permiteMovimiento ?? true, cuentaPadreId || null]
    );

    if (!result) {
      return NextResponse.json(
        { message: 'Error al crear la cuenta' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        id: result.id,
        codigo: result.codigo,
        nombre: result.nombre,
        nivel: result.nivel,
        tipo: result.tipo,
        esAuxiliar: Boolean(result.es_auxiliar),
        permiteMovimiento: Boolean(result.permite_movimiento),
        cuentaPadreId: result.cuenta_padre_id,
        activo: Boolean(result.activo),
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Post Plan Cuenta Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
