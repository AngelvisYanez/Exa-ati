import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);

    const cuentas = await db.queryAll<any>(
      `SELECT id, codigo, nombre, nivel, tipo, es_auxiliar, permite_movimiento,
              cuenta_padre_id, activo
       FROM plan_cuentas
       WHERE tenant_id = $1 AND activo = true
       ORDER BY codigo ASC`,
      [tenantId]
    );

    const map = new Map<number, any>();
    const raices: any[] = [];

    for (const c of cuentas) {
      map.set(c.id, {
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        nivel: c.nivel,
        tipo: c.tipo,
        esAuxiliar: Boolean(c.es_auxiliar),
        permiteMovimiento: Boolean(c.permite_movimiento),
        cuentaPadreId: c.cuenta_padre_id,
        activo: Boolean(c.activo),
        subcuentas: [],
      });
    }

    for (const c of cuentas) {
      const nodo = map.get(c.id);
      if (c.cuenta_padre_id && map.has(c.cuenta_padre_id)) {
        map.get(c.cuenta_padre_id).subcuentas.push(nodo);
      } else {
        raices.push(nodo);
      }
    }

    return NextResponse.json({ data: raices });
  } catch (error: any) {
    console.error('[Get Arbol Plan Cuentas Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
