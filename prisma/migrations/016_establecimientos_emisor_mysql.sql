-- Establecimientos del emisor (MySQL)

CREATE TABLE IF NOT EXISTS establecimientos_emisor (
  emisor_id   CHAR(36) NOT NULL,
  codigo      VARCHAR(3) NOT NULL,
  direccion   VARCHAR(300) NULL,
  ciudad      VARCHAR(120) NULL,
  telefonos   VARCHAR(120) NULL,
  ambiente    VARCHAR(1) NULL,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (emisor_id, codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @db := DATABASE();
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'establecimientos_emisor' AND COLUMN_NAME = 'ambiente'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE establecimientos_emisor ADD COLUMN ambiente VARCHAR(1) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
