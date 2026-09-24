const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

(async () => {
  console.log('Iniciando exploración profunda del portal SRI...');
  const browser = await puppeteer.launch({
    headless: true,
    userDataDir: path.resolve('./browser_session'),
    args: ['--no-sandbox', '--window-size=1280,1024']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1024 });
  
  console.log('Navegando a Validez de Comprobantes...');
  try {
    await page.goto('https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/publico/validezComprobantes.jsf', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    console.log('Timeout en goto, continuando de todas formas...');
  }
  
  // Wait a bit for JSF components to initialize
  await new Promise(r => setTimeout(r, 5000));
  
  // Select "Período" option if it exists to expose the month dropdown
  try {
    const periodoRadios = await page.$$('input[type="radio"]');
    if (periodoRadios.length > 1) {
      console.log('Haciendo clic en la opción de Búsqueda por Período...');
      await periodoRadios[1].evaluate(b => b.click());
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch(e) {
    console.log('No se pudo hacer clic en el radio button:', e);
  }

  // Take screenshot of the initial state
  try {
    await page.screenshot({ path: path.resolve('./downloads/sri-screenshot-1.png'), fullPage: true });
    console.log('Screenshot 1 guardado.');
  } catch(e) {
    console.log('Error tomando screenshot:', e);
  }

  // Try to find if there are radio buttons for "Periodo" or "Mes"
  const html = await page.content();
  fs.writeFileSync(path.resolve('./downloads/sri-full-dump.html'), html);
  
  console.log('Exploración finalizada. Revisa la carpeta downloads.');
  await browser.close();
  process.exit(0);
})();
