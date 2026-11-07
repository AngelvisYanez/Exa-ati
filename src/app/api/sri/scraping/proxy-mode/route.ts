import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { getScrapingUseProxy, setScrapingUseProxy } from '@/services/scraping/scraping-proxy-mode';

export async function GET(req: Request) {
  try {
    const tenantId = requireTenantId(await verifyAuth(req));
    return NextResponse.json({ success: true, useProxy: await getScrapingUseProxy(tenantId) });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    if (user.rol !== 'ADMIN' && user.rol !== 'SUPERADMIN') {
      return NextResponse.json({ success: false, message: 'Se requiere rol administrador' }, { status: 403 });
    }
    const { useProxy } = await req.json();
    if (typeof useProxy !== 'boolean') {
      return NextResponse.json({ success: false, message: 'useProxy debe ser booleano' }, { status: 400 });
    }
    await setScrapingUseProxy(tenantId, useProxy);
    return NextResponse.json({ success: true, useProxy });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
