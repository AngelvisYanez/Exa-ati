import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { getAtsData, validateAts } from '@/services/sri-api/ats';

/** Acepta YYYYMM o YYYY-MM → número YYYYMM */
function normalizePeriodo(periodo: unknown): number | null {
  if (periodo == null || periodo === '') return null;
  const s = String(periodo).replace(/-/g, '');
  if (!/^\d{6}$/.test(s)) return null;
  const year = parseInt(s.substring(0, 4), 10);
  const month = parseInt(s.substring(4, 6), 10);
  if (year < 2000 || month < 1 || month > 12) return null;
  return parseInt(s, 10);
}

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const body = await req.json();
    const periodo = normalizePeriodo(body.periodo);

    if (!periodo) {
      return NextResponse.json(
        { message: 'periodo es obligatorio (formato YYYYMM o YYYY-MM)' },
        { status: 400 }
      );
    }

    const data = await getAtsData(tenantId, periodo);
    const validacion = validateAts(data);

    return NextResponse.json({
      data,
      validacion,
    });
  } catch (error: any) {
    console.error('[Generar ATS Preview Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      {
        status: error.message?.startsWith('No autorizado')
          ? 401
          : error.message?.includes('emisor')
            ? 400
            : 500,
      }
    );
  }
}
