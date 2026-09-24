const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

(async () => {
  console.log('Iniciando navegador para mapear el DOM de Comprobantes Recibidos...');
  const browser = await puppeteer.launch({
    headless: true,
    userDataDir: path.resolve('./browser_session'),
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Check if session is active
  await page.goto('https://srienlinea.sri.gob.ec/sri-en-linea/contribuyente/perfil', { waitUntil: 'networkidle2', timeout: 60000 });
  
  const currentUrl = page.url();
  if (currentUrl.includes('login') || currentUrl.includes('openid-connect/auth')) {
    console.log('ERROR: No hay sesión activa en browser_session. Por favor inicia sesión primero.');
    await browser.close();
    process.exit(1);
  }

  console.log('Sesión activa confirmada. Navegando a Comprobantes Recibidos vía ruteador del portal...');
  await page.goto('https://srienlinea.sri.gob.ec/tuportal-internet/accederAplicacion.jspa?redireccion=57&idGrupo=55', { 
    waitUntil: 'networkidle2',
    timeout: 60000
  });
  
  await new Promise(r => setTimeout(r, 8000)); // Esperar a que cargue la redirección y el formulario
  
  // Guardar HTML del formulario principal
  const formHtml = await page.evaluate(() => {
    const form = document.querySelector('form#frmPrincipal') || document.querySelector('form');
    return form ? form.innerHTML : document.body.innerHTML;
  });

  fs.writeFileSync('sri-recibidos-dump.html', formHtml);
  console.log('DOM mapeado correctamente a sri-recibidos-dump.html');
  
  // Tomar captura de pantalla
  const downloadsDir = path.resolve('./downloads');
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);
  await page.screenshot({ path: path.join(downloadsDir, 'sri-recibidos-screenshot.png'), fullPage: true });
  console.log('Screenshot guardado en downloads/sri-recibidos-screenshot.png');

  await browser.close();
  process.exit(0);
})();
