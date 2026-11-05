-- Logo de la empresa vinculada al RUC (se imprime en el RIDE)
-- PostgreSQL

ALTER TABLE emisores ADD COLUMN IF NOT EXISTS logo BYTEA;
ALTER TABLE emisores ADD COLUMN IF NOT EXISTS logo_mime VARCHAR(40);
