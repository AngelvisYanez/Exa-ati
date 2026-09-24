-- Empleados maestro for nómina (planillas_iess keeps period snapshots by cédula)
CREATE TABLE IF NOT EXISTS empleados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  cedula VARCHAR(20) NOT NULL,
  nombres VARCHAR(200) NOT NULL,
  apellidos VARCHAR(200) NOT NULL,
  email VARCHAR(255),
  telefono VARCHAR(50),
  cargo VARCHAR(200),
  fecha_ingreso DATE,
  sueldo DECIMAL(12, 2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, cedula)
);

CREATE INDEX IF NOT EXISTS empleados_tenant_activo_idx ON empleados (tenant_id, activo);
