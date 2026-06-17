const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');

puppeteer.use(StealthPlugin());

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'shell',
      defaultViewport: null,
      userDataDir: path.resolve('./browser_session'),
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox']
    });

    const page = await browser.newPage();
    
    // Navigate to recibidos page
    console.log('Navegando a Comprobantes Recibidos...');
    await page.goto('https://srienlinea.sri.gob.ec/tuportal-internet/accederAplicacion.jspa?redireccion=57&idGrupo=55', { 
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });
    
    await new Promise(r => setTimeout(r, 6000));
    
    const tableSelector = '#frmPrincipal\\:tablaCompRecibidos, [id*="tablaCompRecibidos"]';
    
    const tableExists = await page.evaluate((sel) => {
      return document.querySelector(sel) !== null;
    }, tableSelector);
    
    console.log('¿La tabla existe en la página?', tableExists);
    
    if (tableExists) {
      const info = await page.evaluate((sel) => {
        const table = document.querySelector(sel);
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim());
        const rows = Array.from(table.querySelectorAll('tr')).map(tr => {
          const cells = Array.from(tr.querySelectorAll('td, th')).map(c => c.innerText.trim());
          return {
            classes: tr.className,
            cells: cells
          };
        });
        return { headers, rows };
      }, tableSelector);
      
      console.log('--- HEADERS ENCONTRADOS ---');
      console.log(info.headers);
      console.log('--- FILAS ENCONTRADAS ---');
      console.log(JSON.stringify(info.rows, null, 2));
    } else {
      console.log('HTML body text preview:', await page.evaluate(() => document.body.innerText.substring(0, 1000)));
    }
    
  } catch (e) {
    console.error(e);
  } finally {
    if (browser) await browser.close();
  }
})();
