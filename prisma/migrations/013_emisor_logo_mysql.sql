-- Logo de la empresa vinculada al RUC (MySQL)

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'emisores' AND COLUMN_NAME = 'logo'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE emisores ADD COLUMN logo LONGBLOB NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'emisores' AND COLUMN_NAME = 'logo_mime'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE emisores ADD COLUMN logo_mime VARCHAR(40) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
