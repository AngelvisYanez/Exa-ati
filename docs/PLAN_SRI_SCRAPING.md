# Plan de Implementación — SRI Scraping & Sync

## 1. Visión General

Sistema automático de descarga masiva de comprobantes electrónicos desde el portal web del SRI (`srienlinea.sri.gob.ec`), combinando dos estrategias complementarias para garantizar la máxima cobertura:

1. **Web Scraping (vía Puppeteer):** Navegación automatizada del portal SRI para descargar comprobantes recibidos en un rango de fechas. Opera sobre la UI web del SRI como lo haría un humano.
2. **Sync SOAP (vía servicios web):** Sincronización complementaria mediante los Web Services oficiales del SRI (`cel.sri.gob.ec`), usando `autorizarComprobante` para cada clave de acceso.

El sistema opera en dos entornos paralelos:
- **Vercel Serverless:** API Routes de Next.js que ejecutan el scraping con `@sparticuz/chromium` (límite 300s).
- **Worker Local:** Script Node.js independiente (`scripts/worker/index.ts`) con `puppeteer-extra` + Stealth, ejecución continua con polling.

---

## 2. Fases del Plan

### ⬜ Fase 1 — Corrección de Bugs (COMPLETADA)

| Bug | Archivos | Descripción |
|-----|----------|-------------|
| Placeholder `$18` mismatch | `sri-downloader.ts` | Se reemplazaron placeholders mixtos `?`+`$N` por `$N` uniformes (18 params ↔ 18 placeholders) |
| `IF()` SQL no existe en PostgreSQL | `sri-downloader.ts`, `worker/comprobantes.ts`, `worker/index.ts` | Reemplazo de `IF(cond, then, else)` por `CASE WHEN con THEN ... ELSE ... END` |
| `last_sync_at` y `last_sync_result` faltantes | `prisma/schema.prisma`, `migrate-neon.mjs` | Se agregaron campos a `TenantSettings` + migración Neon |
| Índice `fechaEmision` faltante | `prisma/schema.prisma`, `migrate-neon.mjs` | `@@index([fechaEmision])` en `Comprobante` + `CREATE INDEX` |
| `tenant_id` NULL en `scraping_jobs` | `scraping/route.ts` | Se agregó `tenant_id` al INSERT + `verifyAuth` + permission check |
| Fallo silencioso en `Auditoria` insert | `sri-downloader.ts` | Se usa `job.tenant_id` directo antes de fallback a DB lookup |
| Validación `fechaEmision` futura | 3 rutas `emitir` | Se agregó `fechaEmision <= new Date()` en factura, nota-crédito, retención |
| `Authorization` header faltante | `page.tsx`, `MassDownloadModal.tsx` | Se agregó `Bearer <token>` en POST requests |

### ⬜ Fase 2 — Refactorización (COMPLETADA)

| Cambio | Archivos | Descripción |
|--------|----------|-------------|
| Extraer helpers puros a `sri-utils.ts` | `sri-utils.ts` (nuevo) | 15 funciones helper + `updateComprobanteFromXml` (190 líneas) |
| Interfaz `DbLike` | `sri-utils.ts` | Abstracción con `queryOne`/`query` para hacer `updateComprobanteFromXml` agnóstica al DB |
| `makeDbAdapter(pool)` | `worker/comprobantes.ts` | Wrapper que auto-convierte `$N` → `?` para MySQL |
| Remover imports no usados | Ambos scraper files | Se eliminaron `xml2js`, `fetch` |
| `db.update()` en `db.ts` | `src/lib/sri-api/db.ts` | Nuevo método genérico `UPDATE` con soporte MySQL/Neon |

### ⬜ Fase 3 — Pipeline Coordinado (COMPLETADA)

| Cambio | Archivos | Descripción |
|--------|----------|-------------|
| Post-scrape SOAP sync | `sync/route.ts` | Llama `sincronizarConSri({ modo: 'completo', limite: 30 })` tras scraping |
| Post-scrape SOAP sync (worker) | `worker/index.ts` | Misma llamada SOAP en el worker local |
| Cancelar trabajos | `scraping/route.ts` | Nuevo endpoint `PATCH` para cancelar jobs (status → CANCELLED) |
| Botón Cancelar en UI | `page.tsx`, `MassDownloadModal.tsx` | Botón rojo `Ban` en jobs PENDING/PROCESSING |

### ✅ Fase 4 — Bugs post-implementación (COMPLETADA)

| Bug | Archivos | Descripción |
|-----|----------|-------------|
| `MassDownloadModal` sin sync call | `MassDownloadModal.tsx` | El modal creaba el job pero nunca llamaba `/api/sri/sync`, dejándolo `PENDING` para siempre |
| Sync call traga errores HTTP | `page.tsx` | `fetch(...).catch()` solo captura errores de red; 4xx/5xx se silenciaban |

### ✅ Fase 5 — Anti-detección, Headless y Timeouts (COMPLETADA)

| Cambio | Archivos | Descripción |
|--------|----------|-------------|
| `realisticClick()` en todos los clicks | `sri-utils.ts` (nueva fn) | Reemplaza `page.click()` en búsqueda y login. Mueve mouse con pasos + offset aleatorio y genera clic `isTrusted` vía `Input.dispatchMouseEvent` |
| Click de búsqueda con `realisticClick` | `sri-downloader.ts`, `worker/comprobantes.ts` | Selector `button[id*="btnBuscar"]` ahora usa clic realista |
| Click de login con `realisticClick` | `sri-auth.ts`, `worker/auth.ts` | Selector `button[type="submit"]` ahora usa clic realista |
| Forzar headless siempre | `browser.ts` | Eliminada comprobación `HEADLESS`; siempre lanza en modo headless completo con viewport 1366x768 y flags anti-detección |
| Stealth args mejorados | `browser.ts` | Se agregaron `--window-size`, `--disable-gpu`, `--disable-blink-features=AutomationControlled` |
| Timeouts de navegación 45s → 120s | `sri-auth.ts`, `sri-downloader.ts`, `sync/route.ts`, `worker/auth.ts`, `worker/comprobantes.ts` | El SRI es lento; se incrementaron todos los timeouts de `page.goto()` y `waitForSelector()` críticos a 120s. Se agregó `page.setDefaultNavigationTimeout(120000)` global en `sync/route.ts` |

### ⬜ Fase 6 — Pendiente

- Ejecutar `node scripts/migrate-neon.mjs` para aplicar migraciones pendientes en Neon.
- Probar flujo completo: crear job → scrape → pre-insert → SOAP sync → verificar en Documentos.
- Unificar las copias duplicadas de `sri-downloader.ts` y `worker/comprobantes.ts` (DRY).

---

## 3. Arquitectura

### 3.1 Flujo de Datos

```
Usuario (Browser)
  │
  ├── POST /api/sri/scraping → crea job (status=PENDING)
  │     └── scraping_jobs table
  │
  ├── POST /api/sri/sync { jobId } → procesa job en Vercel
  │     ├── getBrowser() → puppeteer-core + chromium (Vercel)
  │     ├── ensureSession() → login SRI
  │     ├── downloadReceivedComprobantes() → scraping del portal
  │     │     └── por cada día/tipo → comprobantes inserts
  │     └── sincronizarConSri() → sync SOAP complementario
  │
  ├── PATCH /api/sri/scraping { jobId } → cancelar job
  │
  └── GET /api/sri/scraping → lista últimos 20 jobs (poll cada 10s)

Worker Local (scripts/worker/index.ts)
  │
  ├── Poll: scraping_jobs WHERE status='PENDING'
  ├── puppeteer-extra + StealthPlugin
  ├── auth.ts → ensureSession
  ├── modules/comprobantes.ts → downloadReceivedComprobantes (MySQL)
  └── sincronizarConSri() → sync SOAP
```

### 3.2 Árbol de Archivos Clave

```
src/
├── lib/
│   ├── scraping/
│   │   ├── browser.ts         ← Factory de Puppeteer (Vercel/dev)
│   │   ├── sri-auth.ts        ← Login al portal SRI
│   │   ├── sri-utils.ts       ← Helpers compartidos + DbLike interface
│   │   └── sri-downloader.ts  ← Scraper Vercel (usa db unificado)
│   └── sri-api/
│       ├── db.ts              ← Cliente DB unificado (MySQL ↔ Neon)
│       ├── db-prisma.ts       ← Adapter Neon PostgreSQL
│       ├── sync-service.ts    ← Sync SOAP post-scrape
│       ├── sync-utils.ts      ← Tipos y helpers de sync
│       ├── sri-soap-client.ts ← Cliente SOAP SRI
│       ├── auth-helper.ts     ← Middleware JWT
│       └── comprobante-importer.ts ← Parsing XML
├── app/
│   ├── api/sri/
│   │   ├── scraping/route.ts  ← CRUD jobs (POST/PATCH/GET)
│   │   └── sync/
│   │       ├── route.ts       ← Ejecuta scraping + SOAP
│   │       └── status/route.ts ← Estado sync del tenant
│   └── (app)/sri-scraping/page.tsx ← UI principal
├── components/
│   └── MassDownloadModal.tsx  ← UI modal (misma lógica)
scripts/
├── worker/
│   ├── index.ts               ← Worker local (polling loop)
│   ├── auth.ts                ← Login SRI (copia de sri-auth)
│   └── modules/comprobantes.ts ← Scraper MySQL (copia de sri-downloader)
├── migrate-neon.mjs           ← Migraciones PostgreSQL
├── smoke-test.mjs             ← Smoke test MySQL
├── smoke-test-neon.mjs        ← Smoke test Neon
└── test-sri-flow.mjs          ← Test E2E vinculación
```

---

## 4. Decisiones Técnicas Clave

| Decisión | Detalle |
|----------|---------|
| **SQL unificado** | Todo el SQL usa placeholders `$N`; el adapter MySQL los convierte a `?` automáticamente. Sin `IF()` ni funciones MySQL-only. |
| **`DbLike` interface** | Las funciones compartidas en `sri-utils.ts` reciben `DbLike` como parámetro, no importan `db` directamente. Esto evita problemas de resolución de `@/` aliases en scripts. |
| **Dual path scraping+SOAP** | Primero se scrapea el portal (bulk download), luego se sincroniza vía SOAP (belt-and-suspenders). El SOAP es no-fatal: errores se loggean pero no fallan el job. |
| **Auth obligatorio** | Todos los endpoints de escritura requieren JWT vía `verifyAuth()`. El frontend envía `Authorization: Bearer <token>` desde `localStorage`. |
| **Worker local vs Vercel** | El worker local usa MySQL directo, `puppeteer-extra` con Stealth, y directorio persistente `./downloads/`. La ruta Vercel usa el `db` unificado, `@sparticuz/chromium`, y `os.tmpdir()`. |
| **Click realista anti-detección** | Todos los `page.click()` fueron reemplazados por `realisticClick()` que simula movimiento de mouse humano con pasos graduales + offset aleatorio. El evento se genera vía `Input.dispatchMouseEvent` (DevTools Protocol), no es sintético. |
| **Headless forzado** | `browser.ts` lanza Chrome siempre en modo headless con `--disable-blink-features=AutomationControlled` (elimina `navigator.webdriver`), viewport fijo 1366x768 y `--no-sandbox`. |

---

## 5. Estado Actual

| Item | Estado |
|------|--------|
| Corrección de bugs SQL y placeholders | ✅ Completado |
| Migraciones Neon (índices + columnas) | ✅ Completado (script listo) |
| Refactor: helpers compartidos + `DbLike` | ✅ Completado |
| Pipeline: scrape → SOAP sync | ✅ Completado |
| Cancelar jobs (API + UI) | ✅ Completado |
| Headless forzado + stealth | ✅ Completado |
| `realisticClick()` en toda la UI del SRI | ✅ Completado |
| Fix MassDownloadModal sync call | ✅ Completado |
| TypeScript `tsc --noEmit` | ✅ 0 errores |
| Smoke tests MySQL | ✅ 7/7 OK |
| Smoke tests Neon | ✅ 13/13 OK |
| Test E2E vinculación | ✅ Aprobado |
| **Ejecutar migraciones en Neon producción** | ⬜ Pendiente |
| **DRY: unificar scraper duplicado** | ⬜ Pendiente |
| **Probar flujo completo extremo a extremo** | ⬜ Pendiente |

---

## 6. Próximos Pasos

1. `node scripts/migrate-neon.mjs` — aplicar migraciones pendientes en producción Neon.
2. Probar flujo completo: crear job → scrape → pre-insert → SOAP sync → verificar en UI Documentos.
3. Extraer lógica duplicada entre `sri-downloader.ts` y `worker/comprobantes.ts` a un módulo compartido (DRY).
