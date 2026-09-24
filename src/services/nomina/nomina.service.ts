import { randomUUID } from 'crypto';
import { db } from '@/services/sri-api/db';
import { calcularNominaEmpleado, DatosEmpleadoNomina, ResultadoNominaEmpleado } from './calculos-nomina';

export interface EmpleadoRecord {
  id?: string;
  tenantId: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  cargo?: string;
  sueldoBase: number;
  fechaIngreso?: string;
  email?: string;
  telefono?: string;
  cargasFamiliares?: number;
  acumulaDecimoTercero?: boolean;
  acumulaDecimoCuarto?: boolean;
  acumulaFondosReserva?: boolean;
  gastosPersonales?: unknown;
  activo?: boolean;
}

function empleadoToPayload(tenantId: string, data: EmpleadoRecord) {
  const now = new Date();
  return {
    tenant_id: tenantId,
    cedula: data.cedula,
    nombres: data.nombres,
    apellidos: data.apellidos,
    cargo: data.cargo ?? null,
    sueldo: data.sueldoBase,
    fecha_ingreso: data.fechaIngreso ? data.fechaIngreso.split('T')[0] : null,
    email: data.email ?? null,
    telefono: data.telefono ?? null,
    activo: data.activo ?? true,
    updated_at: now,
  };
}

export async function upsertEmpleado(tenantId: string, data: EmpleadoRecord) {
  const payload = empleadoToPayload(tenantId, data);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM empleados WHERE tenant_id = $1 AND cedula = $2',
    [tenantId, data.cedula]
  );

  if (existing) {
    return db.update('empleados', payload, 'id = $1', [existing.id], 'id');
  }

  return db.insert('empleados', {
    id: randomUUID(),
    ...payload,
    created_at: new Date(),
  }, 'id');
}

export async function listEmpleados(tenantId: string) {
  const rows = await db.queryAll<{
    id: string;
    cedula: string;
    nombres: string;
    apellidos: string;
    cargo: string | null;
    sueldo: string;
    fecha_ingreso: string | null;
    email: string | null;
    telefono: string | null;
    activo: boolean;
  }>(
    `SELECT id, cedula, nombres, apellidos, cargo, sueldo, fecha_ingreso, email, telefono, activo
     FROM empleados
     WHERE tenant_id = $1
     ORDER BY apellidos ASC, nombres ASC`,
    [tenantId]
  );

  return rows.map((r) => ({
    ...r,
    nombre_completo: `${r.apellidos || ''} ${r.nombres || ''}`.trim(),
    sueldo: Number(r.sueldo) || 0,
  }));
}

export async function loadEmpleadosParaNomina(tenantId: string): Promise<DatosEmpleadoNomina[]> {
  const rows = await db.queryAll<{
    cedula: string;
    nombres: string;
    apellidos: string;
    sueldo: string;
  }>(
    `SELECT cedula, nombres, apellidos, sueldo
     FROM empleados
     WHERE tenant_id = $1 AND activo = true
     ORDER BY apellidos ASC, nombres ASC`,
    [tenantId]
  );

  return rows.map((row) => ({
    cedula: row.cedula,
    nombreCompleto: `${row.apellidos} ${row.nombres}`.trim(),
    sueldoBase: Number(row.sueldo),
    diasTrabajados: 30,
  }));
}

export async function procesarRolMensual(
  tenantId: string,
  periodo: number,
  empleadosDatos?: DatosEmpleadoNomina[]
) {
  const empleados = empleadosDatos?.length
    ? empleadosDatos
    : await loadEmpleadosParaNomina(tenantId);

  if (empleados.length === 0) {
    throw new Error('No hay empleados activos para procesar el rol');
  }

  const resultados: { empleado: DatosEmpleadoNomina; calculo: ResultadoNominaEmpleado }[] = [];

  for (const emp of empleados) {
    const calculo = calcularNominaEmpleado(emp);
    resultados.push({ empleado: emp, calculo });

    const payload = {
      tenant_id: tenantId,
      periodo,
      cedula: emp.cedula,
      nombre_completo: emp.nombreCompleto,
      sueldo: emp.sueldoBase,
      dias_trabajados: emp.diasTrabajados ?? 30,
      aporte_patronal: calculo.aportePatronalIESS,
      aporte_individual: calculo.aporteIndividualIESS,
      valor_ccc: 0,
      fondos_reserva: calculo.fondosReserva,
      decimo_tercero: calculo.decimoTercero,
      decimo_cuarto: calculo.decimoCuarto,
      vacaciones: calculo.vacaciones,
      total_aporte: calculo.aportePatronalIESS + calculo.aporteIndividualIESS,
      sueldo_liquido: calculo.sueldoNetoAPagar,
      costo_total_empresa: calculo.costoTotalEmpresa,
      updated_at: new Date(),
    };

    const existing = await db.queryOne<{ id: string }>(
      'SELECT id FROM planillas_iess WHERE tenant_id = $1 AND periodo = $2 AND cedula = $3',
      [tenantId, periodo, emp.cedula]
    );

    if (existing) {
      await db.update('planillas_iess', payload, 'id = $1', [existing.id]);
    } else {
      await db.insert('planillas_iess', { ...payload, id: randomUUID(), created_at: new Date() });
    }
  }

  return resultados;
}
