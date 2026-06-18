import { config } from 'dotenv';
config({ path: '.env' });

const API_URL = 'http://localhost:3000/api';

async function testLogin(identifier, password) {
  console.log(`\n🔑 Intentando login para RUC: "${identifier}" con contraseña: "${password}"...`);
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
  const ruc = '0704439892001';
  
  // 1. Probar RUC con contraseña de Administrador
  await testLogin(ruc, 'Ofsercont2026');
  
  // 2. Probar RUC con contraseña de Cliente
  await testLogin(ruc, 'ClientePass123!');
}

runTests();
