import mysql from 'mysql2/promise';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return {};
  const lines = readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv();

async function main() {
  const lockFilePath = join(__dirname, '..', 'sri-worker.lock');
  const workerRunning = existsSync(lockFilePath);
  
  console.log('👷 Verificando el worker local...');
  console.log(`   ✓ Archivo de bloqueo (sri-worker.lock) existe: ${workerRunning ? 'SÍ' : 'NO'}`);
  
  if (workerRunning) {
    try {
      const pid = readFileSync(lockFilePath, 'utf8').trim();
      console.log(`   ✓ PID del worker registrado: ${pid}`);
    } catch (e) {}
  } else {
    console.log('⚠️  El worker no parece estar ejecutándose (no se encontró sri-worker.lock).');
  }

  console.log('\n📡 Conectando a MariaDB/MySQL local...');
  const conn = await mysql.createConnection({
    host: env.DB_HOST || 'localhost',
    port: parseInt(env.DB_PORT || '3306', 10),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'db_sri',
  });

  // Limpiar trabajos previos para no tener ruido
  await conn.query("DELETE FROM scraping_jobs WHERE ruc = '0704439892001'");

  console.log('📥 Insertando un trabajo de prueba (PENDING) en la base de datos local...');
  const [insertResult] = await conn.query(
    `INSERT INTO scraping_jobs 
      (ruc, clave_sri, action_type, status, progress_message, created_at, updated_at) 
     VALUES 
      ('0704439892001', 'TorresC2024@', 'DOWNLOAD_RECEIVED', 'PENDING', 'Insertado por script de prueba', NOW(), NOW())`
  );
  
  const jobId = insertResult.insertId;
  console.log(`   ✓ Trabajo insertado con ID: ${jobId}`);

  console.log('⏱️  Esperando a que el worker detecte el trabajo...');
  
  let success = false;
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const [rows] = await conn.query("SELECT status, progress_message FROM scraping_jobs WHERE id = ?", [jobId]);
    const job = rows[0];
    
    console.log(`   [Segundo ${(i + 1) * 3}] Estado: ${job.status} | Mensaje: ${job.progress_message}`);
    
    if (job.status === 'PROCESSING' || job.status === 'PROCESSING' || job.progress_message.includes('Iniciando') || job.status === 'ERROR' || job.status === 'COMPLETED') {
      success = true;
      break;
    }
  }

  if (success) {
    console.log('\n✅ El worker en desarrollo respondió correctamente y procesó el trabajo.');
  } else {
    console.log('\n❌ El worker no ha tomado el trabajo en los 18 segundos de espera.');
  }

  // Limpiar el trabajo de prueba
  await conn.query("DELETE FROM scraping_jobs WHERE id = ?", [jobId]);
  await conn.end();
}

main().catch(err => {
  console.error('❌ Error en el script de prueba:', err.message);
  process.exit(1);
});
