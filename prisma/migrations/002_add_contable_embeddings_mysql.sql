CREATE TABLE IF NOT EXISTS contable_embeddings (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  referencia_id INT NULL,
  tipo VARCHAR(50) NOT NULL,
  contenido TEXT NOT NULL,
  embedding TEXT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_embeddings_tenant_tipo (tenant_id, tipo),
  INDEX idx_embeddings_referencia (tenant_id, tipo, referencia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
