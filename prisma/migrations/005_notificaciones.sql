-- Notificaciones persistentes (App / Email / WhatsApp)
-- PostgreSQL

CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ruc VARCHAR(20),
  dedupe_key VARCHAR(120) NOT NULL,
  type VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  channel VARCHAR(20) NOT NULL,
  unread BOOLEAN NOT NULL DEFAULT true,
  action_label VARCHAR(100),
  action_href VARCHAR(255),
  event_at TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS notificaciones_tenant_unread_idx ON notificaciones (tenant_id, unread);
CREATE INDEX IF NOT EXISTS notificaciones_tenant_event_at_idx ON notificaciones (tenant_id, event_at);

ALTER TABLE emisores
  ADD COLUMN IF NOT EXISTS notif_email BOOLEAN NOT NULL DEFAULT false;
