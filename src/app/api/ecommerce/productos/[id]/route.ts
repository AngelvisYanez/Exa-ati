import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import { embeddings } from '@/services/sri-api/embeddings';
import {
  COLUMNAS_CATALOGO,
  CatalogoInvalido,
  CatalogoSinMigrar,
  JOIN_CATEGORIA,
  catalogoDisponible,
  leerCamposCatalogo,
} from '@/services/sri-api/catalogo-productos';

function errorCatalogo(error: unknown) {
  if (error instanceof CatalogoInvalido) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  if (error instanceof CatalogoSinMigrar) {
    return NextResponse.json({ message: error.message, code: 'CATALOGO_SIN_MIGRAR' }, { status: 503 });
  }
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    const { id } = await params;
    const conCatalogo = await catalogoDisponible();

    const producto = await db.queryOne<any>(
      `SELECT p.id, p.codigo, p.nombre, p.descripcion, p.precio_unitario,
              p.iva_porcentaje, p.stock, p.activo, p.created_at, p.updated_at
              ${conCatalogo ? `, ${COLUMNAS_CATALOGO}` : ''}
       FROM productos p ${conCatalogo ? JOIN_CATEGORIA : ''}
       WHERE p.id = ? AND p.tenant_id = ?`,
      [id, user.tenantId]
    );

    if (!producto) {
      return NextResponse.json({ message: 'Producto no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ data: producto });
  } catch (error: any) {
    console.error('[Productos Get Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    const { id } = await params;
    const body = await req.json();

    const existing = await db.queryOne(
      'SELECT id FROM productos WHERE id = ? AND tenant_id = ?',
      [id, user.tenantId]
    );
    if (!existing) {
      return NextResponse.json({ message: 'Producto no encontrado' }, { status: 404 });
    }

    const codigo = typeof body.codigo === 'string' ? body.codigo.trim() : body.codigo;
    if (codigo) {
      const dupe = await db.queryOne(
        'SELECT id FROM productos WHERE tenant_id = ? AND codigo = ? AND id != ?',
        [user.tenantId, codigo, id]
      );
      if (dupe) {
        return NextResponse.json({ message: `Ya existe otro producto con el código ${codigo}` }, { status: 409 });
      }
    }

    let precio: number | null = null;
    if (body.precioUnitario !== undefined && body.precioUnitario !== null) {
      const n = Number(body.precioUnitario);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ message: 'El precio debe ser un número mayor o igual a 0' }, { status: 400 });
      }
      precio = Math.round(n * 1e6) / 1e6;
    }

    const catalogo = await leerCamposCatalogo(user.tenantId!, body);
    const extras = Object.entries(catalogo);
    const stock = catalogo.tipo === 'servicio' ? 0 : body.stock ?? null;

    await db.query(
      `UPDATE productos SET
        codigo = COALESCE(?, codigo),
        nombre = COALESCE(?, nombre),
        descripcion = COALESCE(?, descripcion),
        precio_unitario = COALESCE(?, precio_unitario),
        iva_porcentaje = COALESCE(?, iva_porcentaje),
        stock = COALESCE(?, stock),
        activo = COALESCE(?, activo),
        ${extras.map(([columna]) => `${columna} = ?,`).join('\n        ')}
        updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [
        codigo || null,
        typeof body.nombre === 'string' ? body.nombre.trim() || null : body.nombre ?? null,
        body.descripcion ?? null,
        precio,
        body.ivaPorcentaje ?? null,
        stock,
        body.activo ?? null,
        ...extras.map(([, valor]) => valor),
        id,
        user.tenantId,
      ]
    );

    const updated = await db.queryOne<any>(
      'SELECT * FROM productos WHERE id = ? AND tenant_id = ?',
      [id, user.tenantId]
    );
    if (updated?.activo) embeddings.maybeIndex(user.tenantId!, 'producto', id, updated);
    else if (updated) embeddings.maybeUnindex(user.tenantId!, 'producto', id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const respuesta = errorCatalogo(error);
    if (respuesta) return respuesta;
    console.error('[Productos Update Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

/** Desactiva el producto: el kardex y las ventas lo siguen referenciando. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    const { id } = await params;

    const existing = await db.queryOne(
      'SELECT id FROM productos WHERE id = ? AND tenant_id = ?',
      [id, user.tenantId]
    );
    if (!existing) {
      return NextResponse.json({ message: 'Producto no encontrado' }, { status: 404 });
    }

    await db.query(
      'UPDATE productos SET activo = false, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [id, user.tenantId]
    );
    embeddings.maybeUnindex(user.tenantId!, 'producto', id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Productos Delete Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
