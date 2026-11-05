import fetch from 'node-fetch';
import { config } from 'dotenv';

config({ path: '.env' });

const apiKey = process.env.ANTICAPTCHA_KEY;
if (!apiKey) {
  console.error('❌ No hay ANTICAPTCHA_KEY en .env');
  process.exit(1);
}

async function testBalance() {
  console.log(`Checking balance for Anti-Captcha key: ${apiKey}...`);
  try {
    const res = await fetch('https://api.anti-captcha.com/getBalance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientKey: apiKey })
    });
    const data = await res.json();
    console.log('📋 Response from Anti-Captcha API:', data);
  } catch (err) {
    console.error('❌ Error calling Anti-Captcha:', err.message);
  }
}

testBalance();
