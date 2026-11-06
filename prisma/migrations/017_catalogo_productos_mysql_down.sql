-- Rollback de 017_catalogo_productos_mysql.sql
-- Atención: precio_unitario vuelve a 2 decimales y las bases con más decimales se redondean.

ALTER TABLE productos MODIFY COLUMN precio_unitario DECIMAL(10,2) NOT NULL;

SET @db := DATABASE();

SET @sql := IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'productos' AND CONSTRAINT_NAME = 'productos_categoria_fk') > 0,
  'ALTER TABLE productos DROP FOREIGN KEY productos_categoria_fk',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'productos' AND COLUMN_NAME = 'categoria_id') > 0,
  'ALTER TABLE productos DROP INDEX productos_tenant_categoria_idx, DROP COLUMN categoria_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'productos' AND COLUMN_NAME = 'codigo_barras') > 0,
  'ALTER TABLE productos DROP INDEX productos_tenant_codigo_barras_idx, DROP COLUMN codigo_barras',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'productos' AND COLUMN_NAME = 'tipo') > 0,
  'ALTER TABLE productos DROP COLUMN tipo, DROP COLUMN stock_minimo, DROP COLUMN unidad, DROP COLUMN visible_pos',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

DROP TABLE IF EXISTS categorias_producto;
