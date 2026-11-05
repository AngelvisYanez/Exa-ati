-- PayPhone: pagos de suscripción + vigencia del plan en tenant
-- PostgreSQL

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan_periodo VARCHAR(20) NOT NULL DEFAULT 'mensual',
  ADD COLUMN IF NOT EXISTS plan_vigente_hasta TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_origen VARCHAR(30) DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS pagos_suscripcion (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  usuario_id            UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  plan_codigo           VARCHAR(30) NOT NULL,
  periodo               VARCHAR(20) NOT NULL DEFAULT 'mensual',
  monto_centavos        INT NOT NULL,
  moneda                VARCHAR(3) NOT NULL DEFAULT 'USD',
  estado                VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  -- pendiente | preparado | aprobado | cancelado | fallido | expirado
  client_transaction_id VARCHAR(64) NOT NULL UNIQUE,
  payphone_payment_id   BIGINT,
  payphone_tx_id        BIGINT,
  authorization_code    VARCHAR(64),
  pay_with_card_url     TEXT,
  pay_with_payphone_url TEXT,
  reference             VARCHAR(255),
  raw_prepare           JSONB,
  raw_confirm           JSONB,
  confirmed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pagos_suscripcion_tenant_idx ON pagos_suscripcion (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pagos_suscripcion_estado_idx ON pagos_suscripcion (estado);
