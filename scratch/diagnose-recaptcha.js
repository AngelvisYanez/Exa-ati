const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');

puppeteer.use(StealthPlugin());

(async () => {
  console.log('Launching browser to diagnose Recaptcha...');
  const browser = await puppeteer.launch({
    headless: true,
    userDataDir: path.resolve('./browser_session'),
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[Browser Console] [${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.error(`[Browser PageError] ${err.message}`);
  });

  console.log('Navigating to Comprobantes Recibidos...');
  await page.goto('https://srienlinea.sri.gob.ec/tuportal-internet/accederAplicacion.jspa?redireccion=57&idGrupo=55', { 
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await new Promise(r => setTimeout(r, 8000));
  
  console.log('Current URL:', page.url());
  const diagPath = path.resolve('./downloads/diag-recaptcha.png');
  await page.screenshot({ path: diagPath, fullPage: true });
  console.log('Screenshot saved to:', diagPath);

  console.log('Evaluating recaptcha functions...');
  try {
    const recaptchaInfo = await page.evaluate(() => {
      return {
        hasGrecaptcha: typeof grecaptcha !== 'undefined',
        grecaptchaKeys: typeof grecaptcha !== 'undefined' ? Object.keys(grecaptcha) : [],
        executeRecaptchaDef: typeof executeRecaptcha !== 'undefined' ? executeRecaptcha.toString() : 'undefined',
        cargarRecaptchaDef: typeof cargarRecaptcha !== 'undefined' ? cargarRecaptcha.toString() : 'undefined',
        resetarRecaptchaDef: typeof resetarRecaptcha !== 'undefined' ? resetarRecaptcha.toString() : 'undefined',
      };
    });

    console.log('--- RECAPTCHA INFO ---');
    console.log(JSON.stringify(recaptchaInfo, null, 2));
  } catch (err) {
    console.error('Error evaluating:', err.message);
  }

  await browser.close();
})();
