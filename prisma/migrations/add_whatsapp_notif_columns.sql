-- Migration: Add separate WhatsApp notification preference columns
-- Separates WhatsApp sub-preferences from main channel toggles

ALTER TABLE emisores
ADD COLUMN IF NOT EXISTS whatsapp_notif_documentos BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS whatsapp_notif_generacion BOOLEAN DEFAULT TRUE;

-- Copy existing values into the new columns
UPDATE emisores
SET
  whatsapp_notif_documentos = COALESCE(notif_documentos, TRUE),
  whatsapp_notif_generacion = COALESCE(notif_generacion, TRUE)
WHERE
  whatsapp_notif_documentos IS NULL OR whatsapp_notif_generacion IS NULL;
