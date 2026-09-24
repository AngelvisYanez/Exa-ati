-- Índices para tablas con sequential scans altos (scraping_jobs, usuarios, emisores, comprobantes).
-- Idempotente: CREATE INDEX IF NOT EXISTS.

CREATE INDEX IF NOT EXISTS "usuarios_tenant_id_idx" ON "usuarios"("tenant_id");
CREATE INDEX IF NOT EXISTS "usuarios_tenant_id_activo_idx" ON "usuarios"("tenant_id", "activo");

CREATE INDEX IF NOT EXISTS "emisores_tenant_id_activo_idx" ON "emisores"("tenant_id", "activo");

CREATE INDEX IF NOT EXISTS "comprobantes_tenant_id_fecha_emision_idx" ON "comprobantes"("tenant_id", "fecha_emision");
CREATE INDEX IF NOT EXISTS "comprobantes_tenant_id_estado_idx" ON "comprobantes"("tenant_id", "estado");
CREATE INDEX IF NOT EXISTS "comprobantes_emisor_id_idx" ON "comprobantes"("emisor_id");
CREATE INDEX IF NOT EXISTS "comprobantes_tipo_fecha_emision_idx" ON "comprobantes"("tipo", "fecha_emision");

CREATE INDEX IF NOT EXISTS "scraping_jobs_status_idx" ON "scraping_jobs"("status");
CREATE INDEX IF NOT EXISTS "scraping_jobs_tenant_id_status_idx" ON "scraping_jobs"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "scraping_jobs_created_at_idx" ON "scraping_jobs"("created_at");

-- Observabilidad (pueden fallar según plan/permisos; el script de migrate los trata como skip).
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS neon;
