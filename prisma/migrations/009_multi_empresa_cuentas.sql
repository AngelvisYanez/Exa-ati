-- Multi-empresa: Cuenta (billing) + Tenant = empresa aislada + membresías
-- PostgreSQL

CREATE TABLE IF NOT EXISTS cuentas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              VARCHAR(255) NOT NULL,
  plan_codigo         VARCHAR(30) NOT NULL DEFAULT 'emprendedor',
  plan_periodo        VARCHAR(20) NOT NULL DEFAULT 'mensual',
  plan_vigente_hasta  TIMESTAMPTZ,
  plan_origen         VARCHAR(30) DEFAULT 'manual',
  owner_usuario_id    UUID,
  activo              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cuentas_owner_idx ON cuentas (owner_usuario_id);
CREATE INDEX IF NOT EXISTS cuentas_plan_idx ON cuentas (plan_codigo);

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS cuenta_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_cuenta_id_fkey'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_cuenta_id_fkey
      FOREIGN KEY (cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tenants_cuenta_id_idx ON tenants (cuenta_id);

CREATE TABLE IF NOT EXISTS tenant_usuarios (
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol         VARCHAR(50) NOT NULL DEFAULT 'ADMIN',
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS tenant_usuarios_usuario_idx ON tenant_usuarios (usuario_id);

-- Backfill: 1 cuenta por tenant existente (plan heredado del tenant)
INSERT INTO cuentas (id, nombre, plan_codigo, plan_periodo, plan_vigente_hasta, plan_origen, owner_usuario_id, activo, created_at, updated_at)
SELECT
  t.id,
  t.nombre,
  COALESCE(NULLIF(TRIM(t.plan_codigo), ''), 'emprendedor'),
  COALESCE(NULLIF(TRIM(t.plan_periodo), ''), 'mensual'),
  t.plan_vigente_hasta,
  COALESCE(t.plan_origen, 'manual'),
  (SELECT u.id FROM usuarios u WHERE u.tenant_id = t.id ORDER BY u.created_at ASC LIMIT 1),
  t.activo,
  t.created_at,
  NOW()
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM cuentas c WHERE c.id = t.id)
ON CONFLICT (id) DO NOTHING;

UPDATE tenants t
SET cuenta_id = t.id
WHERE t.cuenta_id IS NULL
  AND EXISTS (SELECT 1 FROM cuentas c WHERE c.id = t.id);

-- Membresías desde usuarios.tenant_id
INSERT INTO tenant_usuarios (tenant_id, usuario_id, rol, activo, created_at, updated_at)
SELECT u.tenant_id, u.id, COALESCE(NULLIF(u.rol, ''), 'ADMIN'), true, NOW(), NOW()
FROM usuarios u
WHERE u.tenant_id IS NOT NULL
ON CONFLICT (tenant_id, usuario_id) DO NOTHING;

-- Pagos de suscripción: columna cuenta_id (billing a nivel cuenta)
ALTER TABLE pagos_suscripcion
  ADD COLUMN IF NOT EXISTS cuenta_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pagos_suscripcion_cuenta_id_fkey'
  ) THEN
    ALTER TABLE pagos_suscripcion
      ADD CONSTRAINT pagos_suscripcion_cuenta_id_fkey
      FOREIGN KEY (cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE pagos_suscripcion p
SET cuenta_id = t.cuenta_id
FROM tenants t
WHERE p.tenant_id = t.id AND p.cuenta_id IS NULL AND t.cuenta_id IS NOT NULL;
