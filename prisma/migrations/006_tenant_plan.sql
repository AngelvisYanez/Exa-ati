-- Planes de suscripción por tenant (ola 1)
-- PostgreSQL

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan_codigo VARCHAR(30) NOT NULL DEFAULT 'emprendedor';

CREATE INDEX IF NOT EXISTS tenants_plan_codigo_idx ON tenants (plan_codigo);

COMMENT ON COLUMN tenants.plan_codigo IS 'emprendedor | contador | despacho — ver src/lib/plans.ts';
