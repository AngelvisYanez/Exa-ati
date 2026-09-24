# Plan de Implementación — SRI Scraping & Sync

## 1. Visión General

Sistema automático de descarga masiva de comprobantes electrónicos desde el portal web del SRI (`srienlinea.sri.gob.ec`), combinando dos estrategias complementarias:

1. **Web Scraping (Playwright):** Navegación automatizada del portal SRI (`SriPlaywrightScraper`). Camino activo de la app.
2. **Sync SOAP (vía servicios web):** Sincronización complementaria con Web Services oficiales del SRI.

Entornos:
- **App Next.js:** `job-runner` + Playwright (+ SOAP post-scrape).
- **Worker local (legacy):** `scripts/worker` con Puppeteer; no es el flujo principal.

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

### ✅ Fase 6 — Orquestación unificada (COMPLETADA parcialmente)

| Cambio | Archivos | Descripción |
|--------|----------|-------------|
| Un solo orquestador | `job-runner.ts` | Playwright → SOAP → `COMPLETED`; claim atómico `PENDING/ERROR` → `PROCESSING` |
| Sin doble disparo | `MassDownloadModal.tsx` | Eliminada llamada paralela a `/api/sri/sync` (el POST scraping ya lanza el runner) |
| Chat alineado | `chat/route.ts` | Usa `ejecutarTrabajoScraping` directo (sin HTTP a sync) |
| Auth en sync | `sync/route.ts` | `verifyAuth` + tenant; delega al mismo job-runner |
| COMPLETED prematuro | `sri-playwright-scraper.ts` | Ya no marca `COMPLETED` al terminar un solo flujo |
| Worker sin proxies | `scripts/worker/index.ts` | Continúa en directo; claim atómico por job |

Pendiente restante:
- Ejecutar `node scripts/migrate-neon.mjs` en Neon producción (si aplica).
- Unificar DRY `sri-downloader.ts` ↔ `worker/comprobantes.ts` (el camino app ya usa Playwright).
- Probar flujo E2E real contra el portal SRI (requiere CAPTCHA solver + credenciales).

---

## 3. Arquitectura

### 3.1 Flujo de Datos

```
Usuario (Browser)
  │
  ├── POST /api/sri/scraping → crea job (status=PENDING)
  │     └── ejecutarTrabajoScraping(jobId)  [fire-and-forget]
  │           ├── claim atómico → PROCESSING
  │           ├── SriPlaywrightScraper (recibidos / emitidos)
  │           ├── sincronizarConSri (SOAP)
  │           └── COMPLETED | ERROR
  │
  ├── POST /api/sri/sync { jobId } → mismo orquestador (auth + tenant)
  │
  └── GET /api/sri/scraping → lista últimos 20 jobs

Worker Local (scripts/worker/index.ts)
  │
  ├── Poll + claim atómico PENDING → PROCESSING
  ├── Puppeteer (+ proxy opcional; sin proxy → conexión directa)
  ├── downloadReceivedComprobantes
  └── sincronizarConSri
```

### 3.2 Árbol de Archivos Clave

```
src/
├── services/
│   ├── scraping/
│   │   ├── job-runner.ts          ← Orquestador único (app)
│   │   ├── sri-playwright-scraper.ts  ← Scraper primario
│   │   ├── sri-downloader.ts      ← Legacy Puppeteer (scripts/worker)
│   │   ├── sri-auth.ts / bridge.ts / chromium.ts
│   │   └── http-scraper.ts        ← Sin callers en API (legacy)
│   └── sri-api/
│       ├── db.ts
│       └── sync-service.ts
├── app/api/sri/
│   ├── scraping/route.ts   ← Encola + dispara job-runner
│   └── sync/route.ts       ← Compat: auth + mismo job-runner
scripts/worker/
│   ├── index.ts
│   ├── auth.ts
│   └── modules/comprobantes.ts
```

---

## 4. Decisiones Técnicas Clave

| Decisión | Detalle |
|----------|---------|
| **SQL unificado** | Todo el SQL usa placeholders `$N`; el adapter MySQL los convierte a `?` automáticamente. Sin `IF()` ni funciones MySQL-only. |
| **`DbLike` interface** | Las funciones compartidas en `sri-utils.ts` reciben `DbLike` como parámetro, no importan `db` directamente. Esto evita problemas de resolución de `@/` aliases en scripts. |
| **Orquestador único** | `ejecutarTrabajoScraping` es el único camino de la app: claim atómico → Playwright → SOAP → COMPLETED. Evita doble ejecución UI↔sync. |
| **Dual path scraping+SOAP** | Primero se scrapea el portal (bulk download), luego se sincroniza vía SOAP (belt-and-suspenders). El SOAP es no-fatal si el scrape ya tuvo éxito. |
| **Auth obligatorio** | Todos los endpoints de escritura requieren JWT vía `verifyAuth()`. El frontend envía `Authorization: Bearer <token>` desde `localStorage`. |
| **Worker local vs App** | El worker local usa MySQL directo y Puppeteer; la app usa Playwright + `db` unificado. Claim atómico evita que ambos procesen el mismo job. |
| **Click realista anti-detección** | `realisticClick()` / eventos CDP donde aplica. |
| **Headless** | Chromium/`@sparticuz/chromium` en servidor; worker puede usar Chrome local. |

---

## 5. Estado Actual

| Item | Estado |
|------|--------|
| Corrección de bugs SQL y placeholders | ✅ Completado |
| Migraciones Neon (índices + columnas) | ✅ Completado (script listo) |
| Refactor: helpers compartidos + `DbLike` | ✅ Completado |
| Pipeline: scrape → SOAP sync | ✅ Completado (en job-runner) |
| Cancelar jobs (API + UI) | ✅ Completado |
| Headless forzado + stealth | ✅ Completado |
| Orquestador único + sin doble sync | ✅ Completado |
| Auth en `/api/sri/sync` | ✅ Completado |
| Worker sin bloqueo por falta de proxies | ✅ Completado |
| **Solo Playwright en app (SRI)** | ✅ Completado |
| Action types ampliados (declaraciones, retenciones, obligaciones, ATS) | ✅ Completado |
| EXA/HTTP/`sri-downloader` desconectados de APIs | ✅ Deprecados |
| **Ejecutar migraciones en Neon producción** | ⬜ Pendiente |
| **Worker local Puppeteer (legacy)** | ⬜ Documentado / no ruta app |
| **Probar flujo completo extremo a extremo** | ⬜ Pendiente |

### Arquitectura SRI actual (app)

- **Activo:** `SriPlaywrightScraper` + `job-runner` (`DOWNLOAD_*`, `SCRAPE_RETENCIONES`, `SCRAPE_DECLARACIONES`, `SCRAPE_OBLIGACIONES`, `SCRAPE_ATS`).
- **IESS:** `iess-scraper.ts` (Playwright, portal IESS).
- **Legacy (no usar en APIs):** `exa-scraper`, `http-scraper`, `sri-http-scraper`, `sri-downloader`, worker Puppeteer.
- **ATS:** sync comprobantes del periodo + generación local `POST /api/declaraciones/ats`.
- **Formulario 104:** `submitDeclaration` con sesión `SriPlaywrightScraper` (`alreadyLoggedIn`).

---

## 6. Próximos Pasos

1. `node scripts/migrate-neon.mjs` — aplicar migraciones pendientes en producción Neon (si aplica).
2. Probar flujo E2E real: crear job → scrape → SOAP → verificar en UI Documentos (CAPTCHA vía espera `SRI_CONSULTAR_WAIT_MS`).
3. Mantener worker local como legacy; no reactivar EXA/HTTP en rutas Next.
