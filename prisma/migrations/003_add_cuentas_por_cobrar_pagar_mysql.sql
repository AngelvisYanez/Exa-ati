-- =============================================================================
-- 003: Cuentas por Cobrar, Cuentas por Pagar y Pagos (MySQL / desarrollo)
-- Ejecutar una sola vez: mysql -u root -p db_sri < 003_add_cuentas_por_cobrar_pagar_mysql.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS cuentas_por_cobrar (
    id CHAR(36) NOT NULL PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    contacto_id CHAR(36),
    comprobante_id CHAR(36),
    cliente_tipo_id VARCHAR(5),
    cliente_identificacion VARCHAR(20),
    cliente_nombre VARCHAR(500),
    cliente_email VARCHAR(255),
    tipo_documento VARCHAR(5) NOT NULL DEFAULT '01',
    numero_documento VARCHAR(30),
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE,
    monto_original DECIMAL(14,2) NOT NULL,
    saldo_pendiente DECIMAL(14,2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    notas TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_cxc_tenant_estado (tenant_id, estado),
    INDEX idx_cxc_tenant_vencimiento (tenant_id, fecha_vencimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cuentas_por_pagar (
    id CHAR(36) NOT NULL PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    contacto_id CHAR(36),
    comprobante_id CHAR(36),
    proveedor_tipo_id VARCHAR(5),
    proveedor_identificacion VARCHAR(20),
    proveedor_nombre VARCHAR(500),
    proveedor_email VARCHAR(255),
    tipo_documento VARCHAR(5) NOT NULL DEFAULT '01',
    numero_documento VARCHAR(30),
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE,
    monto_original DECIMAL(14,2) NOT NULL,
    saldo_pendiente DECIMAL(14,2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    notas TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_cxp_tenant_estado (tenant_id, estado),
    INDEX idx_cxp_tenant_vencimiento (tenant_id, fecha_vencimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pagos_cuentas (
    id CHAR(36) NOT NULL PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    tipo_cuenta VARCHAR(10) NOT NULL,
    cuenta_cobrar_id CHAR(36),
    cuenta_pagar_id CHAR(36),
    fecha DATE NOT NULL,
    monto DECIMAL(14,2) NOT NULL,
    metodo_pago VARCHAR(50),
    referencia VARCHAR(100),
    notas TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_pagos_tenant_tipo (tenant_id, tipo_cuenta),
    INDEX idx_pagos_cuenta_cobrar (cuenta_cobrar_id),
    INDEX idx_pagos_cuenta_pagar (cuenta_pagar_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
