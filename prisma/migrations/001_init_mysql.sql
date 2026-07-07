-- CreateSchema
-- CreateTable
CREATE TABLE `tenants` (
    `id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `ruc` VARCHAR(20),
    `activo` TINYINT(1) NOT NULL DEFAULT 1,
    `last_sync_at` TIMESTAMP(3),
    `last_sync_result` TEXT,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `tenants_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `usuarios` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `nombre` VARCHAR(255),
    `rol` VARCHAR(50) NOT NULL DEFAULT 'USER',
    `tenant_id` CHAR(36),
    `ruc` VARCHAR(20),
    `activo` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `usuarios_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `emisores` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `ruc` VARCHAR(20) NOT NULL,
    `razon_social` VARCHAR(500),
    `nombre_comercial` VARCHAR(500),
    `ambiente` VARCHAR(2) NOT NULL DEFAULT '1',
    `tipo_emision` VARCHAR(2) NOT NULL DEFAULT '1',
    `establecimiento` VARCHAR(3) DEFAULT '001',
    `punto_emision` VARCHAR(3) DEFAULT '001',
    `dir_matriz` VARCHAR(500),
    `direccion_matriz` VARCHAR(500),
    `obligado_contabilidad` VARCHAR(2),
    `agente_retencion` VARCHAR(2),
    `contribuyente_rimpe` VARCHAR(2),
    `tipo_contribuyente` VARCHAR(50),
    `whatsapp_numero` VARCHAR(20),
    `whatsapp_estado` VARCHAR(20) NOT NULL DEFAULT 'DESCONECTADO',
    `notif_documentos` TINYINT(1) NOT NULL DEFAULT 1,
    `notif_generacion` TINYINT(1) NOT NULL DEFAULT 1,
    `whatsapp_notif_documentos` TINYINT(1) DEFAULT 1,
    `whatsapp_notif_generacion` TINYINT(1) DEFAULT 1,
    `certificado_p12` MEDIUMBLOB,
    `certificado_password` VARCHAR(500),
    `password_certificado` TEXT,
    `certificado_password_encrypted` TEXT,
    `certificado_nombre` VARCHAR(500),
    `certificado_valido_hasta` TIMESTAMP(3),
    `cert_valido_hasta` TIMESTAMP(3),
    `clave_sri_encrypted` TEXT,
    `activo` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `emisores_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `comprobantes` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36),
    `emisor_id` CHAR(36),
    `clave_acceso` VARCHAR(49) NOT NULL,
    `tipo` VARCHAR(5),
    `serie` VARCHAR(10),
    `secuencial` VARCHAR(20),
    `ambiente` VARCHAR(2),
    `tipo_emision` VARCHAR(2),
    `estado` VARCHAR(50) NOT NULL DEFAULT 'PENDIENTE',
    `estado_sri` VARCHAR(50),
    `fecha_emision` DATE,
    `fecha_autorizacion` TIMESTAMP(3),
    `numero_autorizacion` VARCHAR(49),
    `importe_total` DECIMAL(10,2),
    `total_sin_impuesto` DECIMAL(10,2),
    `subtotal_sin_impuesto` DECIMAL(10,2),
    `total_iva` DECIMAL(10,2),
    `total_descuento` DECIMAL(10,2),
    `propina` DECIMAL(10,2) DEFAULT 0,
    `moneda` VARCHAR(10) DEFAULT 'USD',
    `receptor_tipo_id` VARCHAR(5),
    `receptor_identificacion` VARCHAR(20),
    `receptor_razon_social` VARCHAR(500),
    `receptor_email` VARCHAR(255),
    `emisor_ruc` VARCHAR(20),
    `emisor_razon_social` VARCHAR(500),
    `categoria` VARCHAR(100),
    `documentos_relacionados` TEXT,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `comprobantes_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `comprobante_xmls` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `comprobante_id` CHAR(36) NOT NULL,
    `tipo` VARCHAR(20) NOT NULL DEFAULT 'autorizado',
    `ruta_archivo` TEXT,
    `xml_autorizado_path` TEXT,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT `comprobante_xmls_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `secuenciales` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `emisor_id` CHAR(36) NOT NULL,
    `tipo_comprobante` VARCHAR(5) NOT NULL,
    `serie` VARCHAR(10) NOT NULL,
    `ultimo_secuencial` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `secuenciales_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `scraping_jobs` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `tenant_id` CHAR(36),
    `ruc` VARCHAR(20) NOT NULL,
    `clave_sri` VARCHAR(255) NOT NULL,
    `fecha_desde` DATE,
    `fecha_hasta` DATE,
    `mes` INTEGER,
    `anio` INTEGER,
    `tipo_comprobante` VARCHAR(50) NOT NULL DEFAULT 'todos',
    `action_type` VARCHAR(50) NOT NULL DEFAULT 'DOWNLOAD_RECEIVED',
    `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    `progress_message` TEXT,
    `options` TEXT,
    `proxy_id` INTEGER,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `scraping_jobs_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `proxy_pool` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `proxy_host` VARCHAR(255) NOT NULL,
    `proxy_port` INTEGER NOT NULL,
    `proxy_user` VARCHAR(255),
    `proxy_pass` VARCHAR(255),
    `pais` VARCHAR(10) NOT NULL DEFAULT 'EC',
    `activo` TINYINT(1) NOT NULL DEFAULT 1,
    `en_uso` TINYINT(1) NOT NULL DEFAULT 0,
    `asignado_a` VARCHAR(100),
    `ultimo_uso` TIMESTAMP(3),
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `proxy_pool_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `scraping_job_logs` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `job_id` INTEGER NOT NULL,
    `level` VARCHAR(20) NOT NULL DEFAULT 'info',
    `message` TEXT NOT NULL,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT `scraping_job_logs_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `tenant_settings` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `llm_provider` VARCHAR(50) NOT NULL DEFAULT 'gemini',
    `llm_model` VARCHAR(100),
    `gemini_api_key_encrypted` TEXT,
    `claude_api_key_encrypted` TEXT,
    `llm_configured_at` TIMESTAMP(3),
    `last_sync_at` TIMESTAMP(3),
    `last_sync_result` TEXT,
    `regime` VARCHAR(50) DEFAULT 'REGIMEN_GENERAL',
    `special_taxpayer_number` VARCHAR(50),
    `forced_accounting` TINYINT(1) DEFAULT 1,
    `withhold_agent_number` VARCHAR(50),
    `default_goods_withhold` VARCHAR(10),
    `default_services_withhold` VARCHAR(10),
    `default_credit_card_withhold` VARCHAR(10),
    `sales_tax_base_account` VARCHAR(20),
    `purchase_tax_base_account` VARCHAR(20),
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `tenant_settings_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `plan_cuentas` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `codigo` VARCHAR(20) NOT NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `nivel` INTEGER NOT NULL DEFAULT 1,
    `tipo` VARCHAR(10) NOT NULL,
    `es_auxiliar` TINYINT(1) NOT NULL DEFAULT 0,
    `permite_movimiento` TINYINT(1) NOT NULL DEFAULT 1,
    `cuenta_padre_id` INTEGER,
    `activo` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `plan_cuentas_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `impuestos` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `codigo` VARCHAR(10) NOT NULL,
    `codigo_porcentaje` VARCHAR(10) NOT NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `porcentaje` DECIMAL(5,2) NOT NULL,
    `tarifa` DECIMAL(5,2) NOT NULL,
    `tipo_impuesto` VARCHAR(50) NOT NULL,
    `codigo_ats` VARCHAR(10),
    `codigo_formulario_103` VARCHAR(10),
    `codigo_formulario_104` VARCHAR(10),
    `activo` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `impuestos_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `tipos_documento_sri` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `codigo` VARCHAR(5) NOT NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `descripcion` TEXT,
    `version` VARCHAR(10),
    `activo` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT `tipos_documento_sri_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `tipos_sustento_tributario` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `codigo` VARCHAR(5) NOT NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `descripcion` TEXT,
    `activo` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT `tipos_sustento_tributario_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `posiciones_fiscales` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `tipo_contribuyente` VARCHAR(50),
    `activo` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `posiciones_fiscales_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `posiciones_fiscales_lineas` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `posicion_fiscal_id` INTEGER NOT NULL,
    `impuesto_id` INTEGER NOT NULL,
    `tipoOperacion` VARCHAR(20) NOT NULL,
    `aplica_retencion` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT `posiciones_fiscales_lineas_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `contactos` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `tipo_identificacion` VARCHAR(5) NOT NULL,
    `identificacion` VARCHAR(20) NOT NULL,
    `razon_social` VARCHAR(500) NOT NULL,
    `nombre_comercial` VARCHAR(500),
    `email` VARCHAR(255),
    `telefono` VARCHAR(50),
    `direccion` TEXT,
    `tipo_contribuyente_sri` VARCHAR(50),
    `obligado_contabilidad` VARCHAR(2),
    `agente_retencion` TINYINT(1) DEFAULT 0,
    `es_cliente` TINYINT(1) NOT NULL DEFAULT 1,
    `es_proveedor` TINYINT(1) NOT NULL DEFAULT 0,
    `activo` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `contactos_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `productos` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `codigo` VARCHAR(50) NOT NULL,
    `nombre` VARCHAR(500) NOT NULL,
    `descripcion` TEXT,
    `precio_unitario` DECIMAL(10,2) NOT NULL,
    `iva_porcentaje` INTEGER NOT NULL DEFAULT 15,
    `stock` DECIMAL(10,2) NOT NULL DEFAULT 0,
    `activo` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `productos_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `transportistas` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `ruc` VARCHAR(20) NOT NULL,
    `razon_social` VARCHAR(500) NOT NULL,
    `tipo_identificacion` VARCHAR(5) NOT NULL DEFAULT '04',
    `placa` VARCHAR(20) NOT NULL,
    `direccion` TEXT,
    `telefono` VARCHAR(50),
    `email` VARCHAR(255),
    `activo` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `transportistas_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `reportes_fiscales` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `tipo` VARCHAR(10) NOT NULL,
    `periodo` INTEGER NOT NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
    `xml_generado` TEXT,
    `data` JSON,
    `fecha_generacion` TIMESTAMP(3),
    `fecha_presentacion` TIMESTAMP(3),
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `reportes_fiscales_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `motivos_traslado` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `codigo` VARCHAR(10) NOT NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `descripcion` TEXT,
    `activo` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT `motivos_traslado_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateTable
CREATE TABLE `auditoria` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `usuario_email` VARCHAR(255),
    `tenant_id` CHAR(36),
    `accion` VARCHAR(50) NOT NULL,
    `recurso` VARCHAR(50),
    `descripcion` TEXT,
    `datos_nuevos` TEXT,
    `exitoso` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT `auditoria_pkey` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CreateIndex
CREATE UNIQUE INDEX `usuarios_email_key` ON `usuarios`(`email`);

-- CreateIndex
CREATE UNIQUE INDEX `emisores_tenant_id_ruc_key` ON `emisores`(`tenant_id`, `ruc`);

-- CreateIndex
CREATE UNIQUE INDEX `comprobantes_clave_acceso_key` ON `comprobantes`(`clave_acceso`);

-- CreateIndex
CREATE INDEX `comprobantes_fecha_emision_idx` ON `comprobantes`(`fecha_emision`);

-- CreateIndex
CREATE UNIQUE INDEX `comprobante_xmls_comprobante_id_tipo_key` ON `comprobante_xmls`(`comprobante_id`, `tipo`);

-- CreateIndex
CREATE UNIQUE INDEX `secuenciales_emisor_id_tipo_comprobante_serie_key` ON `secuenciales`(`emisor_id`, `tipo_comprobante`, `serie`);

-- CreateIndex
CREATE INDEX `idx_scraping_job_logs_job_id` ON `scraping_job_logs`(`job_id`);

-- CreateIndex
CREATE UNIQUE INDEX `tenant_settings_tenant_id_key` ON `tenant_settings`(`tenant_id`);

-- CreateIndex
CREATE INDEX `plan_cuentas_tenant_id_tipo_idx` ON `plan_cuentas`(`tenant_id`, `tipo`);

-- CreateIndex
CREATE UNIQUE INDEX `plan_cuentas_tenant_id_codigo_key` ON `plan_cuentas`(`tenant_id`, `codigo`);

-- CreateIndex
CREATE UNIQUE INDEX `impuestos_tenant_id_codigo_codigo_porcentaje_key` ON `impuestos`(`tenant_id`, `codigo`, `codigo_porcentaje`);

-- CreateIndex
CREATE UNIQUE INDEX `tipos_documento_sri_codigo_key` ON `tipos_documento_sri`(`codigo`);

-- CreateIndex
CREATE UNIQUE INDEX `tipos_sustento_tributario_codigo_key` ON `tipos_sustento_tributario`(`codigo`);

-- CreateIndex
CREATE INDEX `contactos_tenant_id_razon_social_idx` ON `contactos`(`tenant_id`, `razon_social`);

-- CreateIndex
CREATE UNIQUE INDEX `contactos_tenant_id_tipo_identificacion_identificacion_key` ON `contactos`(`tenant_id`, `tipo_identificacion`, `identificacion`);

-- CreateIndex
CREATE INDEX `productos_tenant_id_activo_idx` ON `productos`(`tenant_id`, `activo`);

-- CreateIndex
CREATE UNIQUE INDEX `productos_tenant_id_codigo_key` ON `productos`(`tenant_id`, `codigo`);

-- CreateIndex
CREATE UNIQUE INDEX `transportistas_tenant_id_ruc_placa_key` ON `transportistas`(`tenant_id`, `ruc`, `placa`);

-- CreateIndex
CREATE UNIQUE INDEX `reportes_fiscales_tenant_id_tipo_periodo_key` ON `reportes_fiscales`(`tenant_id`, `tipo`, `periodo`);

-- CreateIndex
CREATE UNIQUE INDEX `motivos_traslado_codigo_key` ON `motivos_traslado`(`codigo`);

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emisores` ADD CONSTRAINT `emisores_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comprobantes` ADD CONSTRAINT `comprobantes_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comprobantes` ADD CONSTRAINT `comprobantes_emisor_id_fkey` FOREIGN KEY (`emisor_id`) REFERENCES `emisores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comprobante_xmls` ADD CONSTRAINT `comprobante_xmls_comprobante_id_fkey` FOREIGN KEY (`comprobante_id`) REFERENCES `comprobantes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scraping_jobs` ADD CONSTRAINT `scraping_jobs_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scraping_jobs` ADD CONSTRAINT `scraping_jobs_proxy_id_fkey` FOREIGN KEY (`proxy_id`) REFERENCES `proxy_pool`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scraping_job_logs` ADD CONSTRAINT `scraping_job_logs_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `scraping_jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_settings` ADD CONSTRAINT `tenant_settings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plan_cuentas` ADD CONSTRAINT `plan_cuentas_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plan_cuentas` ADD CONSTRAINT `plan_cuentas_cuenta_padre_id_fkey` FOREIGN KEY (`cuenta_padre_id`) REFERENCES `plan_cuentas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `impuestos` ADD CONSTRAINT `impuestos_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posiciones_fiscales` ADD CONSTRAINT `posiciones_fiscales_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posiciones_fiscales_lineas` ADD CONSTRAINT `posiciones_fiscales_lineas_posicion_fiscal_id_fkey` FOREIGN KEY (`posicion_fiscal_id`) REFERENCES `posiciones_fiscales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posiciones_fiscales_lineas` ADD CONSTRAINT `posiciones_fiscales_lineas_impuesto_id_fkey` FOREIGN KEY (`impuesto_id`) REFERENCES `impuestos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contactos` ADD CONSTRAINT `contactos_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `productos` ADD CONSTRAINT `productos_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transportistas` ADD CONSTRAINT `transportistas_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reportes_fiscales` ADD CONSTRAINT `reportes_fiscales_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

