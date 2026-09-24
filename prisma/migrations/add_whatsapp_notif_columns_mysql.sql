-- WhatsApp notification preference columns (MySQL)
-- MySQL < 8.0.12 no soporta ADD COLUMN IF NOT EXISTS; usamos procedimiento idempotente.

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'emisores' AND COLUMN_NAME = 'whatsapp_notif_documentos'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE emisores ADD COLUMN whatsapp_notif_documentos TINYINT(1) DEFAULT 1',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'emisores' AND COLUMN_NAME = 'whatsapp_notif_generacion'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE emisores ADD COLUMN whatsapp_notif_generacion TINYINT(1) DEFAULT 1',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE emisores
SET
  whatsapp_notif_documentos = COALESCE(whatsapp_notif_documentos, COALESCE(notif_documentos, 1)),
  whatsapp_notif_generacion = COALESCE(whatsapp_notif_generacion, COALESCE(notif_generacion, 1));
