import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { getPlanCuentasEstandar } from '@/lib/sri-api/coa-ecuador';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);

    const existing = await db.queryOne(
      'SELECT id FROM plan_cuentas WHERE tenant_id = $1 LIMIT 1',
      [tenantId]
    );
    if (existing) {
      return NextResponse.json(
        { message: 'El tenant ya tiene un plan de cuentas cargado' },
        { status: 409 }
      );
    }

    const cuentasEstandar = getPlanCuentasEstandar();
    const codigoToId = new Map<string, number>();
    const created: any[] = [];

    for (const c of cuentasEstandar) {
      const result = await db.queryOne<any>(
        `INSERT INTO plan_cuentas (tenant_id, codigo, nombre, nivel, tipo, es_auxiliar, permite_movimiento, cuenta_padre_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [
          tenantId,
          c.codigo,
          c.nombre,
          c.nivel,
          c.tipo,
          c.esAuxiliar ?? false,
          c.permiteMovimiento ?? true,
          c.cuentaPadreCodigo ? codigoToId.get(c.cuentaPadreCodigo) : null,
        ]
      );
      codigoToId.set(c.codigo, result.id);
      created.push({
        id: result.id,
        codigo: result.codigo,
        nombre: result.nombre,
        nivel: result.nivel,
        tipo: result.tipo,
      });
    }

    return NextResponse.json({
      message: 'Plan de cuentas estándar creado exitosamente',
      data: created,
      total: created.length,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Post Plan Cuentas Estandar Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
