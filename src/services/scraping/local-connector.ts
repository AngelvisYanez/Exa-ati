import { timingSafeEqual } from 'crypto';
import { db } from '@/services/sri-api/db';
import { encryption } from '@/services/sri-api/encryption';
import { formatJobDateIso } from './sri-scrape-actions';
import { parseXmlComprobante, saveAutorizadoXml } from '@/services/sri-api/comprobante-importer';
import { updateComprobanteFromXml, extractFechaEmision, extractRuc, extractSecuencial, extractSerie } from './sri-utils';
import { resolveComprobanteXml } from '@/services/sri-api/comprobante-xml-resolver';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Presence for the single EXA-ATI server process. A stopped desktop expires after two polls.
const state = globalThis as typeof globalThis & { localSriPresence?: Map<string, number> };
const presence = state.localSriPresence ??= new Map<string, number>();
export function localPresence(tenant: string, active: boolean) {
  if (active) presence.set(tenant, Date.now() + 45000);
  else presence.delete(tenant);
}

export function connectorTenantEnabled(tenantId: string): boolean {
  if ((presence.get(tenantId) ?? 0) > Date.now()) return true;
  return (process.env.SRI_LOCAL_CONNECTOR_KEYS || '').split(';').some((entry) => {
    const separator = entry.indexOf('=');
    return separator > 0 && /^[0-9a-f-]{36}$/i.test(tenantId) &&
      entry.slice(0, separator).trim() === tenantId &&
      entry.slice(separator + 1).trim().length >= 32;
  });
}

export function authenticateConnector(req: Request): string | null {
  const supplied = req.headers.get('x-sri-connector-key') || '';
  if (!supplied) return null;
  for (const entry of (process.env.SRI_LOCAL_CONNECTOR_KEYS || '').split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 1) continue;
    const tenantId = entry.slice(0, separator).trim();
    const secret = entry.slice(separator + 1).trim();
    if (!/^[0-9a-f-]{36}$/i.test(tenantId) || secret.length < 32) continue;
    const a = Buffer.from(secret);
    const b = Buffer.from(supplied);
    if (a.length === b.length && timingSafeEqual(a, b)) return tenantId;
  }
  return null;
}

export async function claimConnectorJob(tenantId: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const job = await db.queryOne<any>(
      `SELECT id, ruc, clave_sri, fecha_desde, fecha_hasta, tipo_comprobante, action_type, options
       FROM scraping_jobs WHERE tenant_id = $1 AND status = 'PENDING'
       AND action_type IN ('DOWNLOAD_RECEIVED', 'DOWNLOAD_EMITTED', 'DOWNLOAD_BOTH', 'SCRAPE_RETENCIONES')
       AND EXISTS (SELECT 1 FROM emisores e WHERE e.ruc = scraping_jobs.ruc
         AND e.tenant_id = $1 AND e.activo = true)
       ORDER BY created_at ASC LIMIT 1`, [tenantId],
    );
    if (!job) return null;
    const claimed = await db.query(
      `UPDATE scraping_jobs SET status = 'PROCESSING', progress_message = 'Conector local: iniciando descarga', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'PENDING'`, [job.id, tenantId],
    );
    if (claimed.rowCount !== 1) continue;
    let claveSri = job.clave_sri;
    try {
      if (!claveSri) {
        const emisor = await db.queryOne<{ clave_sri_encrypted: string | null }>(
          'SELECT clave_sri_encrypted FROM emisores WHERE ruc = $1 AND tenant_id = $2 AND activo = true',
          [job.ruc, tenantId],
        );
        if (emisor?.clave_sri_encrypted) claveSri = await encryption.decrypt(emisor.clave_sri_encrypted);
      }
    } catch {
      await finishConnectorJob(tenantId, job.id, false, 'No se pudo descifrar la clave SRI del emisor.');
      continue;
    }
    if (!claveSri) {
      await finishConnectorJob(tenantId, job.id, false, 'No hay clave SRI configurada para este RUC.');
      continue;
    }
    return {
      id: job.id, ruc: job.ruc, clave_sri: claveSri,
      fecha_desde: formatJobDateIso(job.fecha_desde), fecha_hasta: formatJobDateIso(job.fecha_hasta),
      tipo_comprobante: job.tipo_comprobante, action_type: job.action_type, options: job.options,
      tenant_id: tenantId,
    };
  }
  return null;
}

export async function getActiveConnectorJob(tenantId: string, jobId: number) {
  return db.queryOne<{ id: number; ruc: string; status: string }>(
    'SELECT id, ruc, status FROM scraping_jobs WHERE id = $1 AND tenant_id = $2', [jobId, tenantId],
  );
}

export async function connectorHasXml(tenantId: string, jobId: number, clave: string): Promise<boolean> {
  const job = await getActiveConnectorJob(tenantId, jobId);
  if (!job || job.status !== 'PROCESSING') throw new Error('Trabajo no activo');
  if (!/^\d{49}$/.test(clave)) throw new Error('Clave de acceso inválida');
  const row = await db.queryOne<{ tenant_id: string | null }>(
    'SELECT tenant_id FROM comprobantes WHERE clave_acceso = $1', [clave],
  );
  if (!row || row.tenant_id !== tenantId) return false;
  const xml = await resolveComprobanteXml(clave, { fetchFromSri: false });
  return Boolean(xml && xml.trim().length > 50);
}

export async function persistConnectorXml(tenantId: string, jobId: number, clave: string, xml: string) {
  const job = await getActiveConnectorJob(tenantId, jobId);
  if (!job || job.status !== 'PROCESSING') throw new Error('Trabajo no activo');
  if (!/^\d{49}$/.test(clave) || typeof xml !== 'string' || xml.length < 50 || Buffer.byteLength(xml) > 2_000_000) {
    throw new Error('XML o clave de acceso inválida');
  }
  const parsed = await parseXmlComprobante(xml);
  if (parsed.claveAcceso !== clave || (parsed.rucEmisor !== job.ruc && parsed.receptorIdentificacion !== job.ruc)) {
    throw new Error('El XML no corresponde al trabajo y RUC autorizado');
  }
  const existing = await db.queryOne<{ id: string; tenant_id: string | null }>(
    'SELECT id, tenant_id FROM comprobantes WHERE clave_acceso = $1', [clave],
  );
  if (existing && existing.tenant_id !== tenantId) throw new Error('Comprobante pertenece a otro tenant');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exa-sri-connector-'));
  const tmpPath = path.join(tmpDir, `${clave}.xml`);
  try {
    fs.writeFileSync(tmpPath, xml, { flag: 'wx' });
    if (!existing) {
      await db.query(
        `INSERT INTO comprobantes (id, clave_acceso, tipo, estado, receptor_identificacion, tenant_id,
          emisor_ruc, fecha_emision, serie, secuencial, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 'PENDIENTE', $3, $4, $5, $6, $7, $8, NOW(), NOW())
         ON CONFLICT (clave_acceso) DO NOTHING`,
        [clave, parsed.tipo, job.ruc, tenantId, extractRuc(clave), parsed.fechaEmision,
          extractSerie(clave), extractSecuencial(clave)],
      );
    }
    const owner = await db.queryOne<{ tenant_id: string | null }>(
      'SELECT tenant_id FROM comprobantes WHERE clave_acceso = $1', [clave],
    );
    if (!owner || owner.tenant_id !== tenantId) throw new Error('Comprobante pertenece a otro tenant');
    await updateComprobanteFromXml(db, tmpPath, clave, tenantId);
    const record = await db.queryOne<{ id: string; tenant_id: string | null; emisor_ruc: string | null }>(
      'SELECT id, tenant_id, emisor_ruc FROM comprobantes WHERE clave_acceso = $1', [clave],
    );
    if (!record || record.tenant_id !== tenantId) throw new Error('No se pudo guardar el comprobante');
    const fechaIso = extractFechaEmision(clave);
    const fecha = fechaIso ? new Date(`${fechaIso}T12:00:00Z`) : parsed.fechaEmision;
    await saveAutorizadoXml(record.id, extractRuc(record.emisor_ruc) || parsed.rucEmisor, clave, fecha, xml);
    await db.query(
      `UPDATE comprobantes SET estado = 'AUTORIZADO', estado_sri = COALESCE(estado_sri, 'AUTORIZADO'), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`, [record.id, tenantId],
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function progressConnectorJob(tenantId: string, jobId: number, message: string) {
  const msg = message.slice(0, 800);
  const updated = await db.query(
    `UPDATE scraping_jobs SET progress_message = $1, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3 AND status = 'PROCESSING'`, [msg, jobId, tenantId],
  );
  return updated.rowCount === 1;
}

export async function finishConnectorJob(tenantId: string, jobId: number, success: boolean, message: string) {
  const status = success ? 'COMPLETED' : 'ERROR';
  const updated = await db.query(
    `UPDATE scraping_jobs SET status = $1, progress_message = $2, updated_at = NOW()
     WHERE id = $3 AND tenant_id = $4 AND status = 'PROCESSING'`,
    [status, message.slice(0, 800), jobId, tenantId],
  );
  if (updated.rowCount === 1) {
    await db.query('INSERT INTO scraping_job_logs (job_id, level, message) VALUES ($1, $2, $3)',
      [jobId, success ? 'success' : 'error', message.slice(0, 800)]);
  }
  return updated.rowCount === 1;
}
