const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

(async () => {
  console.log('Iniciando navegador con la sesión activa...');
  const browser = await puppeteer.launch({
    headless: true,
    userDataDir: path.resolve('./browser_session'),
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  console.log('Navegando a la página de perfil para cargar el menú...');
  await page.goto('https://srienlinea.sri.gob.ec/sri-en-linea/contribuyente/perfil', { waitUntil: 'networkidle2', timeout: 60000 });
  
  if (page.url().includes('login')) {
    console.log('ERROR: No hay sesión activa.');
    await browser.close();
    process.exit(1);
  }

  console.log('Sesión activa. Extrayendo todos los enlaces del menú lateral...');
  const links = await page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll('a'));
    return allLinks.map(a => ({
      text: a.innerText.trim(),
      href: a.getAttribute('href') || '',
      id: a.getAttribute('id') || '',
      onclick: a.getAttribute('onclick') || ''
    }));
  });

  console.log('Enlaces encontrados:', JSON.stringify(links.filter(l => l.text.length > 0), null, 2));

  // Intentemos buscar "Comprobantes electrónicos recibidos" o "Facturación Electrónica"
  const targetLink = links.find(l => l.text.toLowerCase().includes('recibidos'));
  if (targetLink) {
    console.log('Enlace de "Comprobantes Recibidos" encontrado:', targetLink);
  }

  // Tomemos una captura de la página
  await page.screenshot({ path: 'downloads/menu-screenshot.png', fullPage: true });
  console.log('Screenshot de perfil guardado en downloads/menu-screenshot.png');

  await browser.close();
  process.exit(0);
})();
