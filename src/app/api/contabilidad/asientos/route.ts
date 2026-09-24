import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import { embeddings } from '@/services/sri-api/embeddings';
import { requireModule } from '@/services/sri-api/rbac';

interface LineaInput {
  cuentaCodigo: string;
  cuentaNombre: string;
  debe: number;
  haber: number;
}

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, 'contabilidad');
    const tenantId = requireTenantId(user);
    const { searchParams } = new URL(req.url);
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const limite = parseInt(searchParams.get('limite') || '50', 10);

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

    const asientos = await db.queryAll<{
      id: string;
      fecha: string;
      numero: number;
      glosa: string;
      origen: string;
      comprobante_id: string | null;
      estado: string;
      created_at: string;
    }>(
      `SELECT a.id, a.fecha, a.numero, a.glosa, a.origen, a.comprobante_id, a.estado, a.created_at
       FROM asientos a
       WHERE ${where}
       ORDER BY a.fecha DESC, a.numero DESC
       LIMIT $${params.length + 1}`,
      [...params, limite]
    );

    const withLineas = await Promise.all(
      asientos.map(async (a) => {
        const lineas = await db.queryAll(
          `SELECT id, cuenta_codigo, cuenta_nombre, debe, haber, orden
           FROM asiento_lineas WHERE asiento_id = $1 ORDER BY orden ASC`,
          [a.id]
        );
        return { ...a, lineas };
      })
    );

    return NextResponse.json({ data: withLineas });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json(
      { message },
      { status: message.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, 'contabilidad');
    const tenantId = requireTenantId(user);
    const body = await req.json();
    const { fecha, glosa, origen, comprobanteId, lineas } = body as {
      fecha: string;
      glosa: string;
      origen?: string;
      comprobanteId?: string;
      lineas: LineaInput[];
    };

    if (!fecha || !glosa || !Array.isArray(lineas) || lineas.length < 2) {
      return NextResponse.json(
        { message: 'fecha, glosa y al menos 2 líneas son obligatorios' },
        { status: 400 }
      );
    }

    const totalDebe = lineas.reduce((s, l) => s + Number(l.debe || 0), 0);
    const totalHaber = lineas.reduce((s, l) => s + Number(l.haber || 0), 0);

    if (Math.abs(totalDebe - totalHaber) > 0.01) {
      return NextResponse.json(
        { message: `El asiento no cuadra: debe=${totalDebe.toFixed(2)} haber=${totalHaber.toFixed(2)}` },
        { status: 400 }
      );
    }

    const maxRow = await db.queryOne<{ max_num: number | null }>(
      'SELECT MAX(numero) AS max_num FROM asientos WHERE tenant_id = $1',
      [tenantId]
    );
    const numero = (maxRow?.max_num ?? 0) + 1;

    const asientoId = randomUUID();
    const now = new Date();

    await db.insert('asientos', {
      id: asientoId,
      tenant_id: tenantId,
      fecha: fecha.split('T')[0],
      numero,
      glosa,
      origen: origen || 'MANUAL',
      comprobante_id: comprobanteId || null,
      estado: 'BORRADOR',
      created_at: now,
      updated_at: now,
    });

    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      await db.insert('asiento_lineas', {
        id: randomUUID(),
        asiento_id: asientoId,
        cuenta_codigo: l.cuentaCodigo,
        cuenta_nombre: l.cuentaNombre,
        debe: l.debe || 0,
        haber: l.haber || 0,
        orden: i + 1,
      });
    }

    const asiento = await db.queryOne(
      'SELECT * FROM asientos WHERE id = $1',
      [asientoId]
    );
    const lineasCreadas = await db.queryAll(
      'SELECT * FROM asiento_lineas WHERE asiento_id = $1 ORDER BY orden',
      [asientoId]
    );

    if (process.env.OLLAMA_ENABLED === 'true') {
      embeddings.store(
        tenantId,
        'asiento',
        numero,
        embeddings.buildContent('asiento', { ...asiento, lineas: lineasCreadas })
      ).catch((err) => console.error('[Embeddings] asiento store:', err));
    }

    return NextResponse.json({ data: { ...asiento, lineas: lineasCreadas } }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json(
      { message },
      { status: message.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
