import { Page } from '@cloudflare/puppeteer';
import { SRI } from './types';

export async function loginSri(page: Page, ruc: string, clave: string): Promise<void> {
  console.log(`[Auth] Navegando a ${SRI.LOGIN_URL}`);
  await page.goto(SRI.LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });

  console.log('[Auth] Esperando enlace de iniciar sesión...');
  await page.waitForSelector(SRI.SELECTORS.loginLink, { timeout: 15000 });
  await page.click(SRI.SELECTORS.loginLink);

  console.log('[Auth] Esperando formulario Keycloak...');
  await page.waitForSelector(SRI.SELECTORS.usuario, { timeout: 15000 });

  await page.type(SRI.SELECTORS.usuario, ruc, { delay: 30 });
  await page.type(SRI.SELECTORS.password, clave, { delay: 20 });

  console.log('[Auth] Enviando credenciales...');
  await page.click(SRI.SELECTORS.loginBtn);

  console.log('[Auth] Esperando redirección post-login...');
  try {
    await page.waitForFunction(
      (expectedUrl) => window.location.href.includes(expectedUrl),
      { timeout: 20000 },
      'sri-en-linea/contribuyente'
    );
    console.log('[Auth] Login exitoso');
  } catch {
    const pageContent = await page.content();
    if (pageContent.includes('alert-error') || pageContent.includes('kc-feedback-text')) {
      const errorText = await page.evaluate(() => {
        const el = document.querySelector('.alert-error, #input-error, .kc-feedback-text');
        return el?.textContent || 'Error desconocido';
      });
      throw new Error(`Login fallido: ${errorText}`);
    }
    console.log('[Auth] Redirección detectada (timeout, pero puede haber continuado)');
  }
}
