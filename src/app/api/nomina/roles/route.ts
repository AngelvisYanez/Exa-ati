import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { procesarRolMensual } from '@/services/nomina/nomina.service';
import { listPlanillas } from '@/services/control-tributario/services/planillas.service';

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { searchParams } = new URL(req.url);
    const periodoStr = searchParams.get('periodo');

    const periodo = periodoStr ? parseInt(periodoStr, 10) : undefined;
    const planillas = await listPlanillas(tenantId, periodo);

    return NextResponse.json({ success: true, data: planillas });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error al obtener roles de pago' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const body = await req.json();
    const { periodo, empleados } = body;

    if (!periodo) {
      return NextResponse.json(
        { message: 'periodo requerido' },
        { status: 400 }
      );
    }

    const resultado = await procesarRolMensual(
      tenantId,
      parseInt(String(periodo), 10),
      Array.isArray(empleados) && empleados.length > 0 ? empleados : undefined
    );
    return NextResponse.json({ success: true, data: resultado });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error al procesar el rol de pagos' },
      { status: 500 }
    );
  }
}
