import { db } from '../../src/lib/sri-api/db.js';
import { config } from 'dotenv';

config({ path: '.env' });

async function main() {
  try {
    const emisor = await db.queryOne(
      "SELECT tenant_id FROM emisores WHERE ruc = $1 AND activo = true",
      ['0704439892001']
    );
    console.log('📋 Emisor queryOne result:', emisor);
  } catch (err) {
    console.error('❌ Error executing query:', err.message);
  }
}

main().catch(console.error);
