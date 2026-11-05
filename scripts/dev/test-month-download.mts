/**
 * Prueba real: mes completo (Día=Todos) con SriPlaywrightScraper.
 *
 * Uso:
 *   node --import tsx scripts/dev/test-month-download.mts
 *
 * Requiere en .env (o entorno):
 *   SRI_TEST_RUC / SRI_TEST_PASSWORD  (o defaults de tests)
 *   ANTICAPTCHA_KEY o SCRAPELESS_API_KEY (recomendado)
 */
import 'dotenv/config';
import {
  SriPlaywrightScraper,
  buildSearchPeriods,
  parseJobCalendarDate,
  lastDayOfMonth,
} from '../../src/services/scraping/sri-playwright-scraper';

const RUC = process.env.SRI_TEST_RUC || '0704439892001';
const PASSWORD = process.env.SRI_TEST_PASSWORD || 'SamT.2026**';

async function main() {
  const now = new Date();
  // Mes anterior completo (más probable que tenga documentos)
  const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const month = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth(); // getUTCMonth is 0-based; previous month number
  const last = lastDayOfMonth(year, month);
  const fecha_desde = `${year}-${String(month).padStart(2, '0')}-01`;
  const fecha_hasta = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;

  console.log('=== Test mes completo (recibidos) ===');
  console.log('Periodo:', fecha_desde, '→', fecha_hasta);
  console.log('RUC:', RUC.slice(0, 4) + '***');
  console.log('ANTICAPTCHA:', process.env.ANTICAPTCHA_KEY ? 'sí (opcional)' : 'no (flujo espera+Consultar)');
  console.log('SCRAPELESS:', process.env.SCRAPELESS_API_KEY ? 'sí' : 'no');
  console.log('Espera Consultar:', `${Number(process.env.SRI_CONSULTAR_WAIT_MS || 90000) / 1000}s`);

  const start = parseJobCalendarDate(fecha_desde);
  const end = parseJobCalendarDate(fecha_hasta);
  const periods = buildSearchPeriods(start, end, 'recibidos');
  console.log('Periodos planificados:', JSON.stringify(periods));
  if (periods.length !== 1 || periods[0].day !== 0) {
    throw new Error('buildSearchPeriods no generó day=0 para mes completo');
  }

  const logs: string[] = [];
  // Firma real de updateProgress en job-runner: (jobId, message, status?)
  const updateProgress = async (jobId: string | number, message: string, status?: string) => {
    const line = status ? `[${status}] ${message}` : message;
    logs.push(line);
    console.log('  ·', line);
  };

  const job = {
    id: 'test-month',
    ruc: RUC,
    clave_sri: PASSWORD,
    fecha_desde,
    fecha_hasta,
    tipo_comprobante: '1', // solo facturas para acotar
    tenant_id: null,
    action_type: 'DOWNLOAD_RECEIVED',
  };

  const scraper = new SriPlaywrightScraper({ headless: true });
  try {
    console.log('Init browser...');
    await scraper.init();
    console.log('Login...');
    const ok = await scraper.login(RUC, PASSWORD, async (msg) => {
      await updateProgress('login', msg);
    });
    if (!ok) {
      throw new Error('Login falló');
    }
    console.log('runMassDownload recibidos...');
    await scraper.runMassDownload(job, updateProgress, 'recibidos');
    console.log('=== OK ===');
    const todosLog = logs.find((l) => /Día=Todos|mes completo|day=0|Modo mes completo/i.test(l));
    console.log('Evidencia Día=Todos:', todosLog || '(no encontrada en logs)');
    const errLog = logs.find((l) => /No se pudo establecer el select.*dia|Error en Mes completo/i.test(l));
    if (errLog) {
      console.error('ERROR detectado en logs:', errLog);
      process.exitCode = 2;
    }
  } finally {
    await scraper.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('FALLO:', err?.message || err);
  process.exit(1);
});
