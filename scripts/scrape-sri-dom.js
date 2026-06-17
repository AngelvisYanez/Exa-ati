const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

(async () => {
  console.log('Iniciando navegador para mapear el DOM del SRI...');
  const browser = await puppeteer.launch({
    headless: true, // We hope the user is already logged in the persistent session
    userDataDir: path.resolve('./browser_session'),
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Go to profile to see if logged in
  await page.goto('https://srienlinea.sri.gob.ec/sri-en-linea/contribuyente/perfil', { waitUntil: 'networkidle2' });
  
  if (page.url().includes('login')) {
    console.log('ERROR: No hay sesion activa guardada. No se puede mapear el portal.');
    await browser.close();
    process.exit(1);
  }

  console.log('Sesion activa confirmada. Navegando a Validez de Comprobantes...');
  await page.goto('https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/publico/validezComprobantes.jsf', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 5000)); // Esperar a que cargue el form
  
  // Dump the form HTML
  const formHtml = await page.evaluate(() => {
    const form = document.querySelector('form#frmPrincipal');
    return form ? form.innerHTML : document.body.innerHTML;
  });

  fs.writeFileSync('sri-dom-dump.html', formHtml);
  console.log('DOM mapeado correctamente a sri-dom-dump.html');
  
  await browser.close();
})();
