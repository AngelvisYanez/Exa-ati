-- Migration: Add proxy_pool table and proxy_id to scraping_jobs
-- Run: mysql -u root -p db_sri < scripts/migrations/003_proxy_pool.sql

CREATE TABLE IF NOT EXISTS proxy_pool (
  id            INT             AUTO_INCREMENT PRIMARY KEY,
  proxy_host    VARCHAR(255)    NOT NULL,
  proxy_port    INT             NOT NULL,
  proxy_user    VARCHAR(255)    DEFAULT NULL,
  proxy_pass    VARCHAR(255)    DEFAULT NULL,
  pais          VARCHAR(10)     DEFAULT 'EC',
  activo        TINYINT(1)      DEFAULT 1,
  en_uso        TINYINT(1)      DEFAULT 0,
  asignado_a    VARCHAR(100)    DEFAULT NULL,
  ultimo_uso    DATETIME        DEFAULT NULL,
  created_at    DATETIME        DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_proxy_pool_activo (activo, en_uso),
  INDEX idx_proxy_pool_asignado (asignado_a)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add proxy_id to scraping_jobs
ALTER TABLE scraping_jobs
  ADD COLUMN proxy_id INT DEFAULT NULL AFTER `options`,
  ADD INDEX idx_scraping_jobs_proxy (proxy_id);
