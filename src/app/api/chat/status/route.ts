import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { resolveLlmForTenant } from '@/lib/sri-api/llm-client';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const resolved = await resolveLlmForTenant(tenantId);

    return NextResponse.json({
      success: true,
      available: !!resolved.provider,
      provider: resolved.provider,
      model: resolved.model,
      source: resolved.tenantConfig ? 'tenant' : resolved.provider ? 'env' : 'none',
    });
  } catch (error: any) {
    return NextResponse.json(
      { available: false, message: error.message },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
