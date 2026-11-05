import fetch from 'node-fetch';

const jobId = process.argv[2];
if (!jobId) {
  console.error('❌ Especifica un jobId: node scripts/trigger-job.mjs <jobId>');
  process.exit(1);
}

async function main() {
  console.log(`🚀 Iniciando job ${jobId} a través de la API local...`);
  try {
    const res = await fetch('http://localhost:3000/api/sri/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: parseInt(jobId, 10) })
    });
    const text = await res.text();
    console.log('📋 Respuesta del servidor (raw):', text);
    const data = JSON.parse(text);
    console.log('📋 Respuesta del servidor (parsed):', data);
  } catch (err) {
    console.error('❌ Error de red:', err);
  }
}

main();
