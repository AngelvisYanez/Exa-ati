import fetch from 'node-fetch';

async function test() {
  const baseUrl = 'http://localhost:3000';

  console.log('1. Iniciando sesión...');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@exa-ati.com', password: 'Test123456' })
  });
  
  if (!loginRes.ok) {
    console.error('Error en login:', await loginRes.text());
    return;
  }
  
  const loginData = await loginRes.json();
  const token = loginData.access_token;
  if (!token) {
    console.error('No se recibió token en el login');
    return;
  }
  
  console.log('Login exitoso.');

  console.log('2. Vinculando SRI...');
  const vincularRes = await fetch(`${baseUrl}/api/sri/vincular`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ ruc: '0704439892001', sriPassword: 'TorresC2024@' })
  });

  console.log('Status Vincular:', vincularRes.status);
  const data = await vincularRes.json();
  console.log('Respuesta Vincular:', JSON.stringify(data, null, 2));

  if (vincularRes.ok) {
    console.log('3. Iniciando Scraping de Comprobantes Recibidos...');
    const scrapingRes = await fetch(`${baseUrl}/api/sri/scraping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ruc: '0704439892001',
        clave_sri: 'TorresC2024@',
        fecha_desde: '2024-05-01',
        fecha_hasta: '2024-05-31',
        tipo_comprobante: '1'
      })
    });

    console.log('Status Scraping:', scrapingRes.status);
    const scrapData = await scrapingRes.json();
    console.log('Respuesta Scraping:', JSON.stringify(scrapData, null, 2));

    if (scrapingRes.ok && scrapData.jobId) {
      console.log('4. Disparando Sincronización en background (Worker)...');
      // No le ponemos await para simular la vista del cliente o lo awaitamos para ver logs
      const syncRes = await fetch(`${baseUrl}/api/sri/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ jobId: scrapData.jobId })
      });
      console.log('Status Sync API:', syncRes.status);
      const syncData = await syncRes.json();
      console.log('Respuesta Sync API:', JSON.stringify(syncData, null, 2));
    }
  }
}

test().catch(console.error);
