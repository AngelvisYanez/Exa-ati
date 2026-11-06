-- Establecimientos del emisor (dirección, ciudad, teléfonos y ambiente SRI por código)
-- PostgreSQL

CREATE TABLE IF NOT EXISTS establecimientos_emisor (
  emisor_id   UUID NOT NULL,
  codigo      VARCHAR(3) NOT NULL,
  direccion   VARCHAR(300),
  ciudad      VARCHAR(120),
  telefonos   VARCHAR(120),
  ambiente    VARCHAR(1),
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (emisor_id, codigo)
);

ALTER TABLE establecimientos_emisor ADD COLUMN IF NOT EXISTS ambiente VARCHAR(1);
