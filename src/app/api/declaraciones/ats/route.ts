import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import { getAtsData } from '@/services/sri-api/ats';
import { requireModule } from '@/services/sri-api/rbac';

/** Acepta YYYYMM o YYYY-MM → número YYYYMM */
function normalizePeriodo(periodo: unknown): number | null {
  if (periodo == null || periodo === '') return null;
  const s = String(periodo).replace(/-/g, '');
  if (!/^\d{6}$/.test(s)) return null;
  const year = parseInt(s.substring(0, 4), 10);
  const month = parseInt(s.substring(4, 6), 10);
  if (year < 2000 || month < 1 || month > 12) return null;
  return parseInt(s, 10);
}

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, 'declaraciones');
    const tenantId = requireTenantId(user);
    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get('periodo');

    const conditions: string[] = ['r.tenant_id = $1', "r.tipo = 'ATS'"];
    const params: any[] = [tenantId];

    if (periodo) {
      const p = normalizePeriodo(periodo);
      if (p) {
        conditions.push('r.periodo = $' + (params.length + 1));
        params.push(p);
      }
    }

    const whereClause = conditions.join(' AND ');

    const reportes = await db.queryAll<any>(
      `SELECT r.id, r.tipo, r.periodo, r.estado, r.fecha_generacion,
              r.created_at, r.updated_at
       FROM reportes_fiscales r
       WHERE ${whereClause}
       ORDER BY r.periodo DESC, r.created_at DESC`,
      params
    );

    return NextResponse.json({
      data: reportes.map((r: any) => ({
        id: r.id,
        tipo: r.tipo,
        periodo: r.periodo,
        estado: r.estado,
        fechaGeneracion: r.fecha_generacion,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('[Get ATS Reports Error]', error);
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
    const periodo = normalizePeriodo(body.periodo);

    if (!periodo) {
      return NextResponse.json(
        { message: 'periodo es obligatorio (formato YYYYMM o YYYY-MM)' },
        { status: 400 }
      );
    }

    const resultado = body.datos && typeof body.datos === 'object'
      ? { ...body.datos, periodo }
      : await getAtsData(tenantId, periodo);

    const existing = await db.queryOne<any>(
      `SELECT id FROM reportes_fiscales
       WHERE tenant_id = $1 AND tipo = 'ATS' AND periodo = $2
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, periodo]
    );

    let result: any;
    if (existing?.id) {
      result = await db.queryOne<any>(
        `UPDATE reportes_fiscales
         SET data = $1, estado = 'GENERADO', fecha_generacion = NOW(), updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify(resultado), existing.id]
      );
    } else {
      result = await db.queryOne<any>(
        `INSERT INTO reportes_fiscales (tenant_id, tipo, periodo, data, estado, fecha_generacion, created_at, updated_at)
         VALUES ($1, 'ATS', $2, $3, 'GENERADO', NOW(), NOW(), NOW())
         RETURNING *`,
        [tenantId, periodo, JSON.stringify(resultado)]
      );
    }

    return NextResponse.json({
      data: {
        id: result.id,
        tipo: result.tipo,
        periodo: result.periodo,
        estado: result.estado,
        data: resultado,
        fechaGeneracion: result.fecha_generacion,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      },
    }, { status: existing ? 200 : 201 });
  } catch (error: any) {
    console.error('[Post ATS Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      {
        status: error.message?.startsWith('No autorizado')
          ? 401
          : error.message?.includes('emisor')
            ? 400
            : 500,
      }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const numId = id ? parseInt(id, 10) : NaN;

    if (!Number.isFinite(numId)) {
      return NextResponse.json({ message: 'id es obligatorio' }, { status: 400 });
    }

    const deleted = await db.queryOne<any>(
      `DELETE FROM reportes_fiscales
       WHERE id = $1 AND tenant_id = $2 AND tipo = 'ATS'
       RETURNING id`,
      [numId, tenantId]
    );

    if (!deleted) {
      return NextResponse.json({ message: 'ATS no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ data: { id: deleted.id } });
  } catch (error: any) {
    console.error('[Delete ATS Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
