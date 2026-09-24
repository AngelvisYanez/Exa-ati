import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import { embeddings } from '@/services/sri-api/embeddings';
import { forbiddenResponse, requireModule } from '@/services/sri-api/rbac';

const TIPOS_VALIDOS = ['ENTRADA', 'SALIDA', 'AJUSTE'] as const;

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, 'inventario');
    const tenantId = requireTenantId(user);
    const { searchParams } = new URL(req.url);
    const productoId = searchParams.get('productoId');
    const limite = parseInt(searchParams.get('limite') || '50', 10);

    if (!productoId) {
      return NextResponse.json({ message: 'productoId requerido' }, { status: 400 });
    }

    const movimientos = await db.queryAll(
      `SELECT m.*, p.codigo AS producto_codigo, p.nombre AS producto_nombre
       FROM inventario_movimientos m
       INNER JOIN productos p ON p.id = m.producto_id
       WHERE m.tenant_id = $1 AND m.producto_id = $2
       ORDER BY m.created_at DESC
       LIMIT $3`,
      [tenantId, productoId, limite]
    );

    return NextResponse.json({ data: movimientos });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    if (message.includes('Acceso denegado')) return forbiddenResponse(message);
    return NextResponse.json(
      { message },
      { status: message.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, 'inventario');
    const tenantId = requireTenantId(user);
    const body = await req.json();
    const { productoId, tipo, cantidad, motivo, referencia } = body as {
      productoId: string;
      tipo: string;
      cantidad: number;
      motivo?: string;
      referencia?: string;
    };

    if (!productoId || !tipo || cantidad == null) {
      return NextResponse.json(
        { message: 'productoId, tipo y cantidad son obligatorios' },
        { status: 400 }
      );
    }

    if (!TIPOS_VALIDOS.includes(tipo as typeof TIPOS_VALIDOS[number])) {
      return NextResponse.json(
        { message: 'tipo debe ser ENTRADA, SALIDA o AJUSTE' },
        { status: 400 }
      );
    }

    const qty = Number(cantidad);
    if (qty <= 0) {
      return NextResponse.json({ message: 'cantidad debe ser mayor a cero' }, { status: 400 });
    }

    const producto = await db.queryOne<{ id: string; stock: string }>(
      'SELECT id, stock FROM productos WHERE tenant_id = $1 AND id = $2',
      [tenantId, productoId]
    );

    if (!producto) {
      return NextResponse.json({ message: 'Producto no encontrado' }, { status: 404 });
    }

    const stockAntes = Number(producto.stock);
    let stockDespues: number;

    if (tipo === 'ENTRADA') {
      stockDespues = stockAntes + qty;
    } else if (tipo === 'SALIDA') {
      if (stockAntes < qty) {
        return NextResponse.json(
          { message: `Stock insuficiente (disponible: ${stockAntes})` },
          { status: 400 }
        );
      }
      stockDespues = stockAntes - qty;
    } else {
      stockDespues = qty;
    }

    const movimientoId = randomUUID();
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO inventario_movimientos
           (id, tenant_id, producto_id, tipo, cantidad, stock_antes, stock_despues, motivo, referencia, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          movimientoId,
          tenantId,
          productoId,
          tipo,
          qty,
          stockAntes,
          stockDespues,
          motivo || null,
          referencia || null,
          now,
        ]
      );
      await tx.query(
        `UPDATE productos SET stock = $1, updated_at = $2 WHERE tenant_id = $3 AND id = $4`,
        [stockDespues, now, tenantId, productoId]
      );
    });

    const movimiento = await db.queryOne(
      'SELECT * FROM inventario_movimientos WHERE id = $1',
      [movimientoId]
    );

    const productoInfo = await db.queryOne<any>(
      'SELECT codigo, nombre, stock FROM productos WHERE id = $1',
      [productoId]
    );

    embeddings.maybeIndex(tenantId, 'inventario_movimiento', movimientoId, {
      ...(movimiento as object),
      producto_codigo: productoInfo?.codigo,
      producto_nombre: productoInfo?.nombre,
    });
    if (productoInfo) {
      embeddings.maybeIndex(tenantId, 'producto', productoId, {
        id: productoId,
        ...productoInfo,
      });
    }

    return NextResponse.json({ data: movimiento }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    if (message.includes('Acceso denegado')) return forbiddenResponse(message);
    return NextResponse.json(
      { message },
      { status: message.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
