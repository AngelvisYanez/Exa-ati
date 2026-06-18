import { config } from 'dotenv';
config({ path: '.env' });

const API_URL = 'http://localhost:3000/api';

// Generar token de admin simulando autenticación
import jwt from 'jsonwebtoken';
const adminPayload = {
  sub: 'fdde9aae-513d-414a-a4e9-db3477d175e5',
  email: 'admin@ofsercont.com',
  rol: 'ADMIN',
  tenantId: 'c5a176cb-e41b-4030-bc5b-e885822cf0f5',
  type: 'access',
};
const token = jwt.sign(adminPayload, process.env.JWT_SECRET || 'sri-jwt-secret-key-32bytes-long-now');

async function testList() {
  console.log('\n--- 1. Probando Listar Usuarios (GET /api/clientes) ---');
  const res = await fetch(`${API_URL}/clientes`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('Estatus:', res.status);
  console.log('Usuarios devueltos:', data.clientes?.map(u => ({ id: u.id, email: u.email, nombre: u.nombre, rol: u.rol, ruc: u.ruc })));
  return data.clientes;
}

async function testUpdate(userId, updates) {
  console.log(`\n--- Probando Actualizar Usuario (PUT /api/clientes/${userId}) ---`);
  console.log('Enviando:', updates);
  const res = await fetch(`${API_URL}/clientes/${userId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  const data = await res.json();
  console.log('Estatus:', res.status);
  console.log('Respuesta:', data);
  return res.ok;
}

async function runTests() {
  const users = await testList();
  const targetUser = users?.find(u => u.email === 'clientedeprueba@example.com');
  if (!targetUser) {
    console.log('❌ No se encontró al usuario clientedeprueba@example.com para probar.');
    return;
  }

  // 1. Promover a ADMIN
  console.log('\n🔄 Promoviendo a ADMIN...');
  const ok1 = await testUpdate(targetUser.id, {
    nombre: 'Cliente de Prueba Modificado',
    email: 'clientedeprueba@example.com',
    rol: 'ADMIN',
    ruc: '' // Los admins tienen acceso global, el RUC debe limpiarse/ignorarse
  });

  if (ok1) {
    await testList(); // Comprobar nuevo listado con roles actualizados
  }

  // 2. Demotear a USER con RUC asignado
  console.log('\n🔄 Demoteando a USER con RUC asignado...');
  const ok2 = await testUpdate(targetUser.id, {
    nombre: 'Cliente de Prueba',
    email: 'clientedeprueba@example.com',
    rol: 'USER',
    ruc: '0704439892001'
  });

  if (ok2) {
    await testList(); // Comprobar restauración
  }
}

runTests();
