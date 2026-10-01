# MODULE_COMPLETION — OFSERCONT IA / EXA-ATI

Goal: cada módulo usable de punta a punta (sin stubs engañosos).  
Verificación por oleada: `npx tsc --noEmit` · `npm test` · `npm run smoke:api`

## Estado

Relación entre módulos y flujo de datos: [MODULE_GRAPH.md](MODULE_GRAPH.md).

| # | Módulo | Wave | Estado |
|---|--------|------|--------|
| 1 | Configuración / emisor / certificado | 1 | done |
| 2 | Emisión (01/07/04 + 03/05/06) | 1 | done |
| 3 | Documentos / sync / scraping | 1 | done |
| 4 | Control tributario / ATS / presentar | 2 | done |
| 5 | CxC / CxP | 2 | done |
| 6 | Contabilidad (asientos) | 3 | done |
| 7 | Nómina / IESS | 3 | done |
| 8 | Inventario (kardex) | 4 | done |
| 9 | POS / ecommerce | 4 | done |
| 10 | WhatsApp / móvil / Chat IA | 4 | done |
| H | Hardening transversal | 1 | done |

## Criterios de hecho

### 1 Configuración
- [x] Wizard: vincular RUC → P12 → probar firma → ambiente
- [x] Password cert solo vía campo canónico (`password_certificado`)
- [x] Sin “Próximamente” engañoso en flujos críticos

### 2 Emisión
- [x] Sin DDL runtime en `/api/sri/emitir`
- [x] 01 / 07 / 04 con secuencial + estados SRI
- [x] 03 / 05 / 06 con mismos guards de certificado

### 3 Sync / documentos
- [x] `CRON_SECRET` obligatorio en cron
- [x] Jobs con progreso / cancel / error visibles

### 4 Control tributario
- [x] En sidebar
- [x] ATS descargable
- [x] Presentar sin `otpVerificado: true` hardcodeado (OTP real o modo asistido)

### 5 CxC / CxP
- [x] Pagos actualizan saldo
- [x] Aging básico en UI

### 6 Contabilidad
- [x] Modelos Asiento / AsientoLinea
- [x] Generación desde comprobantes
- [x] Balance de comprobación mínimo

### 7 Nómina
- [x] Empleados en menú + CRUD
- [x] Roles + F107 + planillas coherentes (maestro `empleados`)

### 8 Inventario
- [x] Movimientos de stock / kardex

### 9 POS / ecommerce
- [x] Emisión rápida + listado ventas
- [x] Descuento de stock en venta autorizada

### 10 WhatsApp / IA
- [x] Connect vía bridge real (no flag DB solo)
- [x] Mobile sin JWT en querystring (`code` de un solo uso)
- [x] Guardrails en tools mutantes del chat

### H Hardening
- [x] Registro público no puede ser ADMIN
- [x] `/api/test-env` protegido
- [x] Inserts UUID con `randomUUID()` donde falte

## Migración pendiente en DB
Aplicar en PostgreSQL antes de usar en producción:
- `prisma/migrations/003_asientos_inventario.sql` (asientos/kardex)
- `prisma/migrations/004_roles_modulos.sql` (roles personalizados + módulos)
- `prisma/migrations/005_notificaciones.sql` (notificaciones persistentes + `notif_email`)
- `prisma/migrations/006_tenant_plan.sql` (plan de suscripción: emprendedor / contador / despacho)
- `prisma/migrations/007_planes_suscripcion.sql` (tabla planes + precios + módulos + re-seed roles)
- `prisma/migrations/008_payphone_suscripciones.sql` (pagos PayPhone + vigencia del plan)
- `prisma/migrations/009_multi_empresa_cuentas.sql` (cuenta billing + tenant_usuarios; 1 empresa = 1 tenant)
- `prisma/migrations/010_suscripcion_ciclo_vida.sql` (plan_estado, FKs, índices)
- `prisma/migrations/011_email_plantillas_registro.sql` (plantillas email + plan_estado pendiente + admin.emails)
- `prisma/migrations/012_metodos_pago_admin.sql` (catálogo métodos pago CxC/suscripción + FK en pagos_suscripcion + admin.metodos-pago)

### Admin billing / planes
- [x] CRUD planes de suscripción (`/administracion/planes`)
- [x] CRUD métodos de pago operativo + suscripción (`/administracion/metodos-pago`)
- [x] Asignar/cambiar plan a usuario vía cuenta de billing
- [x] Sync plan cuenta ↔ tenants al editar empresa
- [x] Dashboard admin con KPIs y gráficos de ingresos (`/api/admin/billing-stats`)
- [x] Aplicar migración `012_metodos_pago_admin.sql` en Neon (exa-ati)

### Notificaciones (funcional)
- [x] Persistencia en tabla `notificaciones` (sin lista efímera / mock)
- [x] Marcar leídas vía `PATCH /api/notificaciones` (estado en BD)
- [x] Preferencias App / WhatsApp / Email reales (email solo con `SMTP_HOST`)
- [x] Entrega WhatsApp vía bridge cuando canal=WhatsApp y sesión conectada
- [x] Consultas de sync/cron filtradas por tenant (sin `.catch(() => [])`)
