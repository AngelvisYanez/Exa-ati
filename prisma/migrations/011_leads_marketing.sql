-- Leads de marketing (homepage / captación Ecuador)
CREATE TABLE IF NOT EXISTS leads_marketing (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       VARCHAR(120) NOT NULL,
  email        VARCHAR(255) NOT NULL,
  telefono     VARCHAR(20) NOT NULL,
  ciudad       VARCHAR(80) NOT NULL,
  perfil       VARCHAR(30) NOT NULL,
  mensaje      TEXT,
  fuente       VARCHAR(80) NOT NULL DEFAULT 'homepage',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_marketing_created_idx
  ON leads_marketing (created_at DESC);

CREATE INDEX IF NOT EXISTS leads_marketing_email_idx
  ON leads_marketing (email);

CREATE INDEX IF NOT EXISTS leads_marketing_ciudad_idx
  ON leads_marketing (ciudad);
