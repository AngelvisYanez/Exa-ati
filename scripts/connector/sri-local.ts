/**
 * Ejecutar en la computadora del cliente. Solo realiza conexiones HTTPS salientes.
 * No requiere DATABASE_URL ni acceso de red a la base de datos.
 */
import { SriPlaywrightScraper, isMassDownloadFullySynced, type MassDownloadSummary } from '../../src/services/scraping/sri-playwright-scraper';

const server = (process.env.SRI_CONNECTOR_URL || '').replace(/\/$/, '');
const key = process.env.SRI_CONNECTOR_KEY || '';
const session = process.env.SRI_CONNECTOR_SESSION;
const stopFile = process.env.SRI_CONNECTOR_STOP_FILE;
import { existsSync } from 'node:fs';
const stopping = () => Boolean(stopFile && existsSync(stopFile));
const pollingMs = Math.max(5_000, Number(process.env.SRI_CONNECTOR_POLL_MS || 15_000));
const localServer = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(server);
if ((!server.startsWith('https://') && !localServer) || (!(session && (localServer || server === "https://ati.exacontable.com")) && key.length < 32)) {
  throw new Error('Configure SRI_CONNECTOR_URL (HTTPS) y SRI_CONNECTOR_KEY (mínimo 32 caracteres).');
}
if (process.env.DATABASE_URL) {
  throw new Error('El conector local no debe recibir DATABASE_URL.');
}

type ConnectorJob = {
  id: number; ruc: string; clave_sri: string;
  fecha_desde: string; fecha_hasta: string; tipo_comprobante: string;
  action_type: string; options: string | null; tenant_id: string;
};

async function call(action: string, data: Record<string, unknown> = {}): Promise<any> {
  const response = await fetch(`${server}/api/sri/local-connector`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(session ? { authorization: 'Bearer ' + session } : { 'x-sri-connector-key': key }) },
    body: JSON.stringify({ action, ...data }),
    redirect: 'error',
    signal: AbortSignal.timeout(60_000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Conector HTTP ${response.status}: ${result.error || 'error'}`);
  return result;
}

async function runJob(job: ConnectorJob): Promise<void> {
  const scraper = new SriPlaywrightScraper({
    directConnection: true,
    preferLocalBrowser: true,
    headless: process.env.SRI_CONNECTOR_HEADLESS === 'true',
    connectorBridge: {
      hasXml: async (clave) => (await call('hasXml', { jobId: job.id, clave })).exists === true,
      uploadXml: async (clave, xml) => { await call('uploadXml', { jobId: job.id, clave, xml }); },
    },
  });
  let cancelled = false;
  const heartbeat = setInterval(() => {
    void call('status', { jobId: job.id }).then(async (result) => {
      if (result.status === 'CANCELLED') {
        cancelled = true;
        await scraper.close();
      }
    }).catch((error) => console.error(`Estado del trabajo ${job.id}: ${error.message}`));
  }, 15_000);
  const progress = async (_jobId: string, message: string) => {
    if (cancelled) throw new Error('Trabajo cancelado');
    await call('progress', { jobId: job.id, message });
    console.log(`[${job.id}] ${message}`);
  };
  try {
    await progress(String(job.id), 'Conector local: iniciando Playwright con IP del cliente');
    await scraper.init();
    if (!(await scraper.login(job.ruc, job.clave_sri, (message) => progress(String(job.id), message)))) {
      throw new Error('No se pudo iniciar sesión en SRI desde la IP local.');
    }
    const summaries: MassDownloadSummary[] = [];
    const flows: Array<'recibidos' | 'emitidos'> =
      job.action_type === 'DOWNLOAD_BOTH' || job.action_type === 'SCRAPE_RETENCIONES'
      ? ['recibidos', 'emitidos']
      : [job.action_type === 'DOWNLOAD_EMITTED' ? 'emitidos' : 'recibidos'];
    for (const flow of flows) {
      if (cancelled) throw new Error('Trabajo cancelado');
      summaries.push(await scraper.runMassDownload(job, progress, flow));
    }
    const found = summaries.reduce((sum, item) => sum + item.found, 0);
    const synced = summaries.reduce((sum, item) => sum + item.xmlsSynced, 0);
    const complete = summaries.every(isMassDownloadFullySynced);
    const message = complete
      ? `Descarga local finalizada: ${synced} XML sincronizados de ${found} comprobantes encontrados.`
      : `Descarga local incompleta: ${synced} XML sincronizados de ${found} comprobantes encontrados.`;
    await call('finish', { jobId: job.id, success: complete, message });
    console.log(`[${job.id}] ${message}`);
  } catch (error: any) {
    const message = `Error en conector local: ${String(error?.message || error).slice(0, 700)}`;
    if (!cancelled) await call('finish', { jobId: job.id, success: false, message }).catch(() => {});
    console.error(`[${job.id}] ${message}`);
  } finally {
    clearInterval(heartbeat);
    await scraper.close().catch(() => {});
  }
}

async function main() {
  console.log('Conector SRI local activo. Esperando trabajos por HTTPS.');
  while (!stopping()) {
    try {
      const { job } = await call('claim');
      if (job) await runJob(job);
    } catch (error: any) {
      if (session && /HTTP (401|403)/.test(String(error.message))) { process.exitCode = 1; break; }
      console.error(`Conector: ${error.message}`);
    }
    if (process.env.SRI_CONNECTOR_ONCE === 'true') break;
    await new Promise((resolve) => setTimeout(resolve, pollingMs));
  }
}

void main();
