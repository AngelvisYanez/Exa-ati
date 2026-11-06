import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { requireModule } from '@/services/sri-api/rbac';
import { crearCategoria, listarCategorias } from '@/services/sri-api/catalogo-productos';
import { respuestaCatalogo } from '../_lib/respuesta';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, 'inventario');
    const tenantId = requireTenantId(user);
    const incluirInactivas = new URL(req.url).searchParams.get('inactivas') === 'true';
    const resumen = await listarCategorias(tenantId, incluirInactivas);
    return NextResponse.json({
      data: resumen.categorias,
      total: resumen.total,
      sinCategoria: resumen.sinCategoria,
    });
  } catch (error) {
    return respuestaCatalogo(error, 'Categorias List Error');
  }
}

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, 'inventario');
    const tenantId = requireTenantId(user);
    const body = (await req.json().catch(() => ({}))) as { nombre?: unknown };
    const categoria = await crearCategoria(tenantId, body.nombre);
    return NextResponse.json({ data: categoria }, { status: 201 });
  } catch (error) {
    return respuestaCatalogo(error, 'Categorias Create Error');
  }
}
