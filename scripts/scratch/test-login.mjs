import { config } from 'dotenv';
config({ path: '.env' });

const API_URL = 'http://localhost:3000/api';

async function testLogin(identifier, password) {
  console.log(`\n🔑 Intentando login para: "${identifier}"...`);
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: identifier, password }),
    });

    const data = await res.json();
    if (res.ok) {
      console.log('✅ LOGIN EXITOSO!');
      console.log('👤 Usuario devuelto:', data.user);
      console.log('🎫 Token expira en:', data.expiresIn, 'segundos');
      return true;
    } else {
      console.log('❌ LOGIN FALLIDO:', data.message || res.statusText);
      return false;
    }
  } catch (err) {
    console.error('💥 Error de conexión:', err.message);
    return false;
  }
}

async function runTests() {
  const pass = 'ClientePass123!';
  
  // 1. Probar login con Email
  const ok1 = await testLogin('clientedeprueba@example.com', pass);
  
  // 2. Probar login con RUC
  const ok2 = await testLogin('0704439892001', pass);
  
  if (ok1 && ok2) {
    console.log('\n🎉 ¡AMBOS LOGINS FUNCIONAN PERFECTAMENTE!');
  } else {
    console.log('\n❌ Fallaron una o ambas pruebas.');
  }
}

runTests();
