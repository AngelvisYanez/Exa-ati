import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { searchParams } = new URL(req.url);
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');

    const conditions = ['a.tenant_id = $1'];
    const params: unknown[] = [tenantId];

    if (desde) {
      conditions.push(`a.fecha >= $${params.length + 1}`);
      params.push(desde);
    }
    if (hasta) {
      conditions.push(`a.fecha <= $${params.length + 1}`);
      params.push(hasta);
    }

    const where = conditions.join(' AND ');

    const filas = await db.queryAll<{
      cuenta_codigo: string;
      cuenta_nombre: string;
      total_debe: string;
      total_haber: string;
    }>(
      `SELECT al.cuenta_codigo, al.cuenta_nombre,
              COALESCE(SUM(al.debe), 0) AS total_debe,
              COALESCE(SUM(al.haber), 0) AS total_haber
       FROM asiento_lineas al
       INNER JOIN asientos a ON a.id = al.asiento_id
       WHERE ${where}
       GROUP BY al.cuenta_codigo, al.cuenta_nombre
       ORDER BY al.cuenta_codigo ASC`,
      params
    );

    const cuentas = filas.map((f) => ({
      cuentaCodigo: f.cuenta_codigo,
      cuentaNombre: f.cuenta_nombre,
      debe: Number(f.total_debe),
      haber: Number(f.total_haber),
      saldo: Number(f.total_debe) - Number(f.total_haber),
    }));

    const totales = cuentas.reduce(
      (acc, c) => ({
        debe: acc.debe + c.debe,
        haber: acc.haber + c.haber,
      }),
      { debe: 0, haber: 0 }
    );

    return NextResponse.json({
      data: {
        cuentas,
        totales,
        cuadra: Math.abs(totales.debe - totales.haber) < 0.01,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json(
      { message },
      { status: message.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
