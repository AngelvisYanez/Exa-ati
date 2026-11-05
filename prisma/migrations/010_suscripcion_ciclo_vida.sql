-- Ciclo de vida de suscripción: estado, FKs, índices, checks
-- PostgreSQL — Cuenta = fuente de verdad de billing

-- ─── cuentas: estado + renovación ───────────────────────────────────────────
ALTER TABLE cuentas
  ADD COLUMN IF NOT EXISTS plan_estado VARCHAR(20) NOT NULL DEFAULT 'activo',
  ADD COLUMN IF NOT EXISTS renovacion_auto BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ultimo_pago_id UUID;

-- Mirror en tenants (compat lectura legacy)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan_estado VARCHAR(20) NOT NULL DEFAULT 'activo';

-- Backfill estado según vigencia
UPDATE cuentas
SET plan_estado = CASE
  WHEN plan_vigente_hasta IS NOT NULL AND plan_vigente_hasta < NOW() THEN 'vencido'
  ELSE COALESCE(NULLIF(TRIM(plan_estado), ''), 'activo')
END;

UPDATE tenants t
SET plan_estado = COALESCE(
  (SELECT c.plan_estado FROM cuentas c WHERE c.id = t.cuenta_id),
  CASE
    WHEN t.plan_vigente_hasta IS NOT NULL AND t.plan_vigente_hasta < NOW() THEN 'vencido'
    ELSE 'activo'
  END
);

-- ─── FKs plan_codigo → planes_suscripcion ───────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'planes_suscripcion') THEN
    -- Normalizar códigos huérfanos a emprendedor antes de FK
    UPDATE cuentas c
    SET plan_codigo = 'emprendedor'
    WHERE NOT EXISTS (
      SELECT 1 FROM planes_suscripcion p WHERE p.codigo = c.plan_codigo
    );

    UPDATE tenants t
    SET plan_codigo = 'emprendedor'
    WHERE NOT EXISTS (
      SELECT 1 FROM planes_suscripcion p WHERE p.codigo = t.plan_codigo
    );

    UPDATE pagos_suscripcion ps
    SET plan_codigo = 'emprendedor'
    WHERE NOT EXISTS (
      SELECT 1 FROM planes_suscripcion p WHERE p.codigo = ps.plan_codigo
    );

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'cuentas_plan_codigo_fkey'
    ) THEN
      ALTER TABLE cuentas
        ADD CONSTRAINT cuentas_plan_codigo_fkey
        FOREIGN KEY (plan_codigo) REFERENCES planes_suscripcion(codigo)
        ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'pagos_suscripcion_plan_codigo_fkey'
    ) THEN
      ALTER TABLE pagos_suscripcion
        ADD CONSTRAINT pagos_suscripcion_plan_codigo_fkey
        FOREIGN KEY (plan_codigo) REFERENCES planes_suscripcion(codigo)
        ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
  END IF;
END $$;

-- ─── Backfill cuenta_id en pagos + FK opcional ──────────────────────────────
UPDATE pagos_suscripcion ps
SET cuenta_id = t.cuenta_id
FROM tenants t
WHERE ps.tenant_id = t.id
  AND ps.cuenta_id IS NULL
  AND t.cuenta_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pagos_suscripcion_cuenta_id_fkey'
  ) THEN
    ALTER TABLE pagos_suscripcion
      ADD CONSTRAINT pagos_suscripcion_cuenta_id_fkey
      FOREIGN KEY (cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cuentas_ultimo_pago_id_fkey'
  ) THEN
    ALTER TABLE cuentas
      ADD CONSTRAINT cuentas_ultimo_pago_id_fkey
      FOREIGN KEY (ultimo_pago_id) REFERENCES pagos_suscripcion(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── Checks de dominio ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cuentas_plan_periodo_check'
  ) THEN
    ALTER TABLE cuentas
      ADD CONSTRAINT cuentas_plan_periodo_check
      CHECK (plan_periodo IN ('mensual', 'anual'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cuentas_plan_estado_check'
  ) THEN
    ALTER TABLE cuentas
      ADD CONSTRAINT cuentas_plan_estado_check
      CHECK (plan_estado IN ('activo', 'gracia', 'vencido', 'cancelado'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pagos_periodo_check'
  ) THEN
    ALTER TABLE pagos_suscripcion
      ADD CONSTRAINT pagos_periodo_check
      CHECK (periodo IN ('mensual', 'anual'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pagos_estado_check'
  ) THEN
    ALTER TABLE pagos_suscripcion
      ADD CONSTRAINT pagos_estado_check
      CHECK (estado IN ('pendiente', 'preparado', 'aprobado', 'cancelado', 'fallido', 'expirado'));
  END IF;
END $$;

-- ─── Índices de ciclo de vida ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS cuentas_vigente_hasta_idx
  ON cuentas (plan_vigente_hasta)
  WHERE plan_vigente_hasta IS NOT NULL;

CREATE INDEX IF NOT EXISTS cuentas_plan_estado_idx
  ON cuentas (plan_estado);

CREATE INDEX IF NOT EXISTS pagos_suscripcion_cuenta_estado_idx
  ON pagos_suscripcion (cuenta_id, estado);

-- Rutas de módulos en español (renombre duro UI)
UPDATE modulos SET ruta = '/panel' WHERE codigo = 'dashboard' AND ruta IN ('/', '/dashboard');
UPDATE modulos SET ruta = '/asistente' WHERE codigo = 'chat' AND ruta = '/chat';
UPDATE modulos SET ruta = '/punto-de-venta' WHERE codigo = 'pos' AND ruta = '/pos';
UPDATE modulos SET ruta = '/comercio' WHERE codigo = 'ecommerce' AND ruta = '/ecommerce';
UPDATE modulos SET ruta = '/administracion' WHERE codigo = 'admin' AND ruta = '/admin';
UPDATE modulos SET ruta = '/administracion/roles' WHERE codigo = 'admin.roles' AND ruta = '/admin/roles';
UPDATE modulos SET ruta = '/administracion/empresas' WHERE codigo = 'admin.empresas' AND ruta = '/admin/empresas';
UPDATE modulos SET ruta = '/administracion/planes' WHERE codigo = 'admin.planes' AND ruta = '/admin/planes';
