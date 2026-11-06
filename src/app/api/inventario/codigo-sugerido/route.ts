import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { requireModule } from '@/services/sri-api/rbac';
import { codigoSugerido } from '@/services/sri-api/catalogo-productos';
import { respuestaCatalogo } from '../_lib/respuesta';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, 'inventario');
    const tenantId = requireTenantId(user);
    const { searchParams } = new URL(req.url);
    const codigo = await codigoSugerido(tenantId, searchParams.get('categoriaId'), searchParams.get('tipo'));
    return NextResponse.json({ data: { codigo } });
  } catch (error) {
    return respuestaCatalogo(error, 'Codigo Sugerido Error');
  }
}
