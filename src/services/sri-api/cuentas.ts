/**
 * cuentas.ts — Lógica de Cuentas por Cobrar (CxC) y Cuentas por Pagar (CxP)
 *
 * Proporciona:
 * - Auto-creación de cuentas al emitir facturas a crédito o liquidaciones de compra.
 * - Registro de pagos/abonos con actualización de saldo y estado.
 * - Listado, resumen y marcado de cuentas vencidas.
 */

import { randomUUID } from 'crypto';
import { db } from './db';

export type TipoCuenta = 'COBRAR' | 'PAGAR';

export interface CuentaDatos {
  contactoId?: string | null;
  tipoIdentificacion?: string | null;
  identificacion?: string | null;
  nombre?: string | null;
  email?: string | null;
  tipoDocumento?: string;
  numeroDocumento?: string | null;
  fechaEmision: string | Date;
  fechaVencimiento?: string | Date | null;
  monto: number;
  notas?: string | null;
  comprobanteId?: string | null;
}

export interface PagoDatos {
  fecha: string | Date;
  monto: number;
  metodoPago?: string | null;
  referencia?: string | null;
  notas?: string | null;
}

const TABLA_CXC = 'cuentas_por_cobrar';
const TABLA_CXP = 'cuentas_por_pagar';
const TABLA_PAGOS = 'pagos_cuentas';

// ─────────────────────────────────────────────────────────────────────────────
// Tablas (auto-migración idempotente; no falla si ya existen)
// ─────────────────────────────────────────────────────────────────────────────
export async function ensureCuentasTables(): Promise<void> {
  if (process.env.DATABASE_URL) {
    // PostgreSQL / Neon
    await db
      .query(
        `CREATE TABLE IF NOT EXISTS cuentas_por_cobrar (
          id UUID NOT NULL,
          tenant_id UUID NOT NULL,
          contacto_id UUID,
          comprobante_id UUID,
          cliente_tipo_id VARCHAR(5),
          cliente_identificacion VARCHAR(20),
          cliente_nombre VARCHAR(500),
          cliente_email VARCHAR(255),
          tipo_documento VARCHAR(5) NOT NULL DEFAULT '01',
          numero_documento VARCHAR(30),
          fecha_emision DATE NOT NULL,
          fecha_vencimiento DATE,
          monto_original DECIMAL(14,2) NOT NULL,
          saldo_pendiente DECIMAL(14,2) NOT NULL,
          estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
          notas TEXT,
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        )`
      )
      .catch(() => {});
    await db
      .query(
        `CREATE TABLE IF NOT EXISTS cuentas_por_pagar (
          id UUID NOT NULL,
          tenant_id UUID NOT NULL,
          contacto_id UUID,
          comprobante_id UUID,
          proveedor_tipo_id VARCHAR(5),
          proveedor_identificacion VARCHAR(20),
          proveedor_nombre VARCHAR(500),
          proveedor_email VARCHAR(255),
          tipo_documento VARCHAR(5) NOT NULL DEFAULT '01',
          numero_documento VARCHAR(30),
          fecha_emision DATE NOT NULL,
          fecha_vencimiento DATE,
          monto_original DECIMAL(14,2) NOT NULL,
          saldo_pendiente DECIMAL(14,2) NOT NULL,
          estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
          notas TEXT,
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        )`
      )
      .catch(() => {});
    await db
      .query(
        `CREATE TABLE IF NOT EXISTS pagos_cuentas (
          id UUID NOT NULL,
          tenant_id UUID NOT NULL,
          tipo_cuenta VARCHAR(10) NOT NULL,
          cuenta_cobrar_id UUID,
          cuenta_pagar_id UUID,
          fecha DATE NOT NULL,
          monto DECIMAL(14,2) NOT NULL,
          metodo_pago VARCHAR(50),
          referencia VARCHAR(100),
          notas TEXT,
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        )`
      )
      .catch(() => {});
  } else {
    // MySQL / desarrollo
    await db
      .query(
        `CREATE TABLE IF NOT EXISTS cuentas_por_cobrar (
          id CHAR(36) NOT NULL PRIMARY KEY,
          tenant_id CHAR(36) NOT NULL,
          contacto_id CHAR(36),
          comprobante_id CHAR(36),
          cliente_tipo_id VARCHAR(5),
          cliente_identificacion VARCHAR(20),
          cliente_nombre VARCHAR(500),
          cliente_email VARCHAR(255),
          tipo_documento VARCHAR(5) NOT NULL DEFAULT '01',
          numero_documento VARCHAR(30),
          fecha_emision DATE NOT NULL,
          fecha_vencimiento DATE,
          monto_original DECIMAL(14,2) NOT NULL,
          saldo_pendiente DECIMAL(14,2) NOT NULL,
          estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
          notas TEXT,
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      )
      .catch(() => {});
    await db
      .query(
        `CREATE TABLE IF NOT EXISTS cuentas_por_pagar (
          id CHAR(36) NOT NULL PRIMARY KEY,
          tenant_id CHAR(36) NOT NULL,
          contacto_id CHAR(36),
          comprobante_id CHAR(36),
          proveedor_tipo_id VARCHAR(5),
          proveedor_identificacion VARCHAR(20),
          proveedor_nombre VARCHAR(500),
          proveedor_email VARCHAR(255),
          tipo_documento VARCHAR(5) NOT NULL DEFAULT '01',
          numero_documento VARCHAR(30),
          fecha_emision DATE NOT NULL,
          fecha_vencimiento DATE,
          monto_original DECIMAL(14,2) NOT NULL,
          saldo_pendiente DECIMAL(14,2) NOT NULL,
          estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
          notas TEXT,
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      )
      .catch(() => {});
    await db
      .query(
        `CREATE TABLE IF NOT EXISTS pagos_cuentas (
          id CHAR(36) NOT NULL PRIMARY KEY,
          tenant_id CHAR(36) NOT NULL,
          tipo_cuenta VARCHAR(10) NOT NULL,
          cuenta_cobrar_id CHAR(36),
          cuenta_pagar_id CHAR(36),
          fecha DATE NOT NULL,
          monto DECIMAL(14,2) NOT NULL,
          metodo_pago VARCHAR(50),
          referencia VARCHAR(100),
          notas TEXT,
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      )
      .catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado de una cuenta según su saldo
// ─────────────────────────────────────────────────────────────────────────────
function estadoPorSaldo(saldo: number, vencida: boolean): string {
  if (saldo <= 0.004) return 'PAGADO';
  if (vencida) return 'VENCIDO';
  return 'PARCIAL';
}

function esVencida(fechaVencimiento: string | Date | null | undefined): boolean {
  if (!fechaVencimiento) return false;
  const venc = new Date(fechaVencimiento);
  if (isNaN(venc.getTime())) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return venc.getTime() < hoy.getTime();
}

function aFecha(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString().split('T')[0];
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toISOString().split('T')[0];
}

function sumarDias(fecha: string | Date, dias: number): string {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// CUENTAS POR COBRAR
// ─────────────────────────────────────────────────────────────────────────────
export async function crearCuentaPorCobrar(
  tenantId: string,
  data: CuentaDatos
): Promise<any> {
  await ensureCuentasTables();
  const hoy = new Date();
  const fechaEmision = aFecha(data.fechaEmision);
  const fechaVencimiento = data.fechaVencimiento
    ? aFecha(data.fechaVencimiento)
    : null;

  const payload = {
    id: randomUUID(),
    tenant_id: tenantId,
    contacto_id: data.contactoId || null,
    comprobante_id: data.comprobanteId || null,
    cliente_tipo_id: data.tipoIdentificacion || null,
    cliente_identificacion: data.identificacion || null,
    cliente_nombre: data.nombre || null,
    cliente_email: data.email || null,
    tipo_documento: data.tipoDocumento || '01',
    numero_documento: data.numeroDocumento || null,
    fecha_emision: fechaEmision,
    fecha_vencimiento: fechaVencimiento,
    monto_original: data.monto,
    saldo_pendiente: data.monto,
    estado: 'PENDIENTE',
    notas: data.notas || null,
    created_at: hoy,
    updated_at: hoy,
  };

  return db.insert(TABLA_CXC, payload, 'id');
}

export async function listarCuentasPorCobrar(
  tenantId: string,
  filters: {
    estado?: string;
    identificacion?: string;
    desde?: string;
    hasta?: string;
    limite?: number;
    offset?: number;
  } = {}
): Promise<{ rows: any[]; total: number }> {
  await ensureCuentasTables();
  const conditions: string[] = ['cxc.tenant_id = $1'];
  const params: any[] = [tenantId];

  if (filters.estado && filters.estado !== 'TODOS') {
    conditions.push('cxc.estado = $' + (params.length + 1));
    params.push(filters.estado);
  }
  if (filters.identificacion) {
    conditions.push('cxc.cliente_identificacion = $' + (params.length + 1));
    params.push(filters.identificacion);
  }
  if (filters.desde) {
    conditions.push('cxc.fecha_emision >= $' + (params.length + 1));
    params.push(filters.desde);
  }
  if (filters.hasta) {
    conditions.push('cxc.fecha_emision <= $' + (params.length + 1));
    params.push(filters.hasta);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const limite = filters.limite ?? 100;
  const offset = filters.offset ?? 0;

  const countRes = await db.queryOne<any>(
    `SELECT COUNT(*) AS total FROM cuentas_por_cobrar cxc ${where}`,
    params
  );
  const total = parseInt(countRes?.total ?? '0', 10);

  const rows = await db.queryAll<any>(
    `SELECT cxc.*,
            COALESCE(c.pago_total, 0) AS pago_total
     FROM cuentas_por_cobrar cxc
     LEFT JOIN (
        SELECT cuenta_cobrar_id, SUM(monto) AS pago_total
        FROM pagos_cuentas
        WHERE tipo_cuenta = 'COBRAR' AND cuenta_cobrar_id IS NOT NULL
        GROUP BY cuenta_cobrar_id
     ) c ON c.cuenta_cobrar_id = cxc.id
     ${where}
     ORDER BY cxc.fecha_emision DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limite, offset]
  );

  return { rows, total };
}

export async function obtenerCuentaPorCobrar(tenantId: string, id: string): Promise<any | null> {
  await ensureCuentasTables();
  return db.queryOne<any>(
    `SELECT * FROM cuentas_por_cobrar WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id]
  );
}

export async function listarPagosCuenta(tipo: TipoCuenta, cuentaId: string): Promise<any[]> {
  await ensureCuentasTables();
  const col = tipo === 'COBRAR' ? 'cuenta_cobrar_id' : 'cuenta_pagar_id';
  return db.queryAll<any>(
    `SELECT * FROM pagos_cuentas WHERE tipo_cuenta = $1 AND ${col} = $2 ORDER BY fecha DESC`,
    [tipo, cuentaId]
  );
}

export async function registrarPagoCobrar(
  tenantId: string,
  cuentaId: string,
  pago: PagoDatos
): Promise<any> {
  await ensureCuentasTables();
  if (!pago.monto || pago.monto <= 0) {
    throw new Error('El monto del pago debe ser mayor a cero');
  }

  const cuenta = await obtenerCuentaPorCobrar(tenantId, cuentaId);
  if (!cuenta) throw new Error('Cuenta por cobrar no encontrada');
  if (cuenta.estado === 'ANULADO') throw new Error('La cuenta está anulada');
  if (cuenta.estado === 'PAGADO') throw new Error('La cuenta ya está pagada');

  const monto = Math.min(Number(pago.monto), Number(cuenta.saldo_pendiente));
  const nuevoSaldo = Math.max(0, Number(cuenta.saldo_pendiente) - monto);

  const ahora = new Date();
  await db.insert(
    TABLA_PAGOS,
    {
      id: randomUUID(),
      tenant_id: tenantId,
      tipo_cuenta: 'COBRAR',
      cuenta_cobrar_id: cuentaId,
      cuenta_pagar_id: null,
      fecha: aFecha(pago.fecha),
      monto,
      metodo_pago: pago.metodoPago || null,
      referencia: pago.referencia || null,
      notas: pago.notas || null,
      created_at: ahora,
      updated_at: ahora,
    },
    'id'
  );

  const estado = nuevoSaldo <= 0.004
    ? 'PAGADO'
    : esVencida(cuenta.fecha_vencimiento)
      ? 'VENCIDO'
      : 'PARCIAL';

  await db.update(
    TABLA_CXC,
    { saldo_pendiente: nuevoSaldo, estado, updated_at: ahora },
    'tenant_id = $1 AND id = $2',
    [tenantId, cuentaId]
  );

  return { cuentaId, saldoPendiente: nuevoSaldo, estado, montoAplicado: monto };
}

export async function anularCuentaPorCobrar(tenantId: string, id: string): Promise<void> {
  await db.update(
    TABLA_CXC,
    { estado: 'ANULADO', updated_at: new Date() },
    'tenant_id = $1 AND id = $2',
    [tenantId, id]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CUENTAS POR PAGAR
// ─────────────────────────────────────────────────────────────────────────────
export async function crearCuentaPorPagar(
  tenantId: string,
  data: CuentaDatos
): Promise<any> {
  await ensureCuentasTables();
  const hoy = new Date();
  const fechaEmision = aFecha(data.fechaEmision);
  const fechaVencimiento = data.fechaVencimiento
    ? aFecha(data.fechaVencimiento)
    : null;

  const payload = {
    id: randomUUID(),
    tenant_id: tenantId,
    contacto_id: data.contactoId || null,
    comprobante_id: data.comprobanteId || null,
    proveedor_tipo_id: data.tipoIdentificacion || null,
    proveedor_identificacion: data.identificacion || null,
    proveedor_nombre: data.nombre || null,
    proveedor_email: data.email || null,
    tipo_documento: data.tipoDocumento || '01',
    numero_documento: data.numeroDocumento || null,
    fecha_emision: fechaEmision,
    fecha_vencimiento: fechaVencimiento,
    monto_original: data.monto,
    saldo_pendiente: data.monto,
    estado: 'PENDIENTE',
    notas: data.notas || null,
    created_at: hoy,
    updated_at: hoy,
  };

  return db.insert(TABLA_CXP, payload, 'id');
}

export async function listarCuentasPorPagar(
  tenantId: string,
  filters: {
    estado?: string;
    identificacion?: string;
    desde?: string;
    hasta?: string;
    limite?: number;
    offset?: number;
  } = {}
): Promise<{ rows: any[]; total: number }> {
  await ensureCuentasTables();
  const conditions: string[] = ['cxp.tenant_id = $1'];
  const params: any[] = [tenantId];

  if (filters.estado && filters.estado !== 'TODOS') {
    conditions.push('cxp.estado = $' + (params.length + 1));
    params.push(filters.estado);
  }
  if (filters.identificacion) {
    conditions.push('cxp.proveedor_identificacion = $' + (params.length + 1));
    params.push(filters.identificacion);
  }
  if (filters.desde) {
    conditions.push('cxp.fecha_emision >= $' + (params.length + 1));
    params.push(filters.desde);
  }
  if (filters.hasta) {
    conditions.push('cxp.fecha_emision <= $' + (params.length + 1));
    params.push(filters.hasta);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const limite = filters.limite ?? 100;
  const offset = filters.offset ?? 0;

  const countRes = await db.queryOne<any>(
    `SELECT COUNT(*) AS total FROM cuentas_por_pagar cxp ${where}`,
    params
  );
  const total = parseInt(countRes?.total ?? '0', 10);

  const rows = await db.queryAll<any>(
    `SELECT cxp.*,
            COALESCE(c.pago_total, 0) AS pago_total
     FROM cuentas_por_pagar cxp
     LEFT JOIN (
        SELECT cuenta_pagar_id, SUM(monto) AS pago_total
        FROM pagos_cuentas
        WHERE tipo_cuenta = 'PAGAR' AND cuenta_pagar_id IS NOT NULL
        GROUP BY cuenta_pagar_id
     ) c ON c.cuenta_pagar_id = cxp.id
     ${where}
     ORDER BY cxp.fecha_emision DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limite, offset]
  );

  return { rows, total };
}

export async function obtenerCuentaPorPagar(tenantId: string, id: string): Promise<any | null> {
  await ensureCuentasTables();
  return db.queryOne<any>(
    `SELECT * FROM cuentas_por_pagar WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id]
  );
}

export async function registrarPagoPagar(
  tenantId: string,
  cuentaId: string,
  pago: PagoDatos
): Promise<any> {
  await ensureCuentasTables();
  if (!pago.monto || pago.monto <= 0) {
    throw new Error('El monto del pago debe ser mayor a cero');
  }

  const cuenta = await obtenerCuentaPorPagar(tenantId, cuentaId);
  if (!cuenta) throw new Error('Cuenta por pagar no encontrada');
  if (cuenta.estado === 'ANULADO') throw new Error('La cuenta está anulada');
  if (cuenta.estado === 'PAGADO') throw new Error('La cuenta ya está pagada');

  const monto = Math.min(Number(pago.monto), Number(cuenta.saldo_pendiente));
  const nuevoSaldo = Math.max(0, Number(cuenta.saldo_pendiente) - monto);

  const ahora = new Date();
  await db.insert(
    TABLA_PAGOS,
    {
      id: randomUUID(),
      tenant_id: tenantId,
      tipo_cuenta: 'PAGAR',
      cuenta_cobrar_id: null,
      cuenta_pagar_id: cuentaId,
      fecha: aFecha(pago.fecha),
      monto,
      metodo_pago: pago.metodoPago || null,
      referencia: pago.referencia || null,
      notas: pago.notas || null,
      created_at: ahora,
      updated_at: ahora,
    },
    'id'
  );

  const estado = nuevoSaldo <= 0.004
    ? 'PAGADO'
    : esVencida(cuenta.fecha_vencimiento)
      ? 'VENCIDO'
      : 'PARCIAL';

  await db.update(
    TABLA_CXP,
    { saldo_pendiente: nuevoSaldo, estado, updated_at: ahora },
    'tenant_id = $1 AND id = $2',
    [tenantId, cuentaId]
  );

  return { cuentaId, saldoPendiente: nuevoSaldo, estado, montoAplicado: monto };
}

export async function anularCuentaPorPagar(tenantId: string, id: string): Promise<void> {
  await db.update(
    TABLA_CXP,
    { estado: 'ANULADO', updated_at: new Date() },
    'tenant_id = $1 AND id = $2',
    [tenantId, id]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumen general para dashboards
// ─────────────────────────────────────────────────────────────────────────────
export async function obtenerResumenCuentas(tenantId: string): Promise<any> {
  await ensureCuentasTables();
  const cxc = await db.queryOne<any>(
    `SELECT
       COUNT(*) AS total_cuentas,
       COALESCE(SUM(saldo_pendiente), 0) AS saldo_total,
       COALESCE(SUM(CASE WHEN estado IN ('PENDIENTE','PARCIAL','VENCIDO') THEN saldo_pendiente ELSE 0 END), 0) AS saldo_por_cobrar,
       COALESCE(SUM(CASE WHEN estado = 'VENCIDO' THEN saldo_pendiente ELSE 0 END), 0) AS saldo_vencido,
       SUM(CASE WHEN estado IN ('PENDIENTE','PARCIAL','VENCIDO') THEN 1 ELSE 0 END) AS pendientes
     FROM cuentas_por_cobrar WHERE tenant_id = $1`,
    [tenantId]
  );
  const cxp = await db.queryOne<any>(
    `SELECT
       COUNT(*) AS total_cuentas,
       COALESCE(SUM(saldo_pendiente), 0) AS saldo_total,
       COALESCE(SUM(CASE WHEN estado IN ('PENDIENTE','PARCIAL','VENCIDO') THEN saldo_pendiente ELSE 0 END), 0) AS saldo_por_pagar,
       COALESCE(SUM(CASE WHEN estado = 'VENCIDO' THEN saldo_pendiente ELSE 0 END), 0) AS saldo_vencido,
       SUM(CASE WHEN estado IN ('PENDIENTE','PARCIAL','VENCIDO') THEN 1 ELSE 0 END) AS pendientes
     FROM cuentas_por_pagar WHERE tenant_id = $1`,
    [tenantId]
  );

  const toNum = (v: any) => Number(v ?? 0);

  return {
    porCobrar: {
      totalCuentas: parseInt(cxc?.total_cuentas ?? '0', 10),
      saldoTotal: toNum(cxc?.saldo_total),
      saldoPorCobrar: toNum(cxc?.saldo_por_cobrar),
      saldoVencido: toNum(cxc?.saldo_vencido),
      pendientes: parseInt(cxc?.pendientes ?? '0', 10),
    },
    porPagar: {
      totalCuentas: parseInt(cxp?.total_cuentas ?? '0', 10),
      saldoTotal: toNum(cxp?.saldo_total),
      saldoPorPagar: toNum(cxp?.saldo_por_pagar),
      saldoVencido: toNum(cxp?.saldo_vencido),
      pendientes: parseInt(cxp?.pendientes ?? '0', 10),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-creación al emitir documentos
// ─────────────────────────────────────────────────────────────────────────────
export async function autoCrearCuentaPorCobrarDesdeFactura(params: {
  tenantId: string;
  emisorRuc: string;
  comprobanteId?: string | null;
  claveAcceso?: string;
  serie?: string;
  secuencial?: string;
  fechaEmision: string | Date;
  plazo?: string | number;
  importeTotal: number;
  cliente: {
    tipoIdentificacion?: string;
    identificacion?: string;
    razonSocial?: string;
    email?: string;
  };
}): Promise<any> {
  // Solo se crea CxC cuando el plazo (crédito) es mayor a 0
  const plazo = Number(params.plazo ?? 0);
  if (plazo <= 0 || !params.importeTotal || params.importeTotal <= 0) {
    return null;
  }

  const fechaVencimiento = sumarDias(params.fechaEmision, plazo);
  const numeroDocumento = params.serie && params.secuencial
    ? `${params.serie}-${params.secuencial}`
    : (params.claveAcceso || null);

  return crearCuentaPorCobrar(params.tenantId, {
    comprobanteId: params.comprobanteId || null,
    tipoIdentificacion: params.cliente.tipoIdentificacion,
    identificacion: params.cliente.identificacion,
    nombre: params.cliente.razonSocial,
    email: params.cliente.email,
    tipoDocumento: '01',
    numeroDocumento,
    fechaEmision: params.fechaEmision,
    fechaVencimiento,
    monto: params.importeTotal,
    notas: `Generada automáticamente al emitir factura a crédito (${params.emisorRuc}). Clave: ${params.claveAcceso || ''}`,
  });
}

export async function autoCrearCuentaPorPagarDesdeCompra(params: {
  tenantId: string;
  emisorRuc: string;
  comprobanteId?: string | null;
  claveAcceso?: string;
  serie?: string;
  secuencial?: string;
  fechaEmision: string | Date;
  plazo?: string | number;
  importeTotal: number;
  proveedor: {
    tipoIdentificacion?: string;
    identificacion?: string;
    razonSocial?: string;
    email?: string;
  };
}): Promise<any> {
  // Las liquidaciones de compra pueden ser a crédito si se indica plazo
  const plazo = Number(params.plazo ?? 0);
  if (plazo <= 0 || !params.importeTotal || params.importeTotal <= 0) {
    return null;
  }

  const fechaVencimiento = sumarDias(params.fechaEmision, plazo);
  const numeroDocumento = params.serie && params.secuencial
    ? `${params.serie}-${params.secuencial}`
    : (params.claveAcceso || null);

  return crearCuentaPorPagar(params.tenantId, {
    comprobanteId: params.comprobanteId || null,
    tipoIdentificacion: params.proveedor.tipoIdentificacion,
    identificacion: params.proveedor.identificacion,
    nombre: params.proveedor.razonSocial,
    email: params.proveedor.email,
    tipoDocumento: '03',
    numeroDocumento,
    fechaEmision: params.fechaEmision,
    fechaVencimiento,
    monto: params.importeTotal,
    notas: `Generada automáticamente al emitir ${params.emisorRuc}. Clave: ${params.claveAcceso || ''}`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Marcado de vencidas (también usado por IA)
// ─────────────────────────────────────────────────────────────────────────────
export async function marcarVencidas(tenantId: string): Promise<{ cobrar: number; pagar: number }> {
  await ensureCuentasTables();
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const hoyStr = hoy.toISOString().split('T')[0];

  const cxc = await db.query(
    `UPDATE cuentas_por_cobrar
     SET estado = 'VENCIDO', updated_at = NOW()
     WHERE tenant_id = $1
       AND estado IN ('PENDIENTE','PARCIAL')
       AND fecha_vencimiento IS NOT NULL
       AND fecha_vencimiento < $2`,
    [tenantId, hoyStr]
  );

  const cxp = await db.query(
    `UPDATE cuentas_por_pagar
     SET estado = 'VENCIDO', updated_at = NOW()
     WHERE tenant_id = $1
       AND estado IN ('PENDIENTE','PARCIAL')
       AND fecha_vencimiento IS NOT NULL
       AND fecha_vencimiento < $2`,
    [tenantId, hoyStr]
  );

  return { cobrar: cxc.rowCount, pagar: cxp.rowCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Aging (antigüedad de saldos)
// ─────────────────────────────────────────────────────────────────────────────
export type AgingBucket = '0-30' | '31-60' | '61-90' | '90+';

function diasVencidos(
  fechaVencimiento: Date | string | null,
  fechaEmision: Date | string | null,
  hoy: Date
): number {
  const ref = fechaVencimiento ?? fechaEmision;
  if (!ref) return 0;

  const refDate = new Date(ref);
  if (isNaN(refDate.getTime())) return 0;

  const hoyNorm = new Date(hoy);
  hoyNorm.setHours(0, 0, 0, 0);
  refDate.setHours(0, 0, 0, 0);

  const diffMs = hoyNorm.getTime() - refDate.getTime();
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Si aún no vence (días negativos), va al bucket 0-30
  return Math.max(0, dias);
}

export function agingBucket(
  fechaVencimiento: Date | string | null,
  hoy = new Date()
): AgingBucket {
  const dias = diasVencidos(fechaVencimiento, null, hoy);

  if (dias <= 30) return '0-30';
  if (dias <= 60) return '31-60';
  if (dias <= 90) return '61-90';
  return '90+';
}

export async function resumenAging(
  tenantId: string,
  tipo: 'COBRAR' | 'PAGAR'
): Promise<Record<AgingBucket, { count: number; monto: number }>> {
  await ensureCuentasTables();

  const tabla = tipo === 'COBRAR' ? TABLA_CXC : TABLA_CXP;
  const hoy = new Date();

  const rows = await db.queryAll<{
    saldo_pendiente: string;
    fecha_vencimiento: string | null;
    fecha_emision: string;
    estado: string;
  }>(
    `SELECT saldo_pendiente, fecha_vencimiento, fecha_emision, estado
     FROM ${tabla}
     WHERE tenant_id = $1
       AND estado IN ('PENDIENTE', 'PARCIAL', 'VENCIDO')
       AND saldo_pendiente > 0`,
    [tenantId]
  );

  const resumen: Record<AgingBucket, { count: number; monto: number }> = {
    '0-30': { count: 0, monto: 0 },
    '31-60': { count: 0, monto: 0 },
    '61-90': { count: 0, monto: 0 },
    '90+': { count: 0, monto: 0 },
  };

  for (const row of rows) {
    const fechaRef = row.fecha_vencimiento ?? row.fecha_emision;
    const bucket = agingBucket(fechaRef, hoy);
    const monto = Number(row.saldo_pendiente);
    resumen[bucket].count += 1;
    resumen[bucket].monto += monto;
  }

  return resumen;
}
