-- Asientos contables (libro diario) e inventario movimientos (kardex)
-- PostgreSQL

CREATE TABLE IF NOT EXISTS asientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  fecha DATE NOT NULL,
  numero INT NOT NULL,
  glosa VARCHAR(500) NOT NULL,
  origen VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
  comprobante_id UUID,
  estado VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, numero)
);

CREATE TABLE IF NOT EXISTS asiento_lineas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asiento_id UUID NOT NULL REFERENCES asientos(id) ON DELETE CASCADE,
  cuenta_codigo VARCHAR(20) NOT NULL,
  cuenta_nombre VARCHAR(255) NOT NULL,
  debe DECIMAL(14, 2) NOT NULL DEFAULT 0,
  haber DECIMAL(14, 2) NOT NULL DEFAULT 0,
  orden INT NOT NULL
);

CREATE INDEX IF NOT EXISTS asiento_lineas_asiento_id_idx ON asiento_lineas (asiento_id);

CREATE TABLE IF NOT EXISTS inventario_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  producto_id UUID NOT NULL REFERENCES productos(id),
  tipo VARCHAR(10) NOT NULL,
  cantidad DECIMAL(10, 2) NOT NULL,
  stock_antes DECIMAL(10, 2) NOT NULL,
  stock_despues DECIMAL(10, 2) NOT NULL,
  motivo VARCHAR(255),
  referencia VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inventario_movimientos_tenant_producto_idx
  ON inventario_movimientos (tenant_id, producto_id);
