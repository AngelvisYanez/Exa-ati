import { resolve } from 'path';
import { existsSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables before importing code that checks them
const envLocalPath = resolve(__dirname, '../.env.local');
const envPath = resolve(__dirname, '../.env');
config({ path: existsSync(envLocalPath) ? envLocalPath : envPath });

async function testConnection() {
  console.log('Testing SRI Connection (Producción - Ambiente 2)...');
  try {
    const { sriSoapClient } = await import('../src/lib/sri-api/sri-soap-client');
    const res = await sriSoapClient.testConnection('2');
    console.log(JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

testConnection();
