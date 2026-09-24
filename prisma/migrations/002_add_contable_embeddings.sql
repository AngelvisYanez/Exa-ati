CREATE TABLE IF NOT EXISTS "contable_embeddings" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "referencia_id" INTEGER,
    "tipo" VARCHAR(50) NOT NULL,
    "contenido" TEXT NOT NULL,
    "embedding" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contable_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_embeddings_tenant_tipo" ON "contable_embeddings"("tenant_id", "tipo");
CREATE INDEX IF NOT EXISTS "idx_embeddings_referencia" ON "contable_embeddings"("tenant_id", "tipo", "referencia_id");
