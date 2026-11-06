-- Catálogo de productos: categorías y datos de inventario (PostgreSQL)
-- No destructiva: los productos existentes quedan sin categoría, como "producto",
-- con unidad "Unidad", stock mínimo 0 y visibles en el Punto de venta.
-- Rollback: 017_catalogo_productos_down.sql

CREATE TABLE IF NOT EXISTS categorias_producto (
  id          UUID PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre      VARCHAR(80) NOT NULL,
  color       SMALLINT NOT NULL DEFAULT 0,
  orden       INTEGER NOT NULL DEFAULT 0,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS categorias_producto_tenant_nombre_key
  ON categorias_producto (tenant_id, LOWER(nombre));
CREATE INDEX IF NOT EXISTS categorias_producto_tenant_orden_idx
  ON categorias_producto (tenant_id, orden);

ALTER TABLE productos ADD COLUMN IF NOT EXISTS categoria_id UUID
  REFERENCES categorias_producto(id) ON DELETE SET NULL;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS tipo VARCHAR(10) NOT NULL DEFAULT 'producto'
  CHECK (tipo IN ('producto', 'servicio'));
ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_minimo DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS unidad VARCHAR(20) NOT NULL DEFAULT 'Unidad';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(50);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS visible_pos BOOLEAN NOT NULL DEFAULT true;

-- Base sin IVA con 6 decimales (lo que admite precioUnitario en el XML del SRI),
-- para que un precio con IVA incluido se reproduzca exacto.
ALTER TABLE productos ALTER COLUMN precio_unitario TYPE DECIMAL(14,6);

CREATE INDEX IF NOT EXISTS productos_tenant_categoria_idx ON productos (tenant_id, categoria_id);
CREATE INDEX IF NOT EXISTS productos_tenant_codigo_barras_idx ON productos (tenant_id, codigo_barras);
