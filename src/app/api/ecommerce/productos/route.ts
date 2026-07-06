import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    const { searchParams } = new URL(req.url);
    const activo = searchParams.get('activo');
    const termino = searchParams.get('termino');

    const conditions: string[] = ['p.tenant_id = ?'];
    const params: any[] = [user.tenantId];

    if (activo === 'true') {
      conditions.push('p.activo = true');
    }
    if (termino) {
      conditions.push('(p.nombre ILIKE ? OR p.codigo ILIKE ?)');
      params.push(`%${termino}%`, `%${termino}%`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const result = await db.query(
      `SELECT p.id, p.codigo, p.nombre, p.descripcion, p.precio_unitario,
              p.iva_porcentaje, p.stock, p.activo, p.created_at, p.updated_at
       FROM productos p ${where}
       ORDER BY p.nombre ASC`,
      params
    );

    return NextResponse.json({ data: result.rows });
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

    if (!body.codigo || !body.nombre || body.precioUnitario === undefined) {
      return NextResponse.json(
        { message: 'Faltan campos requeridos: codigo, nombre, precioUnitario' },
        { status: 400 }
      );
    }

    const existing = await db.queryOne(
      'SELECT id FROM productos WHERE tenant_id = ? AND codigo = ?',
      [user.tenantId, body.codigo]
    );
    if (existing) {
      return NextResponse.json(
        { message: 'Ya existe un producto con ese código' },
        { status: 409 }
      );
    }

    const result = await db.insert('productos', {
      tenant_id: user.tenantId,
      codigo: body.codigo,
      nombre: body.nombre,
      descripcion: body.descripcion || null,
      precio_unitario: body.precioUnitario,
      iva_porcentaje: body.ivaPorcentaje ?? 15,
      stock: body.stock ?? 0,
      activo: body.activo ?? true,
    });

    return NextResponse.json({ success: true, id: result?.id }, { status: 201 });
  } catch (error: any) {
    console.error('[Productos Create Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
