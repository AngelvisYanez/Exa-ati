-- Catálogo de productos: categorías y datos de inventario (MySQL)
-- Rollback: 017_catalogo_productos_mysql_down.sql

CREATE TABLE IF NOT EXISTS categorias_producto (
  id          CHAR(36) NOT NULL,
  tenant_id   CHAR(36) NOT NULL,
  nombre      VARCHAR(80) NOT NULL,
  color       SMALLINT NOT NULL DEFAULT 0,
  orden       INT NOT NULL DEFAULT 0,
  activo      TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY categorias_producto_tenant_nombre_key (tenant_id, nombre),
  KEY categorias_producto_tenant_orden_idx (tenant_id, orden),
  CONSTRAINT categorias_producto_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @db := DATABASE();

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'productos' AND COLUMN_NAME = 'categoria_id') = 0,
  'ALTER TABLE productos ADD COLUMN categoria_id CHAR(36) NULL, ADD KEY productos_tenant_categoria_idx (tenant_id, categoria_id), ADD CONSTRAINT productos_categoria_fk FOREIGN KEY (categoria_id) REFERENCES categorias_producto(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'productos' AND COLUMN_NAME = 'tipo') = 0,
  'ALTER TABLE productos ADD COLUMN tipo VARCHAR(10) NOT NULL DEFAULT ''producto''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'productos' AND COLUMN_NAME = 'stock_minimo') = 0,
  'ALTER TABLE productos ADD COLUMN stock_minimo DECIMAL(10,2) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'productos' AND COLUMN_NAME = 'unidad') = 0,
  'ALTER TABLE productos ADD COLUMN unidad VARCHAR(20) NOT NULL DEFAULT ''Unidad''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'productos' AND COLUMN_NAME = 'codigo_barras') = 0,
  'ALTER TABLE productos ADD COLUMN codigo_barras VARCHAR(50) NULL, ADD KEY productos_tenant_codigo_barras_idx (tenant_id, codigo_barras)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'productos' AND COLUMN_NAME = 'visible_pos') = 0,
  'ALTER TABLE productos ADD COLUMN visible_pos TINYINT(1) NOT NULL DEFAULT 1',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE productos MODIFY COLUMN precio_unitario DECIMAL(14,6) NOT NULL;
