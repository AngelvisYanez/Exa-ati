import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { requireModule } from '@/services/sri-api/rbac';
import { actualizarCategoria, eliminarCategoria } from '@/services/sri-api/catalogo-productos';
import { respuestaCatalogo } from '../../_lib/respuesta';

type Contexto = { params: Promise<{ id: string }> };

/** Renombrar o activar/desactivar. */
export async function PATCH(req: Request, { params }: Contexto) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, 'inventario');
    const tenantId = requireTenantId(user);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { nombre?: unknown; activo?: unknown };
    await actualizarCategoria(tenantId, id, { nombre: body.nombre, activo: body.activo });
    return NextResponse.json({ success: true });
  } catch (error) {
    return respuestaCatalogo(error, 'Categorias Update Error');
  }
}

export async function DELETE(req: Request, { params }: Contexto) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, 'inventario');
    const tenantId = requireTenantId(user);
    const { id } = await params;
    await eliminarCategoria(tenantId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return respuestaCatalogo(error, 'Categorias Delete Error');
  }
}
