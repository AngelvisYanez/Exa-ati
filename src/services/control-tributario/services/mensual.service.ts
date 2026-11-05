import { db } from '@/services/sri-api/db'
import { calcularIVA } from '../calculos-iva'
import type { CalculoIVAResult, DatosForm104 } from '../types'

export async function upsertMensual(
  tenantId: string,
  periodo: number,
  ruc: string,
  data: Record<string, any>,
  creditoPendienteAnterior = 0,
) {
  const datosForm104: DatosForm104 = {
    ventasIva: data.ventasIva ?? 0,
    ventas0: data.ventas0 ?? 0,
    compras15: data.compras15 ?? 0,
    compras0: data.compras0 ?? 0,
    compras5: data.compras5 ?? 0,
    compras8: data.compras8 ?? 0,
    activosFijos: data.activosFijos ?? 0,
    importaciones: data.importaciones ?? 0,
    retIva20: data.retIva20 ?? 0,
    retIva30: data.retIva30 ?? 0,
    retIva70: data.retIva70 ?? 0,
    retIva100: data.retIva100 ?? 0,
  }

  const resultadoIVA = calcularIVA(datosForm104, creditoPendienteAnterior)

  const totalVentas =
    (data.ventasIva ?? 0) + (data.ventas0 ?? 0) - (data.ncVentas15 ?? 0) - (data.ncVentas0 ?? 0)

  const totalCompras =
    (data.compras15 ?? 0) + (data.compras0 ?? 0) + (data.compras5 ?? 0) + (data.compras8 ?? 0) -
    (data.ncCompras15 ?? 0) - (data.ncComprasSinIva ?? 0)

  const totalIngresos = totalVentas
  const totalGastos =
    (data.compras15 ?? 0) + (data.compras0 ?? 0) +
    (data.sueldo ?? 0) + (data.aportePatronal ?? 0) +
    (data.fondosReserva ?? 0) + (data.decimoTercero ?? 0) +
    (data.decimoCuarto ?? 0) + (data.vacaciones ?? 0) +
    (data.depreciaciones ?? 0) + (data.gastosNoDeducibles ?? 0)

  const payload = {
    tenant_id: tenantId,
    periodo,
    ruc,
    ventas_iva: data.ventasIva ?? 0,
    ventas_0: data.ventas0 ?? 0,
    nc_ventas_15: data.ncVentas15 ?? 0,
    nc_ventas_0: data.ncVentas0 ?? 0,
    ret_iva_recibida: data.retIvaRecibida ?? 0,
    ret_ir_recibida: data.retIrRecibida ?? 0,
    compras_15: data.compras15 ?? 0,
    compras_0: data.compras0 ?? 0,
    compras_5: data.compras5 ?? 0,
    compras_8: data.compras8 ?? 0,
    activos_fijos: data.activosFijos ?? 0,
    importaciones: data.importaciones ?? 0,
    nc_compras_15: data.ncCompras15 ?? 0,
    nc_compras_sin_iva: data.ncComprasSinIva ?? 0,
    ret_iva_20: data.retIva20 ?? 0,
    ret_iva_30: data.retIva30 ?? 0,
    ret_iva_70: data.retIva70 ?? 0,
    ret_iva_100: data.retIva100 ?? 0,
    ret_ir_303: data.retIr303 ?? 0,
    ret_ir_303a: data.retIr303A ?? 0,
    ret_ir_304: data.retIr304 ?? 0,
    ret_ir_307: data.retIr307 ?? 0,
    ret_ir_310: data.retIr310 ?? 0,
    ret_ir_312: data.retIr312 ?? 0,
    ret_ir_322: data.retIr322 ?? 0,
    ret_ir_332: data.retIr332 ?? 0,
    ret_ir_343: data.retIr343 ?? 0,
    ret_ir_344: data.retIr344 ?? 0,
    ret_ir_346: data.retIr346 ?? 0,
    sueldo: data.sueldo ?? 0,
    aporte_patronal: data.aportePatronal ?? 0,
    valor_ccc: data.valorCcc ?? 0,
    fondos_reserva: data.fondosReserva ?? 0,
    decimo_tercero: data.decimoTercero ?? 0,
    decimo_cuarto: data.decimoCuarto ?? 0,
    vacaciones: data.vacaciones ?? 0,
    depreciaciones: data.depreciaciones ?? 0,
    gastos_no_deducibles: data.gastosNoDeducibles ?? 0,
    total_ventas: totalVentas,
    total_compras: totalCompras,
    iva_causado: resultadoIVA.ivaCausado,
    credito_tributario: resultadoIVA.creditoTributario,
    iva_a_pagar: resultadoIVA.ivaAPagar,
    credito_pendiente: resultadoIVA.creditoPendiente,
    total_ingresos: totalIngresos,
    total_gastos: totalGastos,
    observaciones: data.observaciones ?? null,
    created_at: new Date(),
    updated_at: new Date(),
  }

  const existing = await db.queryOne(
    'SELECT id FROM control_tributario_mensual WHERE tenant_id = $1 AND periodo = $2 AND ruc = $3',
    [tenantId, periodo, ruc],
  )

  if (existing) {
    const { id, created_at, ...updateData } = payload as any
    updateData.updated_at = new Date()
    return db.update('control_tributario_mensual', updateData, 'id = $1', [existing.id])
  }

  return db.insert('control_tributario_mensual', payload)
}

export async function getMensual(tenantId: string, periodo: number, ruc: string) {
  return db.queryOne(
    'SELECT * FROM control_tributario_mensual WHERE tenant_id = $1 AND periodo = $2 AND ruc = $3',
    [tenantId, periodo, ruc],
  )
}

export async function listMensual(tenantId: string, periodo?: number) {
  const conditions = ['tenant_id = $1']
  const params: any[] = [tenantId]
  if (periodo) {
    conditions.push('periodo = $2')
    params.push(periodo)
  }
  return db.queryAll(
    `SELECT * FROM control_tributario_mensual WHERE ${conditions.join(' AND ')} ORDER BY periodo DESC`,
    params,
  )
}

export async function getCreditoPendienteAnterior(tenantId: string, ruc: string, periodo: number) {
  if (periodo < 202501) return 0
  const periodoAnterior = periodo % 100 === 1 ? periodo - 89 : periodo - 1
  const anterior = await db.queryOne(
    'SELECT credito_pendiente FROM control_tributario_mensual WHERE tenant_id = $1 AND periodo = $2 AND ruc = $3',
    [tenantId, periodoAnterior, ruc],
  )
  return anterior ? parseFloat(anterior.credito_pendiente) : 0
}

export async function recalcularPeriodoDesdeComprobantes(
  tenantId: string,
  ruc: string,
  periodo: number
) {
  const anio = Math.floor(periodo / 100);
  const mes = periodo % 100;
  const startDate = new Date(Date.UTC(anio, mes - 1, 1));
  const endDate = new Date(Date.UTC(anio, mes, 0, 23, 59, 59));

  const docs = await db.queryAll<any>(
    `SELECT * FROM comprobantes
     WHERE (tenant_id = $1 OR $1 = '00000000-0000-0000-0000-000000000000')
       AND fecha_emision >= $2 AND fecha_emision <= $3
       AND estado IN ('AUTORIZADO', 'PROCESADO')`,
    [tenantId, startDate, endDate]
  );

  let ventasIva = 0;
  let ventas0 = 0;
  let ncVentas15 = 0;
  let ncVentas0 = 0;
  let compras15 = 0;
  let compras0 = 0;
  let retIvaRecibida = 0;
  let retIrRecibida = 0;

  for (const doc of docs) {
    const tipo = (doc.tipo || '').padStart(2, '0');
    const totalSinImp = Number(doc.total_sin_impuesto || doc.subtotal_sin_impuesto || 0);
    const iva = Number(doc.total_iva || 0);
    const impTotal = Number(doc.importe_total || 0);

    const isVenta = doc.emisor_ruc === ruc;

    if (tipo === '01') {
      if (isVenta) {
        if (iva > 0) ventasIva += totalSinImp;
        else ventas0 += totalSinImp;
      } else {
        if (iva > 0) compras15 += totalSinImp;
        else compras0 += totalSinImp;
      }
    } else if (tipo === '04') {
      if (isVenta) {
        if (iva > 0) ncVentas15 += totalSinImp;
        else ncVentas0 += totalSinImp;
      }
    } else if (tipo === '07') {
      if (isVenta) {
        retIvaRecibida += iva;
        retIrRecibida += impTotal - iva;
      }
    }
  }

  const actual = (await getMensual(tenantId, periodo, ruc)) || {};
  const creditoAnterior = await getCreditoPendienteAnterior(tenantId, ruc, periodo);

  const updatedData = {
    ...actual,
    ventasIva,
    ventas0,
    ncVentas15,
    ncVentas0,
    compras15,
    compras0,
    retIvaRecibida,
    retIrRecibida,
  };

  return upsertMensual(tenantId, periodo, ruc, updatedData, creditoAnterior);
}
