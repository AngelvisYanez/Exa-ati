import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { id } = await params;

    const cuenta = await db.queryOne<any>(
      `SELECT p.id, p.codigo, p.nombre, p.nivel, p.tipo, p.es_auxiliar,
              p.permite_movimiento, p.cuenta_padre_id, p.activo, p.created_at, p.updated_at
       FROM plan_cuentas p
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [parseInt(id, 10), tenantId]
    );

    if (!cuenta) {
      return NextResponse.json(
        { message: `Plan de cuenta con ID ${id} no encontrado` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: cuenta.id,
        codigo: cuenta.codigo,
        nombre: cuenta.nombre,
        nivel: cuenta.nivel,
        tipo: cuenta.tipo,
        esAuxiliar: Boolean(cuenta.es_auxiliar),
        permiteMovimiento: Boolean(cuenta.permite_movimiento),
        cuentaPadreId: cuenta.cuenta_padre_id,
        activo: Boolean(cuenta.activo),
        createdAt: cuenta.created_at,
        updatedAt: cuenta.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[Get Plan Cuenta Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { id } = await params;
    const body = await req.json();
    const numId = parseInt(id, 10);

    const cuenta = await db.queryOne<any>(
      'SELECT * FROM plan_cuentas WHERE id = $1 AND tenant_id = $2',
      [numId, tenantId]
    );
    if (!cuenta) {
      return NextResponse.json(
        { message: `Plan de cuenta con ID ${id} no encontrado` },
        { status: 404 }
      );
    }

    const { codigo, nombre, nivel, tipo, esAuxiliar, permiteMovimiento, cuentaPadreId, activo } = body;

    if (codigo && codigo !== cuenta.codigo) {
      const dup = await db.queryOne(
        'SELECT id FROM plan_cuentas WHERE tenant_id = $1 AND codigo = $2 AND id != $3',
        [tenantId, codigo, numId]
      );
      if (dup) {
        return NextResponse.json(
          { message: `Ya existe una cuenta con el código ${codigo}` },
          { status: 409 }
        );
      }
    }

    const targetNivel = nivel ?? cuenta.nivel;
    if (cuentaPadreId) {
      const padre = await db.queryOne(
        'SELECT id, nivel FROM plan_cuentas WHERE id = $1 AND tenant_id = $2',
        [cuentaPadreId, tenantId]
      );
      if (!padre) {
        return NextResponse.json(
          { message: `Cuenta padre ID ${cuentaPadreId} no encontrada` },
          { status: 400 }
        );
      }
      if (targetNivel !== padre.nivel + 1) {
        return NextResponse.json(
          { message: `El nivel debe ser ${padre.nivel + 1} para la cuenta padre seleccionada` },
          { status: 400 }
        );
      }
    }

    const updates: Record<string, any> = {};
    if (codigo !== undefined) updates.codigo = codigo;
    if (nombre !== undefined) updates.nombre = nombre;
    if (nivel !== undefined) updates.nivel = nivel;
    if (tipo !== undefined) updates.tipo = tipo;
    if (esAuxiliar !== undefined) updates.es_auxiliar = esAuxiliar;
    if (permiteMovimiento !== undefined) updates.permite_movimiento = permiteMovimiento;
    if (cuentaPadreId !== undefined) updates.cuenta_padre_id = cuentaPadreId || null;
    if (activo !== undefined) updates.activo = activo;
    updates.updated_at = new Date();

    await db.update('plan_cuentas', updates, 'id = $1', [numId]);

    const updated = await db.queryOne<any>(
      `SELECT p.id, p.codigo, p.nombre, p.nivel, p.tipo, p.es_auxiliar,
              p.permite_movimiento, p.cuenta_padre_id, p.activo, p.created_at, p.updated_at
       FROM plan_cuentas p WHERE p.id = $1`,
      [numId]
    );

    return NextResponse.json({
      data: {
        id: updated.id,
        codigo: updated.codigo,
        nombre: updated.nombre,
        nivel: updated.nivel,
        tipo: updated.tipo,
        esAuxiliar: Boolean(updated.es_auxiliar),
        permiteMovimiento: Boolean(updated.permite_movimiento),
        cuentaPadreId: updated.cuenta_padre_id,
        activo: Boolean(updated.activo),
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[Put Plan Cuenta Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { id } = await params;
    const numId = parseInt(id, 10);

    const cuenta = await db.queryOne(
      'SELECT id FROM plan_cuentas WHERE id = $1 AND tenant_id = $2',
      [numId, tenantId]
    );
    if (!cuenta) {
      return NextResponse.json(
        { message: `Plan de cuenta con ID ${id} no encontrado` },
        { status: 404 }
      );
    }

    await db.query(
      'UPDATE plan_cuentas SET activo = false, updated_at = NOW() WHERE id = $1',
      [numId]
    );

    return NextResponse.json({ message: 'Cuenta desactivada correctamente' });
  } catch (error: any) {
    console.error('[Delete Plan Cuenta Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
