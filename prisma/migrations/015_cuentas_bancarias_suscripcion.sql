CREATE TABLE IF NOT EXISTS cuentas_bancarias_suscripcion (
  id BIGSERIAL PRIMARY KEY,
  banco VARCHAR(100) NOT NULL,
  titular VARCHAR(150) NOT NULL,
  identificacion VARCHAR(30) NOT NULL,
  tipo_cuenta VARCHAR(30) NOT NULL CHECK (tipo_cuenta IN ('AHORROS', 'CORRIENTE')),
  numero_cuenta VARCHAR(50) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

UPDATE metodos_pago SET activo = false, uso_suscripcion = false WHERE codigo = 'PAYPHONE';
INSERT INTO metodos_pago (codigo, nombre, descripcion, orden, activo, es_sistema, uso_operativo, uso_suscripcion)
VALUES ('BENDO', 'BENDO', 'Próximamente', 30, false, true, false, false)
ON CONFLICT (codigo) DO UPDATE SET activo = false, uso_suscripcion = false, descripcion = 'Próximamente';
