const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

puppeteer.use(StealthPlugin());

(async () => {
  let browser;
  try {
    const isHeadless = process.env.HEADLESS !== 'false';
    console.log(`Iniciando navegador (headless: ${isHeadless})...`);
    
    browser = await puppeteer.launch({
      headless: isHeadless ? 'shell' : false,
      defaultViewport: null,
      userDataDir: path.resolve('./browser_session'),
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox']
    });

    const page = await browser.newPage();
    
    console.log('Verificando sesión...');
    await page.goto('https://srienlinea.sri.gob.ec/sri-en-linea/contribuyente/perfil', {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });
    
    await new Promise(r => setTimeout(r, 4000));
    
    const currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('openid-connect/auth')) {
      console.log('Iniciando sesión...');
      const userSelector = await page.waitForSelector('input#usuario, input#username, input[name="username"], input[name="usuario"]');
      await userSelector.type('0704439892001');
      const passSelector = await page.$('input#password, input[name="password"]');
      await passSelector.type('TorresC2024@');
      await page.click('button[type="submit"], input[type="submit"], button#kc-login, .btn-primary, input#kc-login');
      await new Promise(r => setTimeout(r, 6000));
    }
    
    console.log('Navegando a Comprobantes Recibidos...');
    await page.goto('https://srienlinea.sri.gob.ec/tuportal-internet/accederAplicacion.jspa?redireccion=57&idGrupo=55', { 
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });
    
    await new Promise(r => setTimeout(r, 6000));
    
    console.log('Configurando fechas de búsqueda...');
    await page.waitForSelector('select[id*="ano"]');
    await page.select('select[id*="ano"]', '2026');
    await new Promise(r => setTimeout(r, 1000));
    await page.select('select[id*="mes"]', '6');
    await new Promise(r => setTimeout(r, 1000));
    await page.select('select[id*="dia"]', '2');
    await new Promise(r => setTimeout(r, 1000));
    await page.select('select[id*="cmbTipoComprobante"]', '1');
    await new Promise(r => setTimeout(r, 1000));
    
    let tableExists = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      console.log(`Intento de búsqueda ${attempt + 1}...`);
      await page.click('button[id*="btnBuscar"], button[id*="Buscar"]');
      await new Promise(r => setTimeout(r, 5000));
      
      tableExists = await page.evaluate(() => {
        return document.querySelector('#frmPrincipal\\:tablaCompRecibidos, [id*="tablaCompRecibidos"]') !== null;
      });
      
      if (tableExists) {
        console.log('¡Tabla encontrada!');
        break;
      }
      
      // Close captcha dialog if any
      await page.evaluate(() => {
        const closeBtn = document.querySelector('.ui-messages-close, [class*="close"]');
        if (closeBtn) closeBtn.click();
      }).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
    }
    
    if (tableExists) {
      const rowHtml = await page.evaluate(() => {
        const table = document.querySelector('#frmPrincipal\\:tablaCompRecibidos, [id*="tablaCompRecibidos"]');
        const rows = Array.from(table.querySelectorAll('tr')).filter(tr => tr.innerText.match(/\d{49}/) !== null);
        if (rows.length > 0) {
          return {
            rowOuter: rows[0].outerHTML,
            cells: Array.from(rows[0].querySelectorAll('td')).map((c, i) => ({
              index: i,
              outerHTML: c.outerHTML
            }))
          };
        }
        return null;
      });
      
      if (rowHtml) {
        fs.writeFileSync('./scratch/row-html.txt', JSON.stringify(rowHtml, null, 2), 'utf8');
        console.log('HTML de la fila guardado en ./scratch/row-html.txt');
      } else {
        console.log('No se encontraron filas con claves de acceso.');
      }
    } else {
      console.log('La tabla de resultados no apareció.');
    }
    
  } catch (e) {
    console.error(e);
  } finally {
    if (browser) await browser.close();
  }
})();
