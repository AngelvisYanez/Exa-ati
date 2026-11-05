import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { listEmpleados, upsertEmpleado } from '@/services/nomina/nomina.service';
import { embeddings } from '@/services/sri-api/embeddings';
import { db } from '@/services/sri-api/db';
import { forbiddenResponse, requireModule } from '@/services/sri-api/rbac';

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, 'nomina');
    const tenantId = requireTenantId(user);

    const empleados = await listEmpleados(tenantId);
    return NextResponse.json({ success: true, data: empleados });
  } catch (error: any) {
    if (error.message?.includes('Acceso denegado')) return forbiddenResponse(error.message);
    return NextResponse.json(
      { message: error.message || 'Error al listar empleados' },
      { status: error.message?.startsWith('No autorizado') ? 401 : error.message?.includes('Acceso denegado') ? 403 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, 'nomina');
    const tenantId = requireTenantId(user);
    const body = await req.json();

    if (!body.cedula || !body.nombres || !body.apellidos || !body.sueldoBase) {
      return NextResponse.json(
        { message: 'Campos requeridos: cedula, nombres, apellidos, sueldoBase' },
        { status: 400 }
      );
    }

    const result = await upsertEmpleado(tenantId, body);
    const empleadoId = (result as any)?.id;
    if (empleadoId) {
      const row = await db.queryOne<any>('SELECT * FROM empleados WHERE id = $1', [empleadoId]);
      if (row) embeddings.maybeIndex(tenantId, 'empleado', empleadoId, row);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error.message?.includes('Acceso denegado')) return forbiddenResponse(error.message);
    return NextResponse.json(
      { message: error.message || 'Error al guardar empleado' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
