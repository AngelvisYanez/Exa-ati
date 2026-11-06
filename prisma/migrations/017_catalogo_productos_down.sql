-- Rollback de 017_catalogo_productos.sql (PostgreSQL)
-- Atención: precio_unitario vuelve a 2 decimales y las bases con más decimales se redondean.

DROP INDEX IF EXISTS productos_tenant_codigo_barras_idx;
DROP INDEX IF EXISTS productos_tenant_categoria_idx;

ALTER TABLE productos ALTER COLUMN precio_unitario TYPE DECIMAL(10,2);

ALTER TABLE productos DROP COLUMN IF EXISTS visible_pos;
ALTER TABLE productos DROP COLUMN IF EXISTS codigo_barras;
ALTER TABLE productos DROP COLUMN IF EXISTS unidad;
ALTER TABLE productos DROP COLUMN IF EXISTS stock_minimo;
ALTER TABLE productos DROP COLUMN IF EXISTS tipo;
ALTER TABLE productos DROP COLUMN IF EXISTS categoria_id;

DROP TABLE IF EXISTS categorias_producto;
