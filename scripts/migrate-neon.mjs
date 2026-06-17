/**
 * scripts/migrate-neon.mjs
 * Ejecuta el schema SQL directamente en Neon usando Pool con WebSocket.
 * Uso: node scripts/migrate-neon.mjs
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import { config } from 'dotenv';
import ws from 'ws';

// Cargar variables de entorno
config({ path: '.env' });

// Neon necesita WebSocket en entornos Node.js
neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ No se encontró DATABASE_URL en .env');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const statements = [
  `CREATE SCHEMA IF NOT EXISTS "public"`,

  `CREATE TABLE IF NOT EXISTS "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(255) NOT NULL,
    "ruc" VARCHAR(20),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "nombre" VARCHAR(255),
    "rol" VARCHAR(50) NOT NULL DEFAULT 'USER',
    "tenant_id" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "emisores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "ruc" VARCHAR(20) NOT NULL,
    "razon_social" VARCHAR(500),
    "nombre_comercial" VARCHAR(500),
    "ambiente" VARCHAR(2) NOT NULL DEFAULT '1',
    "tipo_emision" VARCHAR(2) NOT NULL DEFAULT '1',
    "certificado_p12" BYTEA,
    "certificado_password" VARCHAR(500),
    "cert_valido_hasta" TIMESTAMP(3),
    "certificado_valido_hasta" TIMESTAMP(3),
    "clave_sri_encrypted" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "emisores_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "comprobantes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "emisor_id" UUID,
    "clave_acceso" VARCHAR(49) NOT NULL,
    "tipo" VARCHAR(5),
    "serie" VARCHAR(10),
    "secuencial" VARCHAR(20),
    "ambiente" VARCHAR(2),
    "estado" VARCHAR(50) NOT NULL DEFAULT 'PENDIENTE',
    "estado_sri" VARCHAR(50),
    "fecha_emision" DATE,
    "fecha_autorizacion" TIMESTAMP(3),
    "numero_autorizacion" VARCHAR(49),
    "importe_total" DECIMAL(10,2),
    "total_sin_impuesto" DECIMAL(10,2),
    "subtotal_sin_impuesto" DECIMAL(10,2),
    "total_iva" DECIMAL(10,2),
    "total_descuento" DECIMAL(10,2),
    "receptor_identificacion" VARCHAR(20),
    "receptor_razon_social" VARCHAR(500),
    "receptor_email" VARCHAR(255),
    "emisor_ruc" VARCHAR(20),
    "emisor_razon_social" VARCHAR(500),
    "categoria" VARCHAR(100),
    "documentos_relacionados" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comprobantes_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "comprobante_xmls" (
    "id" SERIAL NOT NULL,
    "comprobante_id" UUID NOT NULL,
    "tipo" VARCHAR(20) NOT NULL DEFAULT 'autorizado',
    "ruta_archivo" TEXT,
    "xml_autorizado_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comprobante_xmls_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "scraping_jobs" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID,
    "ruc" VARCHAR(20) NOT NULL,
    "clave_sri" VARCHAR(255) NOT NULL,
    "fecha_desde" DATE,
    "fecha_hasta" DATE,
    "mes" INTEGER,
    "anio" INTEGER,
    "tipo_comprobante" VARCHAR(50) NOT NULL DEFAULT 'todos',
    "action_type" VARCHAR(50) NOT NULL DEFAULT 'DOWNLOAD_RECEIVED',
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "progress_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scraping_jobs_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "tenant_settings" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "llm_provider" VARCHAR(50) NOT NULL DEFAULT 'gemini',
    "llm_model" VARCHAR(100),
    "gemini_api_key_encrypted" TEXT,
    "claude_api_key_encrypted" TEXT,
    "llm_configured_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
  )`,

  // Índices únicos
  `CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_email_key" ON "usuarios"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "emisores_tenant_id_ruc_key" ON "emisores"("tenant_id", "ruc")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "comprobantes_clave_acceso_key" ON "comprobantes"("clave_acceso")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "comprobante_xmls_comprobante_id_tipo_key" ON "comprobante_xmls"("comprobante_id", "tipo")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "tenant_settings_tenant_id_key" ON "tenant_settings"("tenant_id")`,

  // Foreign Keys con comprobación de existencia
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_tenant_id_fkey') THEN
      ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'emisores_tenant_id_fkey') THEN
      ALTER TABLE "emisores" ADD CONSTRAINT "emisores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comprobantes_tenant_id_fkey') THEN
      ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comprobantes_emisor_id_fkey') THEN
      ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_emisor_id_fkey" FOREIGN KEY ("emisor_id") REFERENCES "emisores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comprobante_xmls_comprobante_id_fkey') THEN
      ALTER TABLE "comprobante_xmls" ADD CONSTRAINT "comprobante_xmls_comprobante_id_fkey" FOREIGN KEY ("comprobante_id") REFERENCES "comprobantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scraping_jobs_tenant_id_fkey') THEN
      ALTER TABLE "scraping_jobs" ADD CONSTRAINT "scraping_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_settings_tenant_id_fkey') THEN
      ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END $$`,
];

async function migrate() {
  const maskedUrl = DATABASE_URL.replace(/:([^@]+)@/, ':****@');
  console.log('🚀 Ejecutando migración en Neon PostgreSQL...');
  console.log(`📡 Conectando a: ${maskedUrl}\n`);

  const client = await pool.connect();
  let ok = 0;
  let skip = 0;

  try {
    for (const stmt of statements) {
      const label = stmt.trim().split('\n')[0].substring(0, 60);
      try {
        await client.query(stmt);
        console.log(`  ✅ ${label}`);
        ok++;
      } catch (err) {
        if (err.message?.includes('already exists')) {
          console.log(`  ⏭️  (ya existe) ${label}`);
          skip++;
        } else {
          console.error(`  ❌ Error: ${err.message}`);
          console.error(`     SQL: ${label}`);
        }
      }
    }

    // Verificar tablas creadas
    const res = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );

    console.log(`\n✅ Migración completada — OK: ${ok}, Skip: ${skip}`);
    console.log('\n📋 Tablas en Neon:');
    res.rows.forEach(r => console.log(`   ✓ ${r.table_name}`));

  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});
