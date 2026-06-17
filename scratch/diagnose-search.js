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
    
    // Ensure we are logged in
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
    
    console.log('Haciendo clic en Buscar...');
    await page.click('button[id*="btnBuscar"], button[id*="Buscar"]');
    await new Promise(r => setTimeout(r, 6000));
    
    const tableSelector = '#frmPrincipal\\:tablaCompRecibidos, [id*="tablaCompRecibidos"]';
    
    const tableExists = await page.evaluate((sel) => {
      return document.querySelector(sel) !== null;
    }, tableSelector);
    
    if (tableExists) {
      const results = await page.evaluate((sel) => {
        const table = document.querySelector(sel);
        
        // Grab all th texts
        const rawThs = Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim());
        
        // Grab headers using different selectors
        const cleanSel = sel.replace(/\\/g, '');
        const headerSelectors = [
          `${sel} thead th`,
          `[id*="tablaCompRecibidos"] thead th`,
          `${sel} tr.rf-dt-shdr th`,
          `${sel} .rf-dt-shdr th`,
          `${sel} th:not([class*="pagin"]):not([id*="pagin"])`
        ];
        
        const headerResults = {};
        for (const selector of headerSelectors) {
          headerResults[selector] = Array.from(document.querySelectorAll(selector)).map(th => th.innerText.trim().toUpperCase());
        }
        
        // Grab row text lists
        const rows = Array.from(table.querySelectorAll('tr')).map((tr, i) => {
          const cells = Array.from(tr.querySelectorAll('td, th')).map(c => {
            return {
              text: c.innerText.trim(),
              html: c.innerHTML
            };
          });
          return {
            rowIndex: i,
            className: tr.className,
            cells: cells
          };
        });
        
        return { rawThs, headerResults, rows };
      }, tableSelector);
      
      let outText = '=== SEARCH DIAGNOSTICS ===\n\n';
      outText += 'Raw THs found:\n' + JSON.stringify(results.rawThs, null, 2) + '\n\n';
      outText += 'Header Selector Matches:\n' + JSON.stringify(results.headerResults, null, 2) + '\n\n';
      outText += 'Rows found:\n' + JSON.stringify(results.rows, null, 2) + '\n';
      
      fs.writeFileSync('./scratch/search-diagnostics.txt', outText, 'utf8');
      console.log('Resultados de diagnóstico guardados en ./scratch/search-diagnostics.txt');
    } else {
      console.log('La tabla de resultados no apareció.');
    }
    
  } catch (e) {
    console.error(e);
  } finally {
    if (browser) await browser.close();
  }
})();
