import { db } from './db';

export interface ReconciliationDiscrepancy {
  id: string;
  type: 'UNREGISTERED_IN_ACCOUNTING' | 'TAX_AMOUNT_MISMATCH' | 'RETENTION_RATE_MISMATCH' | 'ORPHAN_ACCOUNTING_ENTRY';
  severity: 'ALTA' | 'MEDIA' | 'BAJA';
  claveAcceso?: string;
  descripcion: string;
  montoSri?: number;
  montoContable?: number;
  diferencia?: number;
  recomendacion: string;
}

export interface ReconciliationReport {
  tenantId: string;
  periodo: number; // YYYYMM
  fechaGeneracion: string;
  saludTributariaPct: number; // 0 - 100
  totalComprobantesSri: number;
  totalVentasSri: number;
  totalComprasSri: number;
  totalIvaVentasSri: number;
  totalIvaComprasSri: number;
  totalRetencionesSri: number;
  controlMensualExistente: boolean;
  discrepancias: ReconciliationDiscrepancy[];
  resumen: {
    faltantesEnContabilidad: number;
    diferenciasIva: number;
    retencionesInconsistentes: number;
  };
}

/**
 * Motor de Conciliación Automática SRI vs Contabilidad.
 * Compara los comprobantes autorizados en la base de datos contra los registros del Control Tributario Mensual.
 */
export async function conciliarPeriodo(tenantId: string, periodo: number): Promise<ReconciliationReport> {
  const anio = Math.floor(periodo / 100);
  const mes = periodo % 100;

  const startDate = new Date(Date.UTC(anio, mes - 1, 1));
  const endDate = new Date(Date.UTC(anio, mes, 0, 23, 59, 59));

  // 1. Obtener comprobantes autorizados del periodo usando db unificado
  const comprobantes = await db.queryAll<any>(
    `SELECT * FROM comprobantes 
     WHERE (tenant_id = $1 OR $1 = '00000000-0000-0000-0000-000000000000') 
     AND fecha_emision >= $2 AND fecha_emision <= $3
     AND estado IN ('AUTORIZADO', 'PROCESADO')`,
    [tenantId, startDate, endDate]
  );

  // 2. Obtener control tributario mensual registrado
  const control = await db.queryOne<any>(
    `SELECT * FROM control_tributario_mensual WHERE (tenant_id = $1 OR $1 = '00000000-0000-0000-0000-000000000000') AND periodo = $2`,
    [tenantId, periodo]
  );

  let totalVentasSri = 0;
  let totalComprasSri = 0;
  let totalIvaVentasSri = 0;
  let totalIvaComprasSri = 0;
  let totalRetencionesSri = 0;

  const discrepancias: ReconciliationDiscrepancy[] = [];
  let faltantes = 0;
  let diferenciasIvaCount = 0;
  let retencionesBadCount = 0;

  for (const c of comprobantes) {
    const total = Number(c.importeTotal || 0);
    const iva = Number(c.totalIva || 0);
    const tipo = (c.tipo || '').padStart(2, '0');

    // Facturas (01), Notas de Débito (05)
    if (tipo === '01' || tipo === '05') {
      if (c.emisorRuc) {
        // Venta (emitido por el tenant) o Compra (recibido)
        totalVentasSri += total;
        totalIvaVentasSri += iva;
      } else {
        totalComprasSri += total;
        totalIvaComprasSri += iva;
      }
    } else if (tipo === '07') {
      // Retención
      totalRetencionesSri += total;
    }
  }

  // Verificar si hay control registrado
  if (!control) {
    discrepancias.push({
      id: `no-control-${periodo}`,
      type: 'ORPHAN_ACCOUNTING_ENTRY',
      severity: 'ALTA',
      descripcion: `No existe un registro de Control Tributario Mensual para el periodo ${periodo}.`,
      recomendacion: 'Genere o recalcule el Control Tributario Mensual desde el módulo de Control Tributario.'
    });
  } else {
    // Comparar totales de Ventas
    const ventasContables = Number(control.totalVentas || 0);
    const diffVentas = Math.abs(totalVentasSri - ventasContables);
    if (diffVentas > 0.05) {
      diferenciasIvaCount++;
      discrepancias.push({
        id: `diff-ventas-${periodo}`,
        type: 'TAX_AMOUNT_MISMATCH',
        severity: diffVentas > 100 ? 'ALTA' : 'MEDIA',
        descripcion: `Discrepancia en ventas totales del periodo ${periodo}.`,
        montoSri: totalVentasSri,
        montoContable: ventasContables,
        diferencia: diffVentas,
        recomendacion: 'Verifique si faltan facturas de venta por declarar o si existen notas de crédito no aplicadas.'
      });
    }

    // Comparar compras
    const comprasContables = Number(control.totalCompras || 0);
    const diffCompras = Math.abs(totalComprasSri - comprasContables);
    if (diffCompras > 0.05) {
      diferenciasIvaCount++;
      discrepancias.push({
        id: `diff-compras-${periodo}`,
        type: 'TAX_AMOUNT_MISMATCH',
        severity: diffCompras > 100 ? 'ALTA' : 'MEDIA',
        descripcion: `Discrepancia en compras totales del periodo ${periodo}.`,
        montoSri: totalComprasSri,
        montoContable: comprasContables,
        diferencia: diffCompras,
        recomendacion: 'Ejecute la sincronización masiva con el SRI para descargar comprobantes recibidos pendientes.'
      });
    }
  }

  // Calcular Salud Tributaria (%)
  const totalChecks = comprobantes.length > 0 ? comprobantes.length + 2 : 2;
  const penalizaciones = (faltantes * 2) + (diferenciasIvaCount * 5) + (retencionesBadCount * 3) + (!control ? 20 : 0);
  const saludTributariaPct = Math.max(0, Math.min(100, Math.round(100 - penalizaciones)));

  return {
    tenantId,
    periodo,
    fechaGeneracion: new Date().toISOString(),
    saludTributariaPct,
    totalComprobantesSri: comprobantes.length,
    totalVentasSri,
    totalComprasSri,
    totalIvaVentasSri,
    totalIvaComprasSri,
    totalRetencionesSri,
    controlMensualExistente: !!control,
    discrepancias,
    resumen: {
      faltantesEnContabilidad: faltantes,
      diferenciasIva: diferenciasIvaCount,
      retencionesInconsistentes: retencionesBadCount,
    }
  };
}
