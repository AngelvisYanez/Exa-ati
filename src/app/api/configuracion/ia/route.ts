import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { getTenantLlmConfigMasked } from '@/lib/sri-api/tenant-llm-config';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const config = await getTenantLlmConfigMasked(tenantId);
    return NextResponse.json({ success: true, ...config });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error al obtener configuración IA' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const body = await req.json();

    const { saveTenantLlmConfig } = await import('@/lib/sri-api/tenant-llm-config');
    await saveTenantLlmConfig(tenantId, {
      provider: body.provider,
      model: body.model,
      geminiApiKey: body.geminiApiKey,
      claudeApiKey: body.claudeApiKey,
    });

    const config = await getTenantLlmConfigMasked(tenantId);
    return NextResponse.json({ success: true, message: 'Configuración IA guardada', ...config });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error al guardar configuración IA' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
