import { db } from './db'

interface CuentaInput {
  codigo: string
  nombre: string
  nivel: number
  tipo: string
  esAuxiliar?: boolean
  permiteMovimiento?: boolean
  cuentaPadreCodigo?: string
}

const PLAN_CUENTAS_ESTANDAR: CuentaInput[] = [
  { codigo: '1', nombre: 'ACTIVO', nivel: 1, tipo: 'ACTIVO', permiteMovimiento: false },
  { codigo: '1.1', nombre: 'Activo Corriente', nivel: 2, tipo: 'ACTIVO', cuentaPadreCodigo: '1', permiteMovimiento: false },
  { codigo: '1.1.01', nombre: 'Efectivo y Equivalentes', nivel: 3, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1', permiteMovimiento: false },
  { codigo: '1.1.01.01', nombre: 'Caja', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1.01', esAuxiliar: true },
  { codigo: '1.1.01.02', nombre: 'Bancos', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1.01', esAuxiliar: true },
  { codigo: '1.1.02', nombre: 'Cuentas por Cobrar', nivel: 3, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1', permiteMovimiento: false },
  { codigo: '1.1.02.01', nombre: 'Clientes', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1.02', esAuxiliar: true },
  { codigo: '1.1.02.02', nombre: 'Cuentas por Cobrar Relacionadas', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1.02', esAuxiliar: true },
  { codigo: '1.1.02.03', nombre: 'Otras Cuentas por Cobrar', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1.02', esAuxiliar: true },
  { codigo: '1.1.02.04', nombre: 'Provisión Cuentas Incobrables', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1.02', esAuxiliar: true },
  { codigo: '1.1.03', nombre: 'Inventarios', nivel: 3, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1', permiteMovimiento: false },
  { codigo: '1.1.03.01', nombre: 'Inventario de Mercaderías', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1.03', esAuxiliar: true },
  { codigo: '1.1.03.02', nombre: 'Inventario de Materia Prima', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1.03', esAuxiliar: true },
  { codigo: '1.1.03.03', nombre: 'Inventario de Productos en Proceso', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1.03', esAuxiliar: true },
  { codigo: '1.1.03.04', nombre: 'Inventario de Productos Terminados', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1.03', esAuxiliar: true },
  { codigo: '1.1.04', nombre: 'Activos por Impuestos', nivel: 3, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1', permiteMovimiento: false },
  { codigo: '1.1.04.01', nombre: 'IVA Crédito Tributario', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1.04', esAuxiliar: true },
  { codigo: '1.1.04.02', nombre: 'Retenciones IVA', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1.04', esAuxiliar: true },
  { codigo: '1.1.04.03', nombre: 'Retenciones Renta', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1.04', esAuxiliar: true },
  { codigo: '1.1.04.04', nombre: 'Anticipo Impuesto a la Renta', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1.04', esAuxiliar: true },
  { codigo: '1.1.05', nombre: 'Otros Activos Corrientes', nivel: 3, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1', permiteMovimiento: false },
  { codigo: '1.1.05.01', nombre: 'Gastos Pagados por Anticipado', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1.05', esAuxiliar: true },
  { codigo: '1.1.05.02', nombre: 'Anticipos a Proveedores', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.1.05', esAuxiliar: true },

  { codigo: '1.2', nombre: 'Activo No Corriente', nivel: 2, tipo: 'ACTIVO', cuentaPadreCodigo: '1', permiteMovimiento: false },
  { codigo: '1.2.01', nombre: 'Propiedades, Planta y Equipo', nivel: 3, tipo: 'ACTIVO', cuentaPadreCodigo: '1.2', permiteMovimiento: false },
  { codigo: '1.2.01.01', nombre: 'Terrenos', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.2.01', esAuxiliar: true },
  { codigo: '1.2.01.02', nombre: 'Edificios', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.2.01', esAuxiliar: true },
  { codigo: '1.2.01.03', nombre: 'Maquinaria y Equipo', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.2.01', esAuxiliar: true },
  { codigo: '1.2.01.04', nombre: 'Muebles y Enseres', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.2.01', esAuxiliar: true },
  { codigo: '1.2.01.05', nombre: 'Equipo de Computación', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.2.01', esAuxiliar: true },
  { codigo: '1.2.01.06', nombre: 'Vehículos', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.2.01', esAuxiliar: true },
  { codigo: '1.2.01.07', nombre: 'Depreciación Acumulada', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.2.01', esAuxiliar: true },
  { codigo: '1.2.02', nombre: 'Activos Intangibles', nivel: 3, tipo: 'ACTIVO', cuentaPadreCodigo: '1.2', permiteMovimiento: false },
  { codigo: '1.2.02.01', nombre: 'Software y Licencias', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.2.02', esAuxiliar: true },
  { codigo: '1.2.02.02', nombre: 'Plusvalía', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.2.02', esAuxiliar: true },
  { codigo: '1.2.02.03', nombre: 'Amortización Acumulada', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.2.02', esAuxiliar: true },
  { codigo: '1.2.03', nombre: 'Otros Activos No Corrientes', nivel: 3, tipo: 'ACTIVO', cuentaPadreCodigo: '1.2', permiteMovimiento: false },
  { codigo: '1.2.03.01', nombre: 'Inversiones Permanentes', nivel: 4, tipo: 'ACTIVO', cuentaPadreCodigo: '1.2.03', esAuxiliar: true },

  { codigo: '2', nombre: 'PASIVO', nivel: 1, tipo: 'PASIVO', permiteMovimiento: false },
  { codigo: '2.1', nombre: 'Pasivo Corriente', nivel: 2, tipo: 'PASIVO', cuentaPadreCodigo: '2', permiteMovimiento: false },
  { codigo: '2.1.01', nombre: 'Cuentas por Pagar', nivel: 3, tipo: 'PASIVO', cuentaPadreCodigo: '2.1', permiteMovimiento: false },
  { codigo: '2.1.01.01', nombre: 'Proveedores', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.1.01', esAuxiliar: true },
  { codigo: '2.1.01.02', nombre: 'Cuentas por Pagar Relacionadas', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.1.01', esAuxiliar: true },
  { codigo: '2.1.01.03', nombre: 'Otras Cuentas por Pagar', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.1.01', esAuxiliar: true },
  { codigo: '2.1.02', nombre: 'Obligaciones Tributarias', nivel: 3, tipo: 'PASIVO', cuentaPadreCodigo: '2.1', permiteMovimiento: false },
  { codigo: '2.1.02.01', nombre: 'IVA Debito Fiscal', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.1.02', esAuxiliar: true },
  { codigo: '2.1.02.02', nombre: 'Retenciones IVA por Pagar', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.1.02', esAuxiliar: true },
  { codigo: '2.1.02.03', nombre: 'Retenciones Renta por Pagar', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.1.02', esAuxiliar: true },
  { codigo: '2.1.02.04', nombre: 'Impuesto a la Renta por Pagar', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.1.02', esAuxiliar: true },
  { codigo: '2.1.02.05', nombre: 'ICE por Pagar', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.1.02', esAuxiliar: true },
  { codigo: '2.1.03', nombre: 'Obligaciones Laborales', nivel: 3, tipo: 'PASIVO', cuentaPadreCodigo: '2.1', permiteMovimiento: false },
  { codigo: '2.1.03.01', nombre: 'Sueldos por Pagar', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.1.03', esAuxiliar: true },
  { codigo: '2.1.03.02', nombre: 'Décimo Tercer Sueldo', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.1.03', esAuxiliar: true },
  { codigo: '2.1.03.03', nombre: 'Décimo Cuarto Sueldo', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.1.03', esAuxiliar: true },
  { codigo: '2.1.03.04', nombre: 'IESS por Pagar', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.1.03', esAuxiliar: true },
  { codigo: '2.1.03.05', nombre: 'Fondos de Reserva', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.1.03', esAuxiliar: true },
  { codigo: '2.1.03.06', nombre: 'Participación Trabajadores por Pagar', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.1.03', esAuxiliar: true },
  { codigo: '2.1.04', nombre: 'Otros Pasivos Corrientes', nivel: 3, tipo: 'PASIVO', cuentaPadreCodigo: '2.1', permiteMovimiento: false },
  { codigo: '2.1.04.01', nombre: 'Préstamos Bancarios Corto Plazo', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.1.04', esAuxiliar: true },
  { codigo: '2.1.04.02', nombre: 'Ingresos Diferidos', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.1.04', esAuxiliar: true },
  { codigo: '2.2', nombre: 'Pasivo No Corriente', nivel: 2, tipo: 'PASIVO', cuentaPadreCodigo: '2', permiteMovimiento: false },
  { codigo: '2.2.01', nombre: 'Préstamos Bancarios Largo Plazo', nivel: 3, tipo: 'PASIVO', cuentaPadreCodigo: '2.2', permiteMovimiento: false },
  { codigo: '2.2.01.01', nombre: 'Préstamos Largo Plazo', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.2.01', esAuxiliar: true },
  { codigo: '2.2.02', nombre: 'Otros Pasivos No Corrientes', nivel: 3, tipo: 'PASIVO', cuentaPadreCodigo: '2.2', permiteMovimiento: false },
  { codigo: '2.2.02.01', nombre: 'Cuentas por Pagar Largo Plazo', nivel: 4, tipo: 'PASIVO', cuentaPadreCodigo: '2.2.02', esAuxiliar: true },

  { codigo: '3', nombre: 'PATRIMONIO', nivel: 1, tipo: 'PATRIMONIO', permiteMovimiento: false },
  { codigo: '3.1', nombre: 'Capital', nivel: 2, tipo: 'PATRIMONIO', cuentaPadreCodigo: '3', permiteMovimiento: false },
  { codigo: '3.1.01', nombre: 'Capital Social', nivel: 3, tipo: 'PATRIMONIO', cuentaPadreCodigo: '3.1', esAuxiliar: true },
  { codigo: '3.1.02', nombre: 'Aportes para Capitalización', nivel: 3, tipo: 'PATRIMONIO', cuentaPadreCodigo: '3.1', esAuxiliar: true },
  { codigo: '3.2', nombre: 'Reservas', nivel: 2, tipo: 'PATRIMONIO', cuentaPadreCodigo: '3', permiteMovimiento: false },
  { codigo: '3.2.01', nombre: 'Reserva Legal', nivel: 3, tipo: 'PATRIMONIO', cuentaPadreCodigo: '3.2', esAuxiliar: true },
  { codigo: '3.2.02', nombre: 'Reserva Facultativa', nivel: 3, tipo: 'PATRIMONIO', cuentaPadreCodigo: '3.2', esAuxiliar: true },
  { codigo: '3.3', nombre: 'Resultados', nivel: 2, tipo: 'PATRIMONIO', cuentaPadreCodigo: '3', permiteMovimiento: false },
  { codigo: '3.3.01', nombre: 'Utilidades Retenidas', nivel: 3, tipo: 'PATRIMONIO', cuentaPadreCodigo: '3.3', esAuxiliar: true },
  { codigo: '3.3.02', nombre: 'Resultados del Ejercicio', nivel: 3, tipo: 'PATRIMONIO', cuentaPadreCodigo: '3.3', esAuxiliar: true },
  { codigo: '3.3.03', nombre: 'Pérdidas Acumuladas', nivel: 3, tipo: 'PATRIMONIO', cuentaPadreCodigo: '3.3', esAuxiliar: true },

  { codigo: '4', nombre: 'INGRESOS', nivel: 1, tipo: 'INGRESOS', permiteMovimiento: false },
  { codigo: '4.1', nombre: 'Ingresos Operacionales', nivel: 2, tipo: 'INGRESOS', cuentaPadreCodigo: '4', permiteMovimiento: false },
  { codigo: '4.1.01', nombre: 'Ventas', nivel: 3, tipo: 'INGRESOS', cuentaPadreCodigo: '4.1', esAuxiliar: true },
  { codigo: '4.1.01.01', nombre: 'Ventas 12% IVA', nivel: 4, tipo: 'INGRESOS', cuentaPadreCodigo: '4.1.01', esAuxiliar: true },
  { codigo: '4.1.01.02', nombre: 'Ventas 0% IVA', nivel: 4, tipo: 'INGRESOS', cuentaPadreCodigo: '4.1.01', esAuxiliar: true },
  { codigo: '4.1.01.03', nombre: 'Ventas Exportación', nivel: 4, tipo: 'INGRESOS', cuentaPadreCodigo: '4.1.01', esAuxiliar: true },
  { codigo: '4.1.02', nombre: 'Descuentos y Devoluciones en Ventas', nivel: 3, tipo: 'INGRESOS', cuentaPadreCodigo: '4.1', esAuxiliar: true },
  { codigo: '4.2', nombre: 'Ingresos No Operacionales', nivel: 2, tipo: 'INGRESOS', cuentaPadreCodigo: '4', permiteMovimiento: false },
  { codigo: '4.2.01', nombre: 'Ingresos Financieros', nivel: 3, tipo: 'INGRESOS', cuentaPadreCodigo: '4.2', esAuxiliar: true },
  { codigo: '4.2.02', nombre: 'Otros Ingresos', nivel: 3, tipo: 'INGRESOS', cuentaPadreCodigo: '4.2', esAuxiliar: true },

  { codigo: '5', nombre: 'GASTOS', nivel: 1, tipo: 'GASTOS', permiteMovimiento: false },
  { codigo: '5.1', nombre: 'Costo de Ventas', nivel: 2, tipo: 'GASTOS', cuentaPadreCodigo: '5', permiteMovimiento: false },
  { codigo: '5.1.01', nombre: 'Compras', nivel: 3, tipo: 'GASTOS', cuentaPadreCodigo: '5.1', esAuxiliar: true },
  { codigo: '5.1.01.01', nombre: 'Compras 12% IVA', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.1.01', esAuxiliar: true },
  { codigo: '5.1.01.02', nombre: 'Compras 0% IVA', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.1.01', esAuxiliar: true },
  { codigo: '5.1.02', nombre: 'Inventario Inicial', nivel: 3, tipo: 'GASTOS', cuentaPadreCodigo: '5.1', esAuxiliar: true },
  { codigo: '5.1.03', nombre: 'Inventario Final', nivel: 3, tipo: 'GASTOS', cuentaPadreCodigo: '5.1', esAuxiliar: true },
  { codigo: '5.2', nombre: 'Gastos Operativos', nivel: 2, tipo: 'GASTOS', cuentaPadreCodigo: '5', permiteMovimiento: false },
  { codigo: '5.2.01', nombre: 'Gastos Administrativos', nivel: 3, tipo: 'GASTOS', cuentaPadreCodigo: '5.2', permiteMovimiento: false },
  { codigo: '5.2.01.01', nombre: 'Sueldos y Salarios', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.2.01', esAuxiliar: true },
  { codigo: '5.2.01.02', nombre: 'Beneficios Sociales', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.2.01', esAuxiliar: true },
  { codigo: '5.2.01.03', nombre: 'Aporte IESS', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.2.01', esAuxiliar: true },
  { codigo: '5.2.01.04', nombre: 'Honorarios Profesionales', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.2.01', esAuxiliar: true },
  { codigo: '5.2.01.05', nombre: 'Arrendamientos', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.2.01', esAuxiliar: true },
  { codigo: '5.2.01.06', nombre: 'Servicios Básicos', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.2.01', esAuxiliar: true },
  { codigo: '5.2.01.07', nombre: 'Suministros y Materiales', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.2.01', esAuxiliar: true },
  { codigo: '5.2.01.08', nombre: 'Depreciaciones', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.2.01', esAuxiliar: true },
  { codigo: '5.2.01.09', nombre: 'Amortizaciones', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.2.01', esAuxiliar: true },
  { codigo: '5.2.01.10', nombre: 'Mantenimiento y Reparaciones', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.2.01', esAuxiliar: true },
  { codigo: '5.2.01.11', nombre: 'Otros Gastos Administrativos', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.2.01', esAuxiliar: true },
  { codigo: '5.2.02', nombre: 'Gastos de Ventas', nivel: 3, tipo: 'GASTOS', cuentaPadreCodigo: '5.2', permiteMovimiento: false },
  { codigo: '5.2.02.01', nombre: 'Publicidad y Propaganda', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.2.02', esAuxiliar: true },
  { codigo: '5.2.02.02', nombre: 'Transporte y Logística', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.2.02', esAuxiliar: true },
  { codigo: '5.2.03', nombre: 'Gastos Financieros', nivel: 3, tipo: 'GASTOS', cuentaPadreCodigo: '5.2', permiteMovimiento: false },
  { codigo: '5.2.03.01', nombre: 'Intereses Bancarios', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.2.03', esAuxiliar: true },
  { codigo: '5.2.03.02', nombre: 'Comisiones Bancarias', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.2.03', esAuxiliar: true },
  { codigo: '5.2.04', nombre: 'Gastos No Deducibles', nivel: 3, tipo: 'GASTOS', cuentaPadreCodigo: '5.2', permiteMovimiento: false },
  { codigo: '5.2.04.01', nombre: 'Multas e Intereses', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.2.04', esAuxiliar: true },
  { codigo: '5.2.04.02', nombre: 'Otros Gastos No Deducibles', nivel: 4, tipo: 'GASTOS', cuentaPadreCodigo: '5.2.04', esAuxiliar: true },
]

function buildTree(cuentas: CuentaInput[]): CuentaInput[] {
  const map = new Map<string, CuentaInput>()
  for (const c of cuentas) map.set(c.codigo, c)

  const raices: CuentaInput[] = []
  for (const c of cuentas) {
    if (c.cuentaPadreCodigo && map.has(c.cuentaPadreCodigo)) {
      map.get(c.cuentaPadreCodigo)!.cuentaPadreCodigo = c.cuentaPadreCodigo
    }
    if (!c.cuentaPadreCodigo) raices.push(c)
  }
  return raices
}

export function getPlanCuentasEstandar(): CuentaInput[] {
  return PLAN_CUENTAS_ESTANDAR
}

export async function createPlanCuentasEstandar(tenantId: string): Promise<any[]> {
  const existing = await db.queryOne(
    'SELECT id FROM plan_cuentas WHERE tenant_id = $1 LIMIT 1',
    [tenantId]
  )
  if (existing) throw new Error('El tenant ya tiene un plan de cuentas cargado')

  const created: any[] = []
  const codigoToId = new Map<string, number>()

  for (const c of PLAN_CUENTAS_ESTANDAR) {
    const cuenta = await db.queryOne<any>(
      `INSERT INTO plan_cuentas (tenant_id, codigo, nombre, nivel, tipo, es_auxiliar, permite_movimiento, cuenta_padre_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [
        tenantId,
        c.codigo,
        c.nombre,
        c.nivel,
        c.tipo,
        c.esAuxiliar ?? false,
        c.permiteMovimiento ?? true,
        c.cuentaPadreCodigo ? codigoToId.get(c.cuentaPadreCodigo) : null,
      ]
    )
    codigoToId.set(c.codigo, cuenta.id)
    created.push(cuenta)
  }

  return created
}
