import { config } from 'dotenv';
config({ path: '.env.local' });
import { sriSoapClient } from './src/lib/sri-api/sri-soap-client';

async function testConnection() {
  console.log('Testing SRI Connection (Pruebas - Ambiente 1)...');
  try {
    const res = await sriSoapClient.testConnection('1');
    console.log(JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

testConnection();
