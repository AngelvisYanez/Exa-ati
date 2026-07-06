import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    const { id } = await params;

    const producto = await db.queryOne<any>(
      `SELECT p.id, p.codigo, p.nombre, p.descripcion, p.precio_unitario,
              p.iva_porcentaje, p.stock, p.activo, p.created_at, p.updated_at
       FROM productos p WHERE p.id = ? AND p.tenant_id = ?`,
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

    if (body.codigo) {
      const dupe = await db.queryOne(
        'SELECT id FROM productos WHERE tenant_id = ? AND codigo = ? AND id != ?',
        [user.tenantId, body.codigo, id]
      );
      if (dupe) {
        return NextResponse.json({ message: 'Ya existe otro producto con ese código' }, { status: 409 });
      }
    }

    await db.query(
      `UPDATE productos SET
        codigo = COALESCE(?, codigo),
        nombre = COALESCE(?, nombre),
        descripcion = COALESCE(?, descripcion),
        precio_unitario = COALESCE(?, precio_unitario),
        iva_porcentaje = COALESCE(?, iva_porcentaje),
        stock = COALESCE(?, stock),
        activo = COALESCE(?, activo),
        updated_at = NOW()
       WHERE id = ?`,
      [
        body.codigo ?? null,
        body.nombre ?? null,
        body.descripcion ?? null,
        body.precioUnitario ?? null,
        body.ivaPorcentaje ?? null,
        body.stock ?? null,
        body.activo ?? null,
        id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Productos Update Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

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

    await db.query('DELETE FROM productos WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Productos Delete Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
