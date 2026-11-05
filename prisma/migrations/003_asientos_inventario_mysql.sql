-- Asientos contables + kardex (MySQL)
CREATE TABLE IF NOT EXISTS asientos (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  fecha DATE NOT NULL,
  numero INT NOT NULL,
  glosa VARCHAR(500) NOT NULL,
  origen VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
  comprobante_id CHAR(36) NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY asientos_tenant_numero_key (tenant_id, numero),
  INDEX asientos_tenant_fecha_idx (tenant_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asiento_lineas (
  id CHAR(36) NOT NULL PRIMARY KEY,
  asiento_id CHAR(36) NOT NULL,
  cuenta_codigo VARCHAR(20) NOT NULL,
  cuenta_nombre VARCHAR(255) NOT NULL,
  debe DECIMAL(14, 2) NOT NULL DEFAULT 0,
  haber DECIMAL(14, 2) NOT NULL DEFAULT 0,
  orden INT NOT NULL,
  INDEX asiento_lineas_asiento_id_idx (asiento_id),
  CONSTRAINT asiento_lineas_asiento_id_fkey
    FOREIGN KEY (asiento_id) REFERENCES asientos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventario_movimientos (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  producto_id CHAR(36) NOT NULL,
  tipo VARCHAR(10) NOT NULL,
  cantidad DECIMAL(10, 2) NOT NULL,
  stock_antes DECIMAL(10, 2) NOT NULL,
  stock_despues DECIMAL(10, 2) NOT NULL,
  motivo VARCHAR(255) NULL,
  referencia VARCHAR(100) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX inventario_movimientos_tenant_producto_idx (tenant_id, producto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
