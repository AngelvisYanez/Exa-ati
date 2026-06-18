import path from 'path';
import fs from 'fs';
import { SriHttpScraper, ComprobanteRow, SearchOptions } from './sri-http-scraper';

export async function runHttpScraping(
  job: any,
  updateProgress: (jobId: string, msg: string, status?: string) => Promise<void>,
  tenantId: string | null,
): Promise<void> {
  const scraper = new SriHttpScraper();
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
  const typeCodes = docType === 'todos' ? ['1', '2', '3', '4', '6'] : [docType];

  const downloadsDir = path.resolve('./downloads/http-scraping');
  const xmlDir = path.join(downloadsDir, 'XML');
  const pdfDir = path.join(downloadsDir, 'RIDE');
  fs.mkdirSync(xmlDir, { recursive: true });
  fs.mkdirSync(pdfDir, { recursive: true });

  let xmlsDescargados = 0;
  let pdfsDescargados = 0;

  const current = new Date(startD);
  while (current <= endD) {
    for (const tc of typeCodes) {
      const opts: SearchOptions = {
        year: current.getFullYear(),
        month: current.getMonth() + 1,
        day: current.getDate(),
        typeCode: tc,
      };

      const dateStr = `${opts.day.toString().padStart(2, '0')}/${opts.month.toString().padStart(2, '0')}/${opts.year}`;
      await updateProgress(jobId, `HTTP: buscando para ${dateStr} tipo ${tc}...`);

      let results: ComprobanteRow[] = [];
      try {
        results = await scraper.searchComprobantes(opts);
      } catch (err: any) {
        console.error(`[HTTP] Error searching ${dateStr}: ${err.message}`);
        continue;
      }

      if (results.length === 0) {
        await updateProgress(jobId, `HTTP: sin resultados para ${dateStr}`);
        continue;
      }

      await updateProgress(jobId, `HTTP: ${results.length} comprobantes encontrados para ${dateStr}`);

      for (const comp of results) {
        if (comp.xmlUrl) {
          const xmlPath = path.join(xmlDir, `${comp.claveAcceso}.xml`);
          if (!fs.existsSync(xmlPath)) {
            const ok = await scraper.downloadFile(comp.xmlUrl, xmlPath);
            if (ok) xmlsDescargados++;
          }
        }
        if (comp.pdfUrl) {
          const pdfPath = path.join(pdfDir, `${comp.claveAcceso}.pdf`);
          if (!fs.existsSync(pdfPath)) {
            const ok = await scraper.downloadFile(comp.pdfUrl, pdfPath);
            if (ok) pdfsDescargados++;
          }
        }
      }
    }
    current.setDate(current.getDate() + 1);
  }

  await updateProgress(
    jobId,
    `HTTP: completado. XMLs: ${xmlsDescargados}, PDFs: ${pdfsDescargados}`,
    'COMPLETED',
  );
}
