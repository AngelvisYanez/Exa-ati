# Plan — Suscripciones + UX (ola recomendada)

## Decisión de producto

Audiencia dual: **emprendedor** (operar el negocio, sin declaraciones SRI) y **contador/despacho** (1–5 empresas + SRI).

| Plan | Código | Max empresas (tenants) | Enfoque |
|------|--------|------------------------|---------|
| Emprendedor | `emprendedor` | 1 | Facturar, cobros, inventario, chat. Sin declaraciones/ATS/control tributario. |
| Contador | `contador` | 3 | + sync SRI, ATS, control tributario, contabilidad básica. |
| Despacho | `despacho` | 5 | Todo (salvo `admin.empresas`, solo SUPERADMIN). |

**Modelo (opción 2):** “Empresa” = **tenant** bajo una **Cuenta** de billing. Cupo del plan = nº de tenants en la cuenta. 1 RUC (emisor) por empresa. El Topbar cambia `tenantId` del JWT y aísla datos. Membresía en `tenant_usuarios`.

## Por qué juntos (planes + UX)

Sin plan, el sidebar/dashboard “para emprendedor” se contradice con un ADMIN que ve todo el ERP. El gating por plan es la fuente de verdad; la navegación solo refleja lo permitido.

## Matriz de módulos

| Módulo | Emprendedor | Contador | Despacho |
|--------|:-----------:|:--------:|:--------:|
| dashboard, documentos, emitir | ✓ | ✓ | ✓ |
| pos, inventario, contactos | ✓ | ✓ | ✓ |
| cuentas-por-cobrar / pagar | ✓ | ✓ | ✓ |
| chat, notificaciones, configuracion | ✓ | ✓ | ✓ |
| ecommerce, guias-remision, transportistas | — | ✓ | ✓ |
| contabilidad | — | ✓ | ✓ |
| control-tributario, declaraciones, comprobantes | — | ✓ | ✓ |
| nomina, auditoria-ia | — | — | ✓ |
| admin, admin.roles | — | — | ✓* |
| admin.empresas | — | — | SUPERADMIN |

\* En Despacho, admin de usuarios/roles del tenant; no gestión global de tenants.

Acceso efectivo = **intersección** `módulos(rol) ∩ módulos(plan)`. SUPERADMIN bypassa plan.

## Oleadas

### Ola 1b — Admin de planes (hecho)
- Tabla `planes_suscripcion` + `plan_modulos` (precio, cupo, módulos).
- UI `/admin/planes` (SUPERADMIN / módulo `admin.planes`).
- Asignación de plan en `/admin/empresas/[id]`.
- Roles re-seed: USER operativo, ADMIN sin plataforma, SUPERADMIN todo.
- Runtime: `resolvePlan()` desde DB; fallback estático si no hay migración.
1. Catálogo `src/lib/plans.ts` + doc de producto.
2. `Tenant.planCodigo` + enforcement cupo emisores.
3. Auth/me + RBAC con módulos efectivos (rol ∩ plan).
4. Sidebar/BottomNav filtrados; upgrade CTA si el plan bloquea.
5. Dashboard por plan (KPIs negocio vs tributarios); quitar hardcodes.
6. Shell fixes: logout unificado, un solo título de página.
7. `DESIGN.md` (Impeccable) + corridas `npm run doctor` en hallazgos UX altos.

### Ola 2 — Activación y cobro (PayPhone)
- [x] Botón de Pago Prepare/Confirm (`docs/PAYPHONE.md`)
- [x] Tabla `pagos_suscripcion` + vigencia en tenant/cuenta
- [x] UI `/suscripcion` y `/facturacion/resultado` (renombre ES)
- [x] Pago actualiza `cuentas.plan_codigo` (todas las empresas de la cuenta)
- [x] Homepage `/` + `/precios` comerciales
- [x] Onboarding: `?plan=&periodo=` en registro → `/suscripcion`
- [x] Recurrencia operativa: cron `/api/cron/suscripciones` + notificaciones + gate vencido
- [x] Migración `010_suscripcion_ciclo_vida.sql` (plan_estado, FKs, índices)

### Ola 3 — Multi-empresa (opción 2) — hecha en núcleo
- [x] Migración `009_multi_empresa_cuentas.sql` (cuentas + tenant_usuarios + backfill)
- [x] Cupo = tenants en cuenta (`assertCanAddEmpresa`); 1 emisor/tenant (`assertCanAddEmisor`)
- [x] `/api/auth/empresas` GET/PUT/POST + login/me con lista
- [x] Topbar: switch de empresas + crear + vincular RUC a la activa
- [ ] Firmas / permisos granulares por empresa (rol en `tenant_usuarios` más allá de ADMIN)
- [ ] Aplicar migraciones 007–009 en DB local y producción

## Criterios de hecho (ola 1)

- [x] Emprendedor no ve ni puede llamar APIs de declaraciones/control-tributario (vía `requireModule` + módulos efectivos).
- [x] Contador capped a 3 empresas; Despacho a 5; Emprendedor a 1 (tenants en cuenta).
- [x] Dashboard Emprendedor prioriza ventas/cobros; sin tarjeta “PENDIENTE” hardcodeada.
- [x] `PRODUCT.md` + `DESIGN.md` alineados a audiencia dual.
- [ ] React Doctor: correr `npm run doctor` en CI/local y corregir hallazgos altos restantes del shell.
- [ ] BottomNav con Emitir para Emprendedor.
- [ ] UI de upgrade / cambio de plan (ola 2 parcial: `/planes` ya existe).
- [ ] Aplicar migraciones `006`–`009` en DB local y producción.
