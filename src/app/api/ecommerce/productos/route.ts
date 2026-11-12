import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import { embeddings } from '@/services/sri-api/embeddings';
import {
  COLUMNAS_CATALOGO,
  CONDICION_ESTADO,
  CatalogoInvalido,
  CatalogoSinMigrar,
  JOIN_CATEGORIA,
  catalogoDisponible,
  esEstadoStock,
  leerCamposCatalogo,
} from '@/services/sri-api/catalogo-productos';
import { randomUUID } from 'crypto';

function errorCatalogo(error: unknown) {
  if (error instanceof CatalogoInvalido) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  if (error instanceof CatalogoSinMigrar) {
    return NextResponse.json({ message: error.message, code: 'CATALOGO_SIN_MIGRAR' }, { status: 503 });
  }
  return null;
}

/** Base sin IVA con la precisión que admite el XML del SRI. */
function leerPrecio(valor: unknown): number | null {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1e6) / 1e6;
}

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    const { searchParams } = new URL(req.url);
    const activo = searchParams.get('activo');
    const termino = searchParams.get('termino')?.trim();
    const conCatalogo = await catalogoDisponible();

    const conditions: string[] = ['p.tenant_id = ?'];
    const params: unknown[] = [user.tenantId];

    if (activo === 'true') {
      conditions.push('p.activo = true');
    } else if (activo === 'false') {
      conditions.push('p.activo = false');
    }
    if (termino) {
      const patron = `%${termino.toLowerCase()}%`;
      if (conCatalogo) {
        conditions.push("(LOWER(p.nombre) LIKE ? OR LOWER(p.codigo) LIKE ? OR LOWER(COALESCE(p.codigo_barras, '')) LIKE ?)");
        params.push(patron, patron, patron);
      } else {
        conditions.push('(LOWER(p.nombre) LIKE ? OR LOWER(p.codigo) LIKE ?)');
        params.push(patron, patron);
      }
    }
    if (conCatalogo) {
      if (searchParams.get('pos') === 'true') conditions.push('p.visible_pos = true');
      const categoriaId = searchParams.get('categoriaId');
      if (categoriaId === 'sin') {
        conditions.push('p.categoria_id IS NULL');
      } else if (categoriaId) {
        conditions.push('p.categoria_id = ?');
        params.push(categoriaId);
      }
    }

    const estado = searchParams.get('estado');
    const filtroEstado = conCatalogo && esEstadoStock(estado) ? [CONDICION_ESTADO[estado]] : [];
    const where = `WHERE ${[...conditions, ...filtroEstado].join(' AND ')}`;

    const result = await db.query(
      `SELECT p.id, p.codigo, p.nombre, p.descripcion, p.precio_unitario,
              p.iva_porcentaje, p.stock, p.activo, p.created_at, p.updated_at
              ${conCatalogo ? `, ${COLUMNAS_CATALOGO}` : ''}
       FROM productos p ${conCatalogo ? JOIN_CATEGORIA : ''} ${where}
       ORDER BY p.nombre ASC`,
      params
    );

    let resumen: { total: number; disponibles: number; bajo: number; agotado: number } | undefined;
    if (searchParams.get('resumen') === 'true') {
      // Los contadores ignoran el filtro de estado para que las tarjetas no se anulen entre sí.
      const fila = await db.queryOne<Record<string, string | number | null>>(
        conCatalogo
          ? `SELECT COUNT(*) AS total,
                    COALESCE(SUM(CASE WHEN ${CONDICION_ESTADO.disponible} THEN 1 ELSE 0 END), 0) AS disponibles,
                    COALESCE(SUM(CASE WHEN ${CONDICION_ESTADO.bajo} THEN 1 ELSE 0 END), 0) AS bajo,
                    COALESCE(SUM(CASE WHEN ${CONDICION_ESTADO.agotado} THEN 1 ELSE 0 END), 0) AS agotado
               FROM productos p WHERE ${conditions.join(' AND ')}`
          : `SELECT COUNT(*) AS total,
                    COALESCE(SUM(CASE WHEN p.stock > 0 THEN 1 ELSE 0 END), 0) AS disponibles,
                    0 AS bajo,
                    COALESCE(SUM(CASE WHEN p.stock <= 0 THEN 1 ELSE 0 END), 0) AS agotado
               FROM productos p WHERE ${conditions.join(' AND ')}`,
        params
      );
      resumen = {
        total: Number(fila?.total) || 0,
        disponibles: Number(fila?.disponibles) || 0,
        bajo: Number(fila?.bajo) || 0,
        agotado: Number(fila?.agotado) || 0,
      };
    }

    return NextResponse.json({ data: result.rows, catalogo: conCatalogo, ...(resumen ? { resumen } : {}) });
  } catch (error: any) {
    console.error('[Productos List Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    const body = await req.json();

    const codigo = typeof body.codigo === 'string' ? body.codigo.trim() : body.codigo;
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : body.nombre;
    if (!codigo || !nombre || body.precioUnitario === undefined) {
      return NextResponse.json(
        { message: 'Faltan campos requeridos: codigo, nombre, precioUnitario' },
        { status: 400 }
      );
    }
    const precio = leerPrecio(body.precioUnitario);
    if (precio === null) {
      return NextResponse.json({ message: 'El precio debe ser un número mayor o igual a 0' }, { status: 400 });
    }

    const catalogo = await leerCamposCatalogo(user.tenantId!, body);
    if ((await catalogoDisponible()) && !catalogo.categoria_id) {
      return NextResponse.json({ message: 'Elige una categoría para el producto' }, { status: 400 });
    }

    const existing = await db.queryOne(
      'SELECT id FROM productos WHERE tenant_id = ? AND codigo = ?',
      [user.tenantId, codigo]
    );
    if (existing) {
      return NextResponse.json(
        { message: `Ya existe un producto con el código ${codigo}` },
        { status: 409 }
      );
    }

    const id = randomUUID();
    const stock = catalogo.tipo === 'servicio' ? 0 : body.stock ?? 0;
    const result = await db.insert('productos', {
      id,
      tenant_id: user.tenantId,
      codigo,
      nombre,
      descripcion: body.descripcion || null,
      precio_unitario: precio,
      iva_porcentaje: body.ivaPorcentaje ?? 15,
      stock,
      activo: body.activo ?? true,
      ...catalogo,
    });

    const productoId = result?.id || id;
    embeddings.maybeIndex(user.tenantId!, 'producto', productoId, {
      id: productoId,
      codigo,
      nombre,
      descripcion: body.descripcion || null,
      precio_unitario: precio,
      iva_porcentaje: body.ivaPorcentaje ?? 15,
      stock,
      activo: body.activo ?? true,
    });

    return NextResponse.json({ success: true, id: productoId }, { status: 201 });
  } catch (error: any) {
    const respuesta = errorCatalogo(error);
    if (respuesta) return respuesta;
    console.error('[Productos Create Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
