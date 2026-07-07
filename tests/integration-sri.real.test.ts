/**
 * Integration tests against the real SRI portal.
 *
 * PREREQUISITOS:
 *   RUN_SRI_INTEGRATION_TESTS=true   npx vitest run --reporter=verbose
 *
 * Opcional — credenciales (fallback a las compartidas):
 *   SRI_TEST_RUC=0704439892001
 *   SRI_TEST_PASSWORD=SamT.2026**
 *
 * Para login con Playwright (Test 4):
 *   - Chromium instalado: npx playwright install chromium
 *   - ANTICAPTCHA_KEY=<tu_key>   (para resolver CAPTCHA automático)
 *     o HEADLESS=false           (modo interactivo, resuelves CAPTCHA manual)
 */

import { describe, it, expect } from 'vitest';

const RUC = process.env.SRI_TEST_RUC || '0704439892001';
const PASSWORD = process.env.SRI_TEST_PASSWORD || 'SamT.2026**';
const RUN_INTEGRATION = process.env.RUN_SRI_INTEGRATION_TESTS === 'true';

describe.runIf(RUN_INTEGRATION)('SRI Integration — Validación de credenciales', () => {
  it('validateSriPortalCredentials — formato y conectividad al portal', async () => {
    const { validateSriPortalCredentials } = await import('../src/lib/sri-api/sri-portal-validator');
    const result = await validateSriPortalCredentials(RUC, PASSWORD);

    expect(result.valid).toBe(true);
    expect(result.message).toBeTruthy();
  });
});

describe.runIf(RUN_INTEGRATION)('SRI Integration — Consulta de contribuyente', () => {
  it('buscarEnSri — debe retornar datos reales del SRI', async () => {
    const { buscarEnSri } = await import('../src/lib/sri-api/contactos');
    const result = await buscarEnSri(RUC);

    expect(result.razonSocial).toBeTruthy();
    // Si la consulta falla (red), debe devolver error pero no vacío
    if (!result.error) {
      expect(result.razonSocial).not.toBe(RUC);
      expect(result.razonSocial.toLowerCase()).toContain('sam');
    }
  });
});

describe.runIf(RUN_INTEGRATION)('SRI Integration — Conexión SOAP', () => {
  it('sriSoapClient.testConnection — ambiente pruebas (celcer)', async () => {
    const { sriSoapClient } = await import('../src/lib/sri-api/sri-soap-client');
    const result = await sriSoapClient.testConnection('1');

    expect(result.success).toBe(true);
    expect(result.recepcion).toBe(true);
    expect(result.autorizacion).toBe(true);
  }, 60000);
});

describe.runIf(RUN_INTEGRATION)('SRI Integration — Login real con Playwright', () => {
  it('SriPlaywrightScraper.login — debe iniciar sesión en el portal SRI', async () => {
    const { SriPlaywrightScraper } = await import('../src/lib/scraping/sri-playwright-scraper');

    const scraper = new SriPlaywrightScraper({ headless: false });
    await scraper.init();

    try {
      const success = await scraper.login(RUC, PASSWORD);
      expect(success).toBe(true);
    } finally {
      await scraper.close();
    }
  }, 180000);
});
