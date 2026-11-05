import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { resumenAging, type AgingBucket } from '@/services/sri-api/cuentas';

const AGING_LABELS: Record<AgingBucket, string> = {
  '0-30': '0–30 días',
  '31-60': '31–60 días',
  '61-90': '61–90 días',
  '90+': '90+ días',
};

function toBucketsResponse(resumen: Record<AgingBucket, { count: number; monto: number }>) {
  const buckets = (Object.keys(resumen) as AgingBucket[]).map((key) => ({
    key,
    label: AGING_LABELS[key],
    monto: Math.round(resumen[key].monto * 100) / 100,
    cuentas: resumen[key].count,
  }));
  const total = buckets.reduce((s, b) => s + b.monto, 0);
  return { buckets, total: Math.round(total * 100) / 100, resumen };
}

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const data = await resumenAging(tenantId, 'COBRAR');
    return NextResponse.json({ success: true, ...toBucketsResponse(data) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    console.error('[CxC Aging Error]', error);
    return NextResponse.json(
      { message },
      { status: message.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
