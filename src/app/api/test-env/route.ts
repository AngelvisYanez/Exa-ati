import { NextResponse } from 'next/server';
import { verifyAuth } from '@/services/sri-api/auth-helper';
import { config } from '@/services/sri-api/config';

/**
 * Diagnóstico de entorno SRI — solo ADMIN/SUPERADMIN autenticado.
 * No exponer en producción sin auth.
 */
export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    if (!['ADMIN', 'SUPERADMIN'].includes(user.rol)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      proxyConfigured: Boolean(process.env.SRI_PROXY_HOST),
      reception: config.sri.wsdl.reception,
      authorization: config.sri.wsdl.authorization,
    });
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
