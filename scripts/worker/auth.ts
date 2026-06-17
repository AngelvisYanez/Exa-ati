import fs from 'fs';
import path from 'path';
// @ts-ignore
import ac from '@antiadmin/anticaptchaofficial';

export async function trySolveRecaptcha(page: any): Promise<boolean> {
  try {
    const frames = page.frames();
    const challengeFrame = frames.find((f: any) => 
      f.url().includes('api2/bframe') || 
      f.url().includes('recaptcha/api2/anchor') || 
      f.name().includes('c-') || 
      f.url().includes('bframe')
    );
    
    if (!challengeFrame) {
      return false;
    }
    
    const solverBtn = await challengeFrame.$('#solver-button');
    if (solverBtn) {
      console.log('[Worker CAPTCHA] ¡Buster detectado! Intentando resolver CAPTCHA automáticamente...');
      await solverBtn.click();
      await new Promise(r => setTimeout(r, 6000));
      return true;
    }
  } catch (e: any) {
    console.error('[Worker CAPTCHA] Error al intentar resolver recaptcha con Buster:', e.message);
  }
  return false;
}

/**
 * Sobrescribe grecaptcha.enterprise.execute para que devuelva un token
 * pre-resuelto de Anti-Captcha.
 */
async function overrideGrecaptchaEnterprise(page: any, token: string): Promise<void> {
  await page.evaluate((tokenVal: string) => {
    const ta = document.getElementById('g-recaptcha-response') as HTMLTextAreaElement;
    if (ta) {
      ta.value = tokenVal;
    }

    if (typeof (window as any).grecaptcha === 'undefined') {
      (window as any).grecaptcha = {};
    }
    const g = (window as any).grecaptcha;
    if (!g.enterprise) {
      g.enterprise = {};
    }
    g.enterprise.execute = function() {
      return Promise.resolve(tokenVal);
    };
    g.enterprise.ready = function(cb: any) {
      if (typeof cb === 'function') cb();
    };

    if (typeof (window as any).executeRecaptcha === 'function') {
      (window as any).executeRecaptcha = function() {
        const ta2 = document.getElementById('g-recaptcha-response') as HTMLTextAreaElement;
        if (ta2) ta2.value = tokenVal;
        return tokenVal;
      };
    }
  }, token);
}

/**
 * Resuelve el reCAPTCHA Enterprise invisible usando Anti-Captcha.
 */
export async function solveRecaptchaAntiCaptcha(page: any, action?: string): Promise<boolean> {
  const apiKey = process.env.ANTICAPTCHA_KEY;
  if (!apiKey) {
    console.log('[Worker CAPTCHA] No hay ANTICAPTCHA_KEY configurado. No se puede resolver por anticaptcha.');
    return false;
  }

  ac.setAPIKey(apiKey);
  ac.setSoftId(0);

  try {
    console.log(`[Worker CAPTCHA] Iniciando resolución con Anti-Captcha${action ? ` (action: ${action})` : ''}...`);

    const sitekey = '6LdukTQsAAAAAIcciM4GZq4ibeyplUhmWvlScuQE';
    const currentUrl = await page.url();

    const payload: any = {};
    if (action) {
      payload.s = action;
    }

    const token = await ac.solveRecaptchaV2EnterpriseProxyless(currentUrl, sitekey, payload);

    if (!token) {
      console.log('[Worker CAPTCHA] ❌ Anti-Captcha no devolvió token.');
      return false;
    }

    console.log('[Worker CAPTCHA] ✅ Token obtenido. Inyectando mock de grecaptcha.enterprise.execute...');
    await overrideGrecaptchaEnterprise(page, token);

    return true;
  } catch (e: any) {
    console.error(`[Worker CAPTCHA] ❌ Error en Anti-Captcha: ${e.message}`);
    return false;
  }
}

export async function ensureSession(
  page: any, 
  ruc: string, 
  claveSri: string, 
  updateProgress: (msg: string) => Promise<void>
): Promise<boolean> {
  const isHeadless = process.env.HEADLESS !== 'false';
  
  await updateProgress('Comprobando sesión en el SRI...');
  await page.goto('https://srienlinea.sri.gob.ec/sri-en-linea/contribuyente/perfil', { 
    waitUntil: 'domcontentloaded',
    timeout: 45000
  });
  await page.waitForSelector('body', { timeout: 10000 }).catch(() => {});

  await updateProgress('Esperando respuesta del portal de sesión...');
  await new Promise(r => setTimeout(r, 5000));

  const currentUrl = page.url();
  const hasInput = await page.$('input#usuario, input#username, input[name="username"], input[name="usuario"]') !== null;
  let needsLogin = currentUrl.includes('login') || currentUrl.includes('openid-connect/auth') || hasInput;

  if (needsLogin) {
    await updateProgress('No hay sesión activa. Iniciando sesión...');
    
    const userSelector = await page.waitForSelector('input#usuario, input#username, input[name="username"], input[name="usuario"]', { timeout: 45000 });
    if (userSelector) {
      await new Promise(r => setTimeout(r, 1500));
      try {
        await page.evaluate(() => { 
          const input = document.querySelector('input#usuario, input#username, input[name="username"], input[name="usuario"]') as HTMLInputElement;
          if (input) input.value = ''; 
        });
      } catch (e) {}
      await userSelector.type(ruc, { delay: 50 });
    }
    
    const passSelector = await page.$('input#password, input[name="password"]');
    if (passSelector) {
      try {
        await page.evaluate(() => { 
          const input = document.querySelector('input#password, input[name="password"]') as HTMLInputElement;
          if (input) input.value = ''; 
        });
      } catch (e) {}
      await passSelector.type(claveSri, { delay: 50 });
    }

    const ANTICAPTCHA_KEY = process.env.ANTICAPTCHA_KEY || '';

    if (isHeadless) {
      const hasCaptcha = await page.evaluate(() => {
        return document.querySelector('iframe[src*="recaptcha"]') !== null ||
               document.querySelector('.g-recaptcha') !== null ||
               document.getElementById('g-recaptcha-response') !== null;
      });

      if (hasCaptcha && ANTICAPTCHA_KEY) {
        await updateProgress('Se detectó CAPTCHA en el login. Intentando resolver con Anti-Captcha...');
        await solveRecaptchaAntiCaptcha(page);
      }
      
      await updateProgress('Haciendo clic en ingresar...');
      await page.click('button[type="submit"], input[type="submit"], button#kc-login, .btn-primary, input#kc-login').catch(() => {});
      
      let loggedIn = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        const busterTriggered = await trySolveRecaptcha(page);
        if (busterTriggered) {
          await page.click('button[type="submit"], input[type="submit"], button#kc-login, .btn-primary, input#kc-login').catch(() => {});
        }
        await new Promise(r => setTimeout(r, 1000));
        const currentUrl = page.url();
        if (!currentUrl.includes('login') && !currentUrl.includes('openid-connect/auth')) {
          loggedIn = true;
          break;
        }
      }
      if (!loggedIn) {
         throw new Error(
           "El login en segundo plano falló o requiere resolver un CAPTCHA. " +
           "Por favor, ejecuta temporalmente el worker de forma visible para iniciar sesión manualmente una vez (ejecuta: $env:HEADLESS='false'; npm run worker:sri o pon HEADLESS=false en tu .env). " +
           "Una vez iniciada la sesión, se guardará en la carpeta './browser_session' y podrás volver al modo headless."
         );
      }
    } else {
      await updateProgress('Modo interactivo: Resuelve el CAPTCHA (si es necesario) e iniciando sesión...');
      
      const hasCaptcha = await page.evaluate(() => {
        return document.querySelector('iframe[src*="recaptcha"]') !== null ||
               document.querySelector('.g-recaptcha') !== null ||
               document.getElementById('g-recaptcha-response') !== null;
      });

      if (hasCaptcha && ANTICAPTCHA_KEY) {
        await updateProgress('Se detectó CAPTCHA en el login. Intentando resolver con Anti-Captcha...');
        await solveRecaptchaAntiCaptcha(page);
      }
      
      await updateProgress('Haciendo clic en ingresar...');
      await page.click('button[type="submit"], input[type="submit"], button#kc-login, .btn-primary, input#kc-login').catch(() => {});
      
      let loggedIn = false;
      for (let attempt = 0; attempt < 120; attempt++) {
        const busterTriggered = await trySolveRecaptcha(page);
        if (busterTriggered) {
          await page.click('button[type="submit"], input[type="submit"], button#kc-login, .btn-primary, input#kc-login').catch(() => {});
        }
        await new Promise(r => setTimeout(r, 1000));
        const currentUrl = page.url();
        if (!currentUrl.includes('login') && !currentUrl.includes('openid-connect/auth')) {
          loggedIn = true;
          break;
        }
      }
      if (!loggedIn) {
         throw new Error(
           "No se detectó el inicio de sesión en los 120 segundos de espera. Por favor, reintenta."
         );
      }
    }
    await updateProgress('✅ Sesión iniciada correctamente.');
  } else {
    await updateProgress('✅ Sesión previa detectada. Usuario ya logeado.');
  }
  
  return true;
}
