-- Métodos de pago (CxC/CxP + canales de suscripción) + admin dashboard support
-- PostgreSQL

CREATE TABLE IF NOT EXISTS metodos_pago (
  codigo           VARCHAR(30) PRIMARY KEY,
  nombre           VARCHAR(100) NOT NULL,
  descripcion      TEXT,
  orden            INT NOT NULL DEFAULT 0,
  activo           BOOLEAN NOT NULL DEFAULT true,
  es_sistema       BOOLEAN NOT NULL DEFAULT false,
  uso_operativo    BOOLEAN NOT NULL DEFAULT true,
  uso_suscripcion  BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO metodos_pago (codigo, nombre, descripcion, orden, activo, es_sistema, uso_operativo, uso_suscripcion) VALUES
  ('EFECTIVO', 'Efectivo', 'Pago en efectivo', 10, true, true, true, false),
  ('TRANSFERENCIA', 'Transferencia', 'Transferencia bancaria', 20, true, true, true, true),
  ('CHEQUE', 'Cheque', 'Cheque bancario', 30, true, true, true, false),
  ('TARJETA', 'Tarjeta', 'Tarjeta de crédito/débito', 40, true, true, true, false),
  ('DEPOSITO', 'Depósito', 'Depósito bancario', 50, true, true, true, false),
  ('BANCO', 'Banco', 'Pago bancario genérico', 60, true, true, true, false),
  ('OTRO', 'Otro', 'Otro método', 90, true, true, true, false),
  ('PAYPHONE', 'PayPhone', 'Cobro de suscripción vía PayPhone', 5, true, true, false, true),
  ('CORTESIA', 'Cortesía', 'Plan asignado por admin sin cobro', 100, true, true, false, true)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  orden = EXCLUDED.orden,
  uso_operativo = EXCLUDED.uso_operativo,
  uso_suscripcion = EXCLUDED.uso_suscripcion,
  updated_at = NOW();

ALTER TABLE pagos_suscripcion
  ADD COLUMN IF NOT EXISTS metodo_pago_codigo VARCHAR(30);

-- FK opcional (ignorar si ya existe)
ALTER TABLE pagos_suscripcion
  DROP CONSTRAINT IF EXISTS pagos_suscripcion_metodo_pago_fk;

ALTER TABLE pagos_suscripcion
  ADD CONSTRAINT pagos_suscripcion_metodo_pago_fk
  FOREIGN KEY (metodo_pago_codigo) REFERENCES metodos_pago(codigo)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS pagos_suscripcion_metodo_idx
  ON pagos_suscripcion (metodo_pago_codigo);

-- Backfill pagos existentes de PayPhone
UPDATE pagos_suscripcion
SET metodo_pago_codigo = 'PAYPHONE'
WHERE metodo_pago_codigo IS NULL
  AND (payphone_payment_id IS NOT NULL OR pay_with_card_url IS NOT NULL OR pay_with_payphone_url IS NOT NULL);

-- Módulo admin
INSERT INTO modulos (codigo, nombre, grupo, ruta, orden) VALUES
  ('admin.metodos-pago', 'Métodos de pago', 'ADMINISTRACION', '/administracion/metodos-pago', 217)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  grupo = EXCLUDED.grupo,
  ruta = EXCLUDED.ruta,
  orden = EXCLUDED.orden;

INSERT INTO rol_modulos (rol_codigo, modulo_codigo)
SELECT 'SUPERADMIN', 'admin.metodos-pago'
WHERE EXISTS (SELECT 1 FROM roles WHERE codigo = 'SUPERADMIN')
  AND EXISTS (SELECT 1 FROM modulos WHERE codigo = 'admin.metodos-pago')
ON CONFLICT (rol_codigo, modulo_codigo) DO NOTHING;
