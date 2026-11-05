-- Planes de suscripción editables + reconfiguración de roles
-- PostgreSQL

-- ── Tablas de planes ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planes_suscripcion (
  codigo          VARCHAR(30) PRIMARY KEY,
  nombre          VARCHAR(100) NOT NULL,
  descripcion     TEXT,
  max_empresas    INT NOT NULL DEFAULT 1,
  precio_mensual  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  precio_anual    NUMERIC(12, 2),
  moneda          VARCHAR(3) NOT NULL DEFAULT 'USD',
  orden           INT NOT NULL DEFAULT 0,
  activo          BOOLEAN NOT NULL DEFAULT true,
  es_sistema      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plan_modulos (
  plan_codigo   VARCHAR(30) NOT NULL REFERENCES planes_suscripcion(codigo) ON DELETE CASCADE,
  modulo_codigo VARCHAR(50) NOT NULL REFERENCES modulos(codigo) ON DELETE CASCADE,
  PRIMARY KEY (plan_codigo, modulo_codigo)
);

CREATE INDEX IF NOT EXISTS plan_modulos_modulo_idx ON plan_modulos (modulo_codigo);

-- Columna tenant (idempotente con 006)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan_codigo VARCHAR(30) NOT NULL DEFAULT 'emprendedor';

CREATE INDEX IF NOT EXISTS tenants_plan_codigo_idx ON tenants (plan_codigo);

-- Módulo admin de planes
INSERT INTO modulos (codigo, nombre, grupo, ruta, orden) VALUES
  ('admin.planes', 'Planes de suscripción', 'ADMINISTRACION', '/admin/planes', 215)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  grupo = EXCLUDED.grupo,
  ruta = EXCLUDED.ruta,
  orden = EXCLUDED.orden;

-- ── Seed planes sistema ───────────────────────────────────────
INSERT INTO planes_suscripcion (
  codigo, nombre, descripcion, max_empresas, precio_mensual, precio_anual, moneda, orden, activo, es_sistema
) VALUES
  (
    'emprendedor',
    'Emprendedor',
    'Opera tu negocio: facturación, cobros, inventario y chat. Sin declaraciones al SRI.',
    1, 19.00, 190.00, 'USD', 10, true, true
  ),
  (
    'contador',
    'Contador',
    'Hasta 3 empresas con sync SRI, ATS, control tributario y contabilidad.',
    3, 49.00, 490.00, 'USD', 20, true, true
  ),
  (
    'despacho',
    'Despacho',
    'Hasta 5 empresas con nómina, auditoría IA y administración del equipo.',
    5, 99.00, 990.00, 'USD', 30, true, true
  )
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  max_empresas = EXCLUDED.max_empresas,
  precio_mensual = EXCLUDED.precio_mensual,
  precio_anual = EXCLUDED.precio_anual,
  moneda = EXCLUDED.moneda,
  orden = EXCLUDED.orden,
  activo = EXCLUDED.activo,
  es_sistema = EXCLUDED.es_sistema,
  updated_at = NOW();

-- Limpiar y re-seed módulos por plan
DELETE FROM plan_modulos WHERE plan_codigo IN ('emprendedor', 'contador', 'despacho');

-- Emprendedor
INSERT INTO plan_modulos (plan_codigo, modulo_codigo)
SELECT 'emprendedor', m.codigo FROM modulos m
WHERE m.codigo IN (
  'dashboard', 'documentos', 'emitir', 'pos', 'inventario', 'contactos',
  'cuentas-por-cobrar', 'cuentas-por-pagar', 'chat', 'notificaciones', 'configuracion'
);

-- Contador
INSERT INTO plan_modulos (plan_codigo, modulo_codigo)
SELECT 'contador', m.codigo FROM modulos m
WHERE m.codigo IN (
  'dashboard', 'documentos', 'comprobantes', 'emitir', 'pos', 'ecommerce', 'inventario',
  'guias-remision', 'contabilidad', 'contactos', 'cuentas-por-cobrar', 'cuentas-por-pagar',
  'transportistas', 'control-tributario', 'declaraciones', 'chat', 'notificaciones', 'configuracion'
);

-- Despacho
INSERT INTO plan_modulos (plan_codigo, modulo_codigo)
SELECT 'despacho', m.codigo FROM modulos m
WHERE m.codigo IN (
  'dashboard', 'documentos', 'comprobantes', 'emitir', 'pos', 'ecommerce', 'inventario',
  'guias-remision', 'contabilidad', 'contactos', 'cuentas-por-cobrar', 'cuentas-por-pagar',
  'transportistas', 'control-tributario', 'declaraciones', 'nomina', 'chat', 'auditoria-ia',
  'notificaciones', 'admin', 'admin.roles', 'configuracion'
);

-- ── Reconfiguración de roles ──────────────────────────────────
-- USER: operaciones diarias (techo real = plan del tenant)
DELETE FROM rol_modulos WHERE rol_codigo = 'USER';
INSERT INTO rol_modulos (rol_codigo, modulo_codigo)
SELECT 'USER', m.codigo FROM modulos m
WHERE m.codigo IN (
  'dashboard', 'documentos', 'emitir', 'pos', 'inventario', 'contactos',
  'cuentas-por-cobrar', 'cuentas-por-pagar', 'chat', 'notificaciones', 'configuracion'
);

-- ADMIN: producto completo del tenant (sin plataforma global)
DELETE FROM rol_modulos WHERE rol_codigo = 'ADMIN';
INSERT INTO rol_modulos (rol_codigo, modulo_codigo)
SELECT 'ADMIN', m.codigo FROM modulos m
WHERE m.codigo NOT IN ('admin.empresas', 'admin.planes');

-- SUPERADMIN: todos
DELETE FROM rol_modulos WHERE rol_codigo = 'SUPERADMIN';
INSERT INTO rol_modulos (rol_codigo, modulo_codigo)
SELECT 'SUPERADMIN', m.codigo FROM modulos m;

-- Asegurar roles sistema
UPDATE roles SET
  descripcion = CASE codigo
    WHEN 'USER' THEN 'Operaciones diarias dentro del plan del tenant (facturar, documentos, cobros)'
    WHEN 'ADMIN' THEN 'Administrador del tenant: módulos del plan + gestión de equipo/roles'
    WHEN 'SUPERADMIN' THEN 'Plataforma: empresas, planes de suscripción y configuración global'
    ELSE descripcion
  END,
  updated_at = NOW()
WHERE codigo IN ('USER', 'ADMIN', 'SUPERADMIN');
