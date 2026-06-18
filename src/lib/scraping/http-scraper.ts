import path from 'path';
import fs from 'fs';
import { SriHttpScraper, ComprobanteRow, SearchOptions } from './sri-http-scraper';

export interface HttpScrapingOptions {
  proxyUrl?: string;
  cookieJarPath?: string;
  useListadoTxt?: boolean;
  parallelDays?: number;
}

async function runForDate(
  scraper: SriHttpScraper,
  date: Date,
  typeCode: string,
  updateProgress: (jobId: string, msg: string) => Promise<void>,
  jobId: string,
  xmlDir: string,
  pdfDir: string,
  counters: { xmls: number; pdfs: number },
  useListadoTxt: boolean,
): Promise<void> {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dateStr = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;

  await updateProgress(jobId, `HTTP: buscando para ${dateStr} tipo ${typeCode}...`);

  const opts: SearchOptions = { year, month, day, typeCode };

  let results: ComprobanteRow[] = [];

  if (useListadoTxt) {
    const txtData = await scraper.downloadListadoTxt(
      String(year), String(month).padStart(2, '0'), String(day).padStart(2, '0'), typeCode
    );
    if (txtData) {
      const lines = txtData.split('\n');
      for (const line of lines) {
        const claveAcceso = line.match(/\d{49}/)?.[0];
        if (claveAcceso) {
          results.push({
            claveAcceso,
            rucEmisor: line.match(/\d{13}/)?.[0] || null,
            razonSocial: null,
            total: 0,
            tipo: typeCode,
            fechaAutorizacion: null,
          });
        }
      }
      await updateProgress(jobId, `HTTP: TXT listado: ${results.length} claves para ${dateStr}`);
    }
  }

  if (results.length === 0) {
    try {
      results = await scraper.searchComprobantes(opts);
    } catch (err: any) {
      console.error(`[HTTP] Error searching ${dateStr}: ${err.message}`);
      return;
    }
  }

  if (results.length === 0) {
    await updateProgress(jobId, `HTTP: sin resultados para ${dateStr}`);
    return;
  }

  await updateProgress(jobId, `HTTP: ${results.length} comprobantes encontrados para ${dateStr}`);

  for (const comp of results) {
    if (comp.xmlUrl) {
      const xmlPath = path.join(xmlDir, `${comp.claveAcceso}.xml`);
      if (!fs.existsSync(xmlPath)) {
        const ok = await scraper.downloadFile(comp.xmlUrl, xmlPath);
        if (ok) counters.xmls++;
      }
    }
    if (comp.pdfUrl) {
      const pdfPath = path.join(pdfDir, `${comp.claveAcceso}.pdf`);
      if (!fs.existsSync(pdfPath)) {
        const ok = await scraper.downloadFile(comp.pdfUrl, pdfPath);
        if (ok) counters.pdfs++;
      }
    }
  }
}

export async function runHttpScraping(
  job: any,
  updateProgress: (jobId: string, msg: string, status?: string) => Promise<void>,
  tenantId: string | null,
  opts?: HttpScrapingOptions,
): Promise<void> {
  const scraper = new SriHttpScraper({
    proxyUrl: opts?.proxyUrl || process.env.SRI_PROXY_HOST,
    cookieJarPath: opts?.cookieJarPath || path.resolve('./browser_session/http-cookies.json'),
    tenantId: tenantId || undefined,
  });
  const jobId = job.id;

  const loggedIn = await scraper.login(job.ruc, job.clave_sri, async (msg) => {
    await updateProgress(jobId, msg);
  });

  if (!loggedIn) {
    throw new Error('No se pudo iniciar sesión HTTP en el SRI.');
  }

  const startD = new Date(job.fecha_desde);
  const endD = new Date(job.fecha_hasta);
  const docType = job.tipo_comprobante || '1';
  const typeCodes: string[] = docType === 'todos' ? ['1', '2', '3', '4', '6'] : [docType];

  const downloadsDir = path.resolve('./downloads/http-scraping');
  const xmlDir = path.join(downloadsDir, 'XML');
  const pdfDir = path.join(downloadsDir, 'RIDE');
  fs.mkdirSync(xmlDir, { recursive: true });
  fs.mkdirSync(pdfDir, { recursive: true });

  const counters = { xmls: 0, pdfs: 0 };
  const useListadoTxt = opts?.useListadoTxt ?? process.env.HTTP_USE_LISTADO_TXT === 'true';
  const parallelDays = opts?.parallelDays ?? 1;

  const days: Date[] = [];
  const current = new Date(startD);
  while (current <= endD) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  for (let i = 0; i < days.length; i += parallelDays) {
    const batch = days.slice(i, i + parallelDays);
    const tasks = batch.flatMap(d =>
      typeCodes.map(tc =>
        runForDate(scraper, d, tc, async (id, msg) => updateProgress(id, msg), jobId, xmlDir, pdfDir, counters, useListadoTxt)
          .catch(err => console.error(`[HTTP] Error en ${d.toISOString()} tipo ${tc}: ${err.message}`))
      )
    );
    await Promise.all(tasks);

    if (i + parallelDays < days.length) {
      const ok = await scraper.ensureSession();
      if (!ok && job.ruc && job.clave_sri) {
        await updateProgress(jobId, 'Re-autenticando para continuar...');
        await scraper.login(job.ruc, job.clave_sri);
      }
    }
  }

  await updateProgress(
    jobId,
    `HTTP: completado. XMLs: ${counters.xmls}, PDFs: ${counters.pdfs}`,
    'COMPLETED',
  );
}
