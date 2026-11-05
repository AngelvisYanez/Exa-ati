-- Roles personalizados y asignación de módulos (RBAC)
-- PostgreSQL

CREATE TABLE IF NOT EXISTS roles (
  codigo      VARCHAR(50) PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  descripcion TEXT,
  es_sistema  BOOLEAN NOT NULL DEFAULT false,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modulos (
  codigo  VARCHAR(50) PRIMARY KEY,
  nombre  VARCHAR(100) NOT NULL,
  grupo   VARCHAR(50) NOT NULL,
  ruta    VARCHAR(200) NOT NULL,
  orden   INT NOT NULL DEFAULT 0,
  activo  BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS rol_modulos (
  rol_codigo    VARCHAR(50) NOT NULL REFERENCES roles(codigo) ON DELETE CASCADE,
  modulo_codigo VARCHAR(50) NOT NULL REFERENCES modulos(codigo) ON DELETE CASCADE,
  PRIMARY KEY (rol_codigo, modulo_codigo)
);

CREATE INDEX IF NOT EXISTS rol_modulos_modulo_idx ON rol_modulos (modulo_codigo);

-- Roles de sistema
INSERT INTO roles (codigo, nombre, descripcion, es_sistema, activo) VALUES
  ('USER', 'Usuario', 'Acceso básico de consulta', true, true),
  ('ADMIN', 'Administrador', 'Administrador de empresa/tenant', true, true),
  ('SUPERADMIN', 'Superadministrador', 'Acceso total al sistema', true, true)
ON CONFLICT (codigo) DO NOTHING;

-- Catálogo de módulos (alineado al sidebar)
INSERT INTO modulos (codigo, nombre, grupo, ruta, orden) VALUES
  ('dashboard', 'Dashboard', 'PRINCIPAL', '/', 10),
  ('documentos', 'Documentos', 'PRINCIPAL', '/documentos', 20),
  ('comprobantes', 'Comprobantes', 'PRINCIPAL', '/comprobantes', 30),
  ('emitir', 'Emitir', 'EMISION', '/emitir', 40),
  ('pos', 'Punto de Venta', 'EMISION', '/pos', 50),
  ('ecommerce', 'eCommerce', 'EMISION', '/ecommerce', 60),
  ('inventario', 'Inventario', 'EMISION', '/inventario', 70),
  ('guias-remision', 'Guías de Remisión', 'EMISION', '/guias-remision', 80),
  ('contabilidad', 'Contabilidad', 'CONTABILIDAD', '/contabilidad', 90),
  ('contactos', 'Contactos', 'CONTABILIDAD', '/contactos', 100),
  ('cuentas-por-cobrar', 'Cuentas por Cobrar', 'CONTABILIDAD', '/cuentas-por-cobrar', 110),
  ('cuentas-por-pagar', 'Cuentas por Pagar', 'CONTABILIDAD', '/cuentas-por-pagar', 120),
  ('transportistas', 'Transportistas', 'CONTABILIDAD', '/transportistas', 130),
  ('control-tributario', 'Control Tributario', 'DECLARACIONES', '/control-tributario', 140),
  ('declaraciones', 'Declaraciones', 'DECLARACIONES', '/declaraciones', 150),
  ('nomina', 'Nómina', 'NOMINA', '/nomina', 160),
  ('chat', 'Chat IA', 'INTELIGENCIA', '/chat', 170),
  ('auditoria-ia', 'Auditoría IA', 'INTELIGENCIA', '/auditoria', 180),
  ('notificaciones', 'Notificaciones', 'CANALES', '/notificaciones', 190),
  ('admin', 'Administración', 'ADMINISTRACION', '/admin', 200),
  ('admin.roles', 'Roles y módulos', 'ADMINISTRACION', '/admin/roles', 210),
  ('admin.empresas', 'Empresas', 'ADMINISTRACION', '/admin/empresas', 220),
  ('configuracion', 'Configuración', 'SISTEMA', '/configuracion', 230)
ON CONFLICT (codigo) DO NOTHING;

-- USER: módulos públicos del menú (sin roles hardcodeados)
INSERT INTO rol_modulos (rol_codigo, modulo_codigo)
SELECT 'USER', m.codigo FROM modulos m
WHERE m.codigo IN (
  'dashboard', 'documentos', 'comprobantes', 'contabilidad', 'contactos',
  'chat', 'notificaciones', 'configuracion'
)
ON CONFLICT DO NOTHING;

-- ADMIN: todo excepto admin.empresas (solo SUPERADMIN en sidebar)
INSERT INTO rol_modulos (rol_codigo, modulo_codigo)
SELECT 'ADMIN', m.codigo FROM modulos m
WHERE m.codigo <> 'admin.empresas'
ON CONFLICT DO NOTHING;

-- SUPERADMIN: todos los módulos
INSERT INTO rol_modulos (rol_codigo, modulo_codigo)
SELECT 'SUPERADMIN', m.codigo FROM modulos m
ON CONFLICT DO NOTHING;
