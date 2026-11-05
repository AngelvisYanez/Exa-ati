import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/services/sri-api/auth-helper';
import { conciliarPeriodo } from '@/services/sri-api/reconciler';

export async function GET(req: NextRequest) {
  let authUser;
  try {
    authUser = await verifyAuth(req);
    if (!authUser.tenantId) {
      return NextResponse.json({ error: 'Acceso denegado: El usuario no tiene tenant asignado' }, { status: 403 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const periodoStr = searchParams.get('periodo');

  if (!periodoStr || isNaN(Number(periodoStr))) {
    return NextResponse.json({ error: 'El parámetro periodo es requerido y debe ser numérico (YYYYMM)' }, { status: 400 });
  }

  try {
    const report = await conciliarPeriodo(authUser.tenantId, Number(periodoStr));
    return NextResponse.json({ success: true, data: report });
  } catch (error: any) {
    console.error('Error al generar conciliación:', error);
    return NextResponse.json({ error: error.message || 'Error al ejecutar conciliación' }, { status: 500 });
  }
}
