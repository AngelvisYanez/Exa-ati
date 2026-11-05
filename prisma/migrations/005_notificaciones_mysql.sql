-- Notificaciones persistentes (App / Email / WhatsApp)
-- MySQL

CREATE TABLE IF NOT EXISTS notificaciones (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  ruc VARCHAR(20) NULL,
  dedupe_key VARCHAR(120) NOT NULL,
  type VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  channel VARCHAR(20) NOT NULL,
  unread TINYINT(1) NOT NULL DEFAULT 1,
  action_label VARCHAR(100) NULL,
  action_href VARCHAR(255) NULL,
  event_at DATETIME(3) NOT NULL,
  delivered_at DATETIME(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY notificaciones_tenant_dedupe_key (tenant_id, dedupe_key),
  INDEX notificaciones_tenant_unread_idx (tenant_id, unread),
  INDEX notificaciones_tenant_event_at_idx (tenant_id, event_at),
  CONSTRAINT notificaciones_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @db := DATABASE();
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'emisores' AND COLUMN_NAME = 'notif_email'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE emisores ADD COLUMN notif_email TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
