import { db } from './db';
import { calculateTaxSummary, ComprobanteTaxRow } from './tax-calculator';

export type RiskLevel = 'Alto' | 'Medio' | 'Bajo';

export interface AuditAlert {
  id: string;
  type: string;
  title: string;
  description: string;
  risk: RiskLevel;
  count?: number;
  suggestion: string;
  clavesAcceso?: string[];
}

const RETENTION_THRESHOLD = 1000;
const RIMPE_ANNUAL_LIMIT = 300000;

export type DateRangeParams = {
  fechaDesde?: string;
  fechaHasta?: string;
};

export async function fetchTenantComprobantes(
  tenantId: string,
  userRuc: string,
  range?: DateRangeParams
) {
  const conditions = ['(tenant_id = ? OR receptor_identificacion = ? OR emisor_ruc = ?)'];
  const params: (string | number)[] = [tenantId, userRuc, userRuc];

  if (range?.fechaDesde) {
    conditions.push('fecha_emision >= ?');
    params.push(range.fechaDesde);
  }
  if (range?.fechaHasta) {
    conditions.push('fecha_emision <= ?');
    params.push(range.fechaHasta);
  }

  return db.queryAll<any>(
    `SELECT clave_acceso, tipo, serie, secuencial, emisor_ruc, emisor_razon_social,
            receptor_identificacion, subtotal_sin_impuesto, total_sin_impuesto, total_iva,
            importe_total, categoria, estado, fecha_emision
     FROM comprobantes
     WHERE ${conditions.join(' AND ')}
     ORDER BY fecha_emision DESC`,
    params
  );
}

export function buildAuditAlerts(
  comprobantes: ComprobanteTaxRow[],
  userRuc: string,
  certDaysLeft: number | null
): AuditAlert[] {
  const alerts: AuditAlert[] = [];
  const summary = calculateTaxSummary(comprobantes, userRuc);

  const clavesBySecuencial = new Map<string, ComprobanteTaxRow[]>();
  const clavesAcceso = new Set<string>();

  for (const doc of comprobantes) {
    const key = `${doc.emisor_ruc}-${doc.secuencial}`;
    const list = clavesBySecuencial.get(key) || [];
    list.push(doc);
    clavesBySecuencial.set(key, list);

    if (doc.clave_acceso) {
      if (clavesAcceso.has(doc.clave_acceso)) {
        alerts.push({
          id: `dup-clave-${doc.clave_acceso}`,
          type: 'duplicate',
          title: 'Clave de acceso duplicada',
          description: `La clave ${doc.clave_acceso.slice(-8)} aparece más de una vez en tu base de datos.`,
          risk: 'Alto',
          count: 1,
          suggestion: 'Elimina o corrige el comprobante duplicado antes de declarar.',
          clavesAcceso: [doc.clave_acceso],
        });
      }
      clavesAcceso.add(doc.clave_acceso);
    }
  }

  const duplicateGroups = [...clavesBySecuencial.entries()].filter(([, docs]) => docs.length > 1);
  if (duplicateGroups.length > 0) {
    const claves = duplicateGroups.flatMap(([, docs]) =>
      docs.map((d) => d.clave_acceso).filter(Boolean) as string[]
    );
    alerts.push({
      id: 'duplicate-secuencial',
      type: 'duplicate',
      title: 'Facturas con secuencial duplicado',
      description: `Se detectaron ${duplicateGroups.length} grupos de facturas con el mismo secuencial por proveedor.`,
      risk: 'Alto',
      count: duplicateGroups.length,
      suggestion: 'Verifica si son duplicados reales o reimportaciones. Excluye los duplicados del cálculo.',
      clavesAcceso: claves.slice(0, 10),
    });
  }

  const noAutorizados = comprobantes.filter(
    (c) => c.estado && c.estado !== 'AUTORIZADO'
  );
  if (noAutorizados.length > 0) {
    alerts.push({
      id: 'estado-sri',
      type: 'suspended',
      title: 'Comprobantes no autorizados por el SRI',
      description: `${noAutorizados.length} documento(s) no están en estado AUTORIZADO.`,
      risk: 'Alto',
      count: noAutorizados.length,
      suggestion: 'Sincroniza con el SRI o reintenta la autorización antes de usar estos documentos en la declaración.',
      clavesAcceso: noAutorizados
        .map((c) => c.clave_acceso)
        .filter(Boolean)
        .slice(0, 10) as string[],
    });
  }

  const ivaInconsistentes = comprobantes.filter((c) => {
    if (tipo(c) !== '01') return false;
    const base = subtotal(c);
    const actualIva = iva(c);
    if (base <= 0 || actualIva <= 0) return false;
    return Math.abs(base * 0.15 - actualIva) > 0.05;
  });

  if (ivaInconsistentes.length > 0) {
    alerts.push({
      id: 'iva-inconsistente',
      type: 'iva',
      title: 'IVA inconsistente',
      description: `${ivaInconsistentes.length} facturas presentan IVA distinto al 15% del subtotal.`,
      risk: 'Medio',
      count: ivaInconsistentes.length,
      suggestion: 'Solicita notas de crédito o facturas corregidas a los proveedores.',
      clavesAcceso: ivaInconsistentes
        .map((c) => c.clave_acceso)
        .filter(Boolean)
        .slice(0, 10) as string[],
    });
  }

  const comprasSinRetencion = summary.compras.filter(
    (c) => subtotal(c) >= RETENTION_THRESHOLD
  );
  const retencionesRecibidas = summary.retenciones.length;
  if (comprasSinRetencion.length > retencionesRecibidas) {
    alerts.push({
      id: 'retenciones-faltantes',
      type: 'retention',
      title: 'Posibles retenciones faltantes',
      description: `${comprasSinRetencion.length} compras superan el umbral de $${RETENTION_THRESHOLD} y podrían requerir retención.`,
      risk: 'Medio',
      count: comprasSinRetencion.length,
      suggestion: 'Emite o verifica las retenciones dentro del plazo legal (5 días hábiles).',
    });
  }

  const pctRimpe = (summary.totalVentasSub / RIMPE_ANNUAL_LIMIT) * 100;
  if (pctRimpe >= 60) {
    alerts.push({
      id: 'limite-rimpe',
      type: 'limit',
      title: 'Acercamiento al límite RIMPE',
      description: `Tus ventas acumuladas representan el ${pctRimpe.toFixed(0)}% del límite RIMPE ($${RIMPE_ANNUAL_LIMIT.toLocaleString()}).`,
      risk: pctRimpe >= 85 ? 'Alto' : 'Medio',
      suggestion: 'Planifica el cambio de régimen tributario con anticipación.',
    });
  }

  const incompletos = comprobantes.filter(
    (c) => !c.emisor_razon_social || !c.receptor_identificacion
  );
  if (incompletos.length > 0) {
    alerts.push({
      id: 'datos-incompletos',
      type: 'common',
      title: 'Datos del comprobante incompletos',
      description: `${incompletos.length} comprobantes tienen campos de emisor o receptor incompletos.`,
      risk: 'Bajo',
      count: incompletos.length,
      suggestion: 'Reimporta el XML autorizado del SRI para completar la información.',
    });
  }

  if (certDaysLeft !== null && certDaysLeft <= 30) {
    alerts.push({
      id: 'certificado-expira',
      type: 'common',
      title: certDaysLeft < 0 ? 'Firma electrónica expirada' : 'Firma electrónica por vencer',
      description:
        certDaysLeft < 0
          ? `Tu certificado expiró hace ${Math.abs(certDaysLeft)} días.`
          : `Tu certificado vence en ${certDaysLeft} días.`,
      risk: certDaysLeft < 0 ? 'Alto' : 'Medio',
      suggestion: 'Renueva tu firma electrónica .p12 en Configuración para seguir emitiendo comprobantes.',
    });
  }

  return alerts;
}

function tipo(row: ComprobanteTaxRow): string {
  return row.tipo || row.tipo_comprobante || '';
}

function subtotal(row: ComprobanteTaxRow): number {
  return parseFloat(String(row.subtotal_sin_impuesto ?? row.total_sin_impuesto ?? row.total_sin_impuestos ?? 0)) || 0;
}

function iva(row: ComprobanteTaxRow): number {
  const explicit = parseFloat(String(row.total_iva ?? ''));
  if (!Number.isNaN(explicit) && explicit > 0) return explicit;
  const total = parseFloat(String(row.importe_total ?? 0)) || 0;
  return Math.max(0, total - subtotal(row));
}

export async function runAudit(
  userRuc: string,
  tenantId: string,
  range?: DateRangeParams
) {
  const emisor = await db.queryOne<any>(
    `SELECT cert_valido_hasta, certificado_valido_hasta FROM emisores WHERE ruc = ? AND activo = true`,
    [userRuc]
  );

  const expiry = emisor?.certificado_valido_hasta || emisor?.cert_valido_hasta || null;
  let certDaysLeft: number | null = null;
  if (expiry) {
    certDaysLeft = Math.ceil(
      (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  }

  const comprobantes = await fetchTenantComprobantes(tenantId, userRuc, range);
  const alerts = buildAuditAlerts(comprobantes, userRuc, certDaysLeft);
  const executedAt = new Date().toISOString();

  const descripcion = `Auditoría ejecutada: ${alerts.length} alertas en ${comprobantes.length} comprobantes`;
  const datosNuevos = JSON.stringify({
    alertsCount: alerts.length,
    comprobantesRevisados: comprobantes.length,
    executedAt,
    fechaDesde: range?.fechaDesde ?? null,
    fechaHasta: range?.fechaHasta ?? null,
  });

  await db.query(
    `INSERT INTO auditoria (usuario_email, tenant_id, accion, recurso, descripcion, datos_nuevos, exitoso)
     VALUES (?, ?, 'AUDITORIA_IA', 'comprobantes', ?, ?, 1)`,
    [userRuc, tenantId, descripcion, datosNuevos]
  );

  return {
    alerts,
    comprobantesRevisados: comprobantes.length,
    executedAt,
    certDaysLeft,
  };
}
