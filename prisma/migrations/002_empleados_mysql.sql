-- Empleados maestro (MySQL)
CREATE TABLE IF NOT EXISTS empleados (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  cedula VARCHAR(20) NOT NULL,
  nombres VARCHAR(200) NOT NULL,
  apellidos VARCHAR(200) NOT NULL,
  email VARCHAR(255) NULL,
  telefono VARCHAR(50) NULL,
  cargo VARCHAR(200) NULL,
  fecha_ingreso DATE NULL,
  sueldo DECIMAL(12, 2) NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY empleados_tenant_cedula_key (tenant_id, cedula),
  INDEX empleados_tenant_activo_idx (tenant_id, activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
