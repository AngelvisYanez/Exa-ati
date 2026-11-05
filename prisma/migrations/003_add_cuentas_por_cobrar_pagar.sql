-- =============================================================================
-- 003: Cuentas por Cobrar, Cuentas por Pagar y Pagos (PostgreSQL / Neon)
-- Ejecutar una sola vez: psql "$DATABASE_URL" -f 003_add_cuentas_por_cobrar_pagar.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS "cuentas_por_cobrar" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contacto_id" UUID,
    "comprobante_id" UUID,
    "cliente_tipo_id" VARCHAR(5),
    "cliente_identificacion" VARCHAR(20),
    "cliente_nombre" VARCHAR(500),
    "cliente_email" VARCHAR(255),
    "tipo_documento" VARCHAR(5) NOT NULL DEFAULT '01',
    "numero_documento" VARCHAR(30),
    "fecha_emision" DATE NOT NULL,
    "fecha_vencimiento" DATE,
    "monto_original" DECIMAL(14,2) NOT NULL,
    "saldo_pendiente" DECIMAL(14,2) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuentas_por_cobrar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cuentas_por_pagar" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contacto_id" UUID,
    "comprobante_id" UUID,
    "proveedor_tipo_id" VARCHAR(5),
    "proveedor_identificacion" VARCHAR(20),
    "proveedor_nombre" VARCHAR(500),
    "proveedor_email" VARCHAR(255),
    "tipo_documento" VARCHAR(5) NOT NULL DEFAULT '01',
    "numero_documento" VARCHAR(30),
    "fecha_emision" DATE NOT NULL,
    "fecha_vencimiento" DATE,
    "monto_original" DECIMAL(14,2) NOT NULL,
    "saldo_pendiente" DECIMAL(14,2) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuentas_por_pagar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pagos_cuentas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tipo_cuenta" VARCHAR(10) NOT NULL,
    "cuenta_cobrar_id" UUID,
    "cuenta_pagar_id" UUID,
    "fecha" DATE NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "metodo_pago" VARCHAR(50),
    "referencia" VARCHAR(100),
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_cuentas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_cxc_tenant_estado" ON "cuentas_por_cobrar"("tenant_id", "estado");
CREATE INDEX IF NOT EXISTS "idx_cxc_tenant_vencimiento" ON "cuentas_por_cobrar"("tenant_id", "fecha_vencimiento");
CREATE INDEX IF NOT EXISTS "idx_cxp_tenant_estado" ON "cuentas_por_pagar"("tenant_id", "estado");
CREATE INDEX IF NOT EXISTS "idx_cxp_tenant_vencimiento" ON "cuentas_por_pagar"("tenant_id", "fecha_vencimiento");
CREATE INDEX IF NOT EXISTS "idx_pagos_tenant_tipo" ON "pagos_cuentas"("tenant_id", "tipo_cuenta");
CREATE INDEX IF NOT EXISTS "idx_pagos_cuenta_cobrar" ON "pagos_cuentas"("cuenta_cobrar_id");
CREATE INDEX IF NOT EXISTS "idx_pagos_cuenta_pagar" ON "pagos_cuentas"("cuenta_pagar_id");
