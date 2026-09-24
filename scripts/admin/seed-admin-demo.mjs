/**
 * scripts/admin/seed-admin-demo.mjs
 *
 * Inserta datos de prueba SOLO en el tenant del usuario ADMIN.
 * No toca otros tenants ni usuarios USER.
 *
 * Uso: node scripts/admin/seed-admin-demo.mjs
 * Env: ADMIN_EMAIL (default admin@ofsercont.com)
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });
neonConfig.webSocketConstructor = ws;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ofsercont.com';
const DEMO_TAG = '[DEMO-ADMIN]';

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL no definido');
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function upsertContacto(client, tenantId, data) {
  const existing = await client.query(
    `SELECT id FROM contactos
     WHERE tenant_id = $1 AND tipo_identificacion = $2 AND identificacion = $3`,
    [tenantId, data.tipoIdentificacion, data.identificacion]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const id = randomUUID();
  await client.query(
    `INSERT INTO contactos (
       id, tenant_id, tipo_identificacion, identificacion, razon_social, nombre_comercial,
       email, telefono, direccion, es_cliente, es_proveedor, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())`,
    [
      id,
      tenantId,
      data.tipoIdentificacion,
      data.identificacion,
      data.razonSocial,
      data.nombreComercial || null,
      data.email || null,
      data.telefono || null,
      data.direccion || null,
      data.esCliente ?? true,
      data.esProveedor ?? false,
    ]
  );
  return id;
}

async function upsertProducto(client, tenantId, data) {
  const existing = await client.query(
    `SELECT id FROM productos WHERE tenant_id = $1 AND codigo = $2`,
    [tenantId, data.codigo]
  );
  if (existing.rows[0]) {
    await client.query(
      `UPDATE productos SET nombre=$1, precio_unitario=$2, stock=$3, iva_porcentaje=$4, updated_at=NOW()
       WHERE id=$5`,
      [data.nombre, data.precio, data.stock, data.iva, existing.rows[0].id]
    );
    return existing.rows[0].id;
  }
  const id = randomUUID();
  await client.query(
    `INSERT INTO productos (
       id, tenant_id, codigo, nombre, descripcion, precio_unitario, iva_porcentaje, stock, activo, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,NOW(),NOW())`,
    [
      id,
      tenantId,
      data.codigo,
      data.nombre,
      data.descripcion || `${DEMO_TAG} ${data.nombre}`,
      data.precio,
      data.iva,
      data.stock,
    ]
  );
  return id;
}

async function upsertEmpleado(client, tenantId, data) {
  const existing = await client.query(
    `SELECT id FROM empleados WHERE tenant_id = $1 AND cedula = $2`,
    [tenantId, data.cedula]
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const id = randomUUID();
  await client.query(
    `INSERT INTO empleados (
       id, tenant_id, cedula, nombres, apellidos, email, telefono, cargo, fecha_ingreso, sueldo, activo, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,NOW(),NOW())`,
    [
      id,
      tenantId,
      data.cedula,
      data.nombres,
      data.apellidos,
      data.email || null,
      data.telefono || null,
      data.cargo || null,
      data.fechaIngreso || null,
      data.sueldo,
    ]
  );
  return id;
}

async function ensureEmisor(client, tenantId, adminRuc) {
  const existing = await client.query(
    `SELECT id, ruc FROM emisores WHERE tenant_id = $1 AND activo = true ORDER BY created_at ASC LIMIT 1`,
    [tenantId]
  );
  if (existing.rows[0]) return existing.rows[0];

  const id = randomUUID();
  const ruc = adminRuc || '1790000000001';
  await client.query(
    `INSERT INTO emisores (
       id, tenant_id, ruc, razon_social, nombre_comercial, ambiente, tipo_emision,
       establecimiento, punto_emision, dir_matriz, obligado_contabilidad, activo, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,'1','1','001','001',$6,'SI',true,NOW(),NOW())`,
    [
      id,
      tenantId,
      ruc,
      `Demo OFSERCONT ${DEMO_TAG}`,
      'Demo Admin',
      'Quito, Ecuador',
    ]
  );
  return { id, ruc };
}

async function insertComprobanteIfMissing(client, tenantId, emisor, data) {
  const existing = await client.query(
    `SELECT id FROM comprobantes WHERE clave_acceso = $1`,
    [data.claveAcceso]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const id = randomUUID();
  await client.query(
    `INSERT INTO comprobantes (
       id, tenant_id, emisor_id, clave_acceso, tipo, serie, secuencial, ambiente, tipo_emision,
       estado, estado_sri, fecha_emision, fecha_autorizacion, numero_autorizacion,
       importe_total, total_sin_impuesto, subtotal_sin_impuesto, total_iva, total_descuento,
       receptor_tipo_id, receptor_identificacion, receptor_razon_social, receptor_email,
       emisor_ruc, emisor_razon_social, created_at, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,'1','1',
       $8,$8,$9,$10,$11,
       $12,$13,$13,$14,0,
       $15,$16,$17,$18,
       $19,$20,NOW(),NOW()
     )`,
    [
      id,
      tenantId,
      emisor.id,
      data.claveAcceso,
      data.tipo,
      data.serie,
      data.secuencial,
      data.estado,
      data.fechaEmision,
      data.estado === 'AUTORIZADO' ? data.fechaEmision : null,
      data.estado === 'AUTORIZADO' ? data.claveAcceso : null,
      data.importeTotal,
      data.subtotal,
      data.iva,
      data.receptorTipoId,
      data.receptorId,
      data.receptorNombre,
      data.receptorEmail || null,
      data.esCompra ? data.emisorRuc : emisor.ruc,
      data.esCompra ? data.emisorNombre : `Demo OFSERCONT ${DEMO_TAG}`,
    ]
  );
  return id;
}

async function insertCxcIfMissing(client, tenantId, data) {
  const existing = await client.query(
    `SELECT id FROM cuentas_por_cobrar
     WHERE tenant_id = $1 AND numero_documento = $2`,
    [tenantId, data.numeroDocumento]
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const id = randomUUID();
  await client.query(
    `INSERT INTO cuentas_por_cobrar (
       id, tenant_id, cliente_tipo_id, cliente_identificacion, cliente_nombre, cliente_email,
       tipo_documento, numero_documento, fecha_emision, fecha_vencimiento,
       monto_original, saldo_pendiente, estado, notas, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())`,
    [
      id,
      tenantId,
      data.tipoId,
      data.identificacion,
      data.nombre,
      data.email || null,
      data.tipoDocumento || '01',
      data.numeroDocumento,
      data.fechaEmision,
      data.fechaVencimiento,
      data.monto,
      data.saldo,
      data.estado,
      `${DEMO_TAG} ${data.notas || ''}`.trim(),
    ]
  );
  return id;
}

async function insertCxpIfMissing(client, tenantId, data) {
  const existing = await client.query(
    `SELECT id FROM cuentas_por_pagar
     WHERE tenant_id = $1 AND numero_documento = $2`,
    [tenantId, data.numeroDocumento]
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const id = randomUUID();
  await client.query(
    `INSERT INTO cuentas_por_pagar (
       id, tenant_id, proveedor_tipo_id, proveedor_identificacion, proveedor_nombre, proveedor_email,
       tipo_documento, numero_documento, fecha_emision, fecha_vencimiento,
       monto_original, saldo_pendiente, estado, notas, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())`,
    [
      id,
      tenantId,
      data.tipoId,
      data.identificacion,
      data.nombre,
      data.email || null,
      data.tipoDocumento || '01',
      data.numeroDocumento,
      data.fechaEmision,
      data.fechaVencimiento,
      data.monto,
      data.saldo,
      data.estado,
      `${DEMO_TAG} ${data.notas || ''}`.trim(),
    ]
  );
  return id;
}

async function insertAsientoDemo(client, tenantId) {
  const existing = await client.query(
    `SELECT id FROM asientos WHERE tenant_id = $1 AND glosa LIKE $2 LIMIT 1`,
    [tenantId, `${DEMO_TAG}%`]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const numRes = await client.query(
    `SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM asientos WHERE tenant_id = $1`,
    [tenantId]
  );
  const numero = Number(numRes.rows[0].n);
  const asientoId = randomUUID();
  await client.query(
    `INSERT INTO asientos (id, tenant_id, fecha, numero, glosa, origen, estado, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'DEMO','CONFIRMADO',NOW(),NOW())`,
    [asientoId, tenantId, daysAgo(3), numero, `${DEMO_TAG} Venta demo IVA`]
  );
  const lineas = [
    { codigo: '1.1.02.01', nombre: 'Cuentas por cobrar', debe: 115, haber: 0, orden: 1 },
    { codigo: '4.1.01.01', nombre: 'Ventas', debe: 0, haber: 100, orden: 2 },
    { codigo: '2.1.03.01', nombre: 'IVA por pagar', debe: 0, haber: 15, orden: 3 },
  ];
  for (const l of lineas) {
    await client.query(
      `INSERT INTO asiento_lineas (id, asiento_id, cuenta_codigo, cuenta_nombre, debe, haber, orden)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [randomUUID(), asientoId, l.codigo, l.nombre, l.debe, l.haber, l.orden]
    );
  }
  return asientoId;
}

async function insertKardexDemo(client, tenantId, productoId) {
  const existing = await client.query(
    `SELECT id FROM inventario_movimientos
     WHERE tenant_id = $1 AND producto_id = $2 AND motivo LIKE $3 LIMIT 1`,
    [tenantId, productoId, `${DEMO_TAG}%`]
  );
  if (existing.rows[0]) return;

  await client.query(
    `INSERT INTO inventario_movimientos (
       id, tenant_id, producto_id, tipo, cantidad, stock_antes, stock_despues, motivo, referencia, created_at
     ) VALUES ($1,$2,$3,'ENTRADA',50,0,50,$4,'SEED-DEMO',NOW())`,
    [randomUUID(), tenantId, productoId, `${DEMO_TAG} Ingreso inicial`]
  );
}

async function insertObligacionDemo(client, tenantId, ruc) {
  const periodo = Number(
    `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );
  const existing = await client.query(
    `SELECT id FROM obligaciones_externas
     WHERE tenant_id = $1 AND ruc = $2 AND tipo = 'IVA' AND periodo = $3`,
    [tenantId, ruc, periodo]
  );
  if (existing.rows[0]) return;
  await client.query(
    `INSERT INTO obligaciones_externas (
       id, tenant_id, ruc, tipo, periodo, descripcion, fecha_vencimiento, estado, observaciones, created_at, updated_at
     ) VALUES ($1,$2,$3,'IVA',$4,$5,$6,'PENDIENTE',$7,NOW(),NOW())`,
    [
      randomUUID(),
      tenantId,
      ruc,
      periodo,
      `Declaración IVA ${periodo}`,
      daysFromNow(10),
      `${DEMO_TAG} Semáforo demo`,
    ]
  );
}

async function main() {
  const client = await pool.connect();
  try {
    const adminRes = await client.query(
      `SELECT id, email, rol, tenant_id, ruc, nombre
       FROM usuarios
       WHERE LOWER(email) = LOWER($1) AND rol IN ('ADMIN', 'SUPERADMIN')
       LIMIT 1`,
      [ADMIN_EMAIL]
    );
    const admin = adminRes.rows[0];
    if (!admin) {
      console.error(`No hay usuario ADMIN con email ${ADMIN_EMAIL}. Ejecuta setup-admin primero.`);
      process.exit(1);
    }
    if (!admin.tenant_id) {
      console.error('El admin no tiene tenant_id asignado.');
      process.exit(1);
    }

    const tenantId = admin.tenant_id;
    const tenantRes = await client.query(`SELECT id, nombre, ruc FROM tenants WHERE id = $1`, [
      tenantId,
    ]);
    const tenant = tenantRes.rows[0];
    console.log(`Seed demo SOLO admin → ${admin.email} / tenant ${tenant?.nombre || tenantId}`);

    // Asegurar que ningún otro tenant reciba datos: todo usa tenantId del admin
    const emisor = await ensureEmisor(client, tenantId, admin.ruc || tenant?.ruc);

    const cCliente = await upsertContacto(client, tenantId, {
      tipoIdentificacion: '04',
      identificacion: '1790012345001',
      razonSocial: 'Cliente Demo S.A.',
      nombreComercial: 'Cliente Demo',
      email: 'cliente.demo@example.com',
      telefono: '0991112233',
      direccion: 'Av. Amazonas N12, Quito',
      esCliente: true,
      esProveedor: false,
    });
    const cProveedor = await upsertContacto(client, tenantId, {
      tipoIdentificacion: '04',
      identificacion: '0991122334001',
      razonSocial: 'Proveedor Demo Cia. Ltda.',
      email: 'proveedor.demo@example.com',
      telefono: '042222333',
      direccion: 'Guayaquil',
      esCliente: false,
      esProveedor: true,
    });
    const cConsumidor = await upsertContacto(client, tenantId, {
      tipoIdentificacion: '07',
      identificacion: '9999999999999',
      razonSocial: 'CONSUMIDOR FINAL',
      esCliente: true,
      esProveedor: false,
    });

    const p1 = await upsertProducto(client, tenantId, {
      codigo: 'DEMO-001',
      nombre: 'Servicio de consultoría',
      descripcion: `${DEMO_TAG} Servicio profesional`,
      precio: 100,
      iva: 15,
      stock: 100,
    });
    const p2 = await upsertProducto(client, tenantId, {
      codigo: 'DEMO-002',
      nombre: 'Licencia software anual',
      precio: 250,
      iva: 15,
      stock: 25,
    });
    await upsertProducto(client, tenantId, {
      codigo: 'DEMO-003',
      nombre: 'Producto exento IVA',
      precio: 40,
      iva: 0,
      stock: 80,
    });

    await upsertEmpleado(client, tenantId, {
      cedula: '1712345678',
      nombres: 'Ana',
      apellidos: 'Pérez Demo',
      email: 'ana.demo@ofsercont.com',
      cargo: 'Contadora',
      fechaIngreso: '2024-01-15',
      sueldo: 850,
    });
    await upsertEmpleado(client, tenantId, {
      cedula: '1723456789',
      nombres: 'Luis',
      apellidos: 'García Demo',
      email: 'luis.demo@ofsercont.com',
      cargo: 'Asistente',
      fechaIngreso: '2025-03-01',
      sueldo: 520,
    });

    // Claves de acceso ficticias de 49 dígitos (solo demo UI)
    const claveVenta = '1790000000001010123456789012345678901234567890123';
    const claveCompra = '0991122334001010123456789012345678901234567890456';

    await insertComprobanteIfMissing(client, tenantId, emisor, {
      claveAcceso: claveVenta,
      tipo: '01',
      serie: '001-001',
      secuencial: '000000001',
      estado: 'AUTORIZADO',
      fechaEmision: daysAgo(5),
      subtotal: 100,
      iva: 15,
      importeTotal: 115,
      receptorTipoId: '04',
      receptorId: '1790012345001',
      receptorNombre: 'Cliente Demo S.A.',
      receptorEmail: 'cliente.demo@example.com',
      esCompra: false,
    });

    await insertComprobanteIfMissing(client, tenantId, emisor, {
      claveAcceso: claveCompra,
      tipo: '01',
      serie: '001-002',
      secuencial: '000000010',
      estado: 'AUTORIZADO',
      fechaEmision: daysAgo(12),
      subtotal: 200,
      iva: 30,
      importeTotal: 230,
      receptorTipoId: '04',
      receptorId: emisor.ruc,
      receptorNombre: `Demo OFSERCONT ${DEMO_TAG}`,
      emisorRuc: '0991122334001',
      emisorNombre: 'Proveedor Demo Cia. Ltda.',
      esCompra: true,
    });

    await insertCxcIfMissing(client, tenantId, {
      tipoId: '04',
      identificacion: '1790012345001',
      nombre: 'Cliente Demo S.A.',
      email: 'cliente.demo@example.com',
      numeroDocumento: '001-001-000000001',
      fechaEmision: daysAgo(40),
      fechaVencimiento: daysAgo(10),
      monto: 115,
      saldo: 115,
      estado: 'VENCIDO',
      notas: 'Factura vencida demo',
    });
    await insertCxcIfMissing(client, tenantId, {
      tipoId: '04',
      identificacion: '1790012345001',
      nombre: 'Cliente Demo S.A.',
      numeroDocumento: '001-001-000000002',
      fechaEmision: daysAgo(5),
      fechaVencimiento: daysFromNow(25),
      monto: 287.5,
      saldo: 150,
      estado: 'PARCIAL',
      notas: 'Abono parcial demo',
    });

    await insertCxpIfMissing(client, tenantId, {
      tipoId: '04',
      identificacion: '0991122334001',
      nombre: 'Proveedor Demo Cia. Ltda.',
      numeroDocumento: '001-002-000000010',
      fechaEmision: daysAgo(12),
      fechaVencimiento: daysFromNow(18),
      monto: 230,
      saldo: 230,
      estado: 'PENDIENTE',
      notas: 'Compra demo',
    });

    await insertAsientoDemo(client, tenantId);
    await insertKardexDemo(client, tenantId, p1);
    await insertObligacionDemo(client, tenantId, emisor.ruc);

    // Transportista demo (si existe tabla)
    try {
      const tr = await client.query(
        `SELECT id FROM transportistas WHERE tenant_id = $1 AND ruc = $2 AND placa = $3`,
        [tenantId, '1799988877001', 'ABC1234']
      );
      if (!tr.rows[0]) {
        await client.query(
          `INSERT INTO transportistas (
             id, tenant_id, ruc, razon_social, tipo_identificacion, placa, direccion, telefono, email, activo, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,'04',$5,$6,$7,$8,true,NOW(),NOW())`,
          [
            randomUUID(),
            tenantId,
            '1799988877001',
            'Transportes Demo Ecuador',
            'ABC1234',
            'Quito',
            '0987654321',
            'transporte.demo@example.com',
          ]
        );
      }
    } catch {
      /* tabla opcional */
    }

    const counts = await client.query(
      `SELECT
         (SELECT count(*)::int FROM contactos WHERE tenant_id = $1) AS contactos,
         (SELECT count(*)::int FROM productos WHERE tenant_id = $1) AS productos,
         (SELECT count(*)::int FROM empleados WHERE tenant_id = $1) AS empleados,
         (SELECT count(*)::int FROM comprobantes WHERE tenant_id = $1) AS comprobantes,
         (SELECT count(*)::int FROM cuentas_por_cobrar WHERE tenant_id = $1) AS cxc,
         (SELECT count(*)::int FROM cuentas_por_pagar WHERE tenant_id = $1) AS cxp,
         (SELECT count(*)::int FROM asientos WHERE tenant_id = $1) AS asientos`,
      [tenantId]
    );

    console.log('Datos demo en tenant admin:', counts.rows[0]);
    console.log(`Contactos refs: cliente=${cCliente.slice(0, 8)}… proveedor=${cProveedor.slice(0, 8)}… cf=${cConsumidor.slice(0, 8)}…`);
    console.log(`Productos: ${p1.slice(0, 8)}… / ${p2.slice(0, 8)}…`);
    console.log('Listo. Otros tenants no fueron modificados.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error seed admin demo:', err.message);
  process.exit(1);
});
