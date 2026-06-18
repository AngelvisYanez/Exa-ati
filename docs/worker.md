# Contexto del Worker SRI — OFSERCONT IA

> Documento de referencia técnica para el módulo de scraping y descarga masiva de comprobantes electrónicos desde el portal del SRI de Ecuador.

---

## 1. Propósito

El **Worker SRI** es un proceso de Node.js (TypeScript) que corre en segundo plano. Su función es conectarse al **portal srienlinea.sri.gob.ec** usando Puppeteer (headless Chrome), navegar a la sección de *Comprobantes Recibidos*, buscar facturas o comprobantes por día y tipo, descargar los archivos XML y PDF (RIDE), y guardar la información en la base de datos MySQL `db_sri`.

No es parte del servidor Next.js; es un proceso independiente que se lanza desde la CLI o automáticamente al encolar un trabajo a través de la API.

---

## 2. Árbol de archivos

```
scripts/
├── worker/
│   ├── index.ts                  ← Punto de entrada principal (polling loop)
│   ├── auth.ts                   ← Manejo de sesión SRI y resolución de CAPTCHA
│   └── modules/
│       └── comprobantes.ts       ← Lógica de scraping y escritura en BD
├── buster/                       ← Extensión de Chrome para resolver reCAPTCHA
│   └── manifest.json
└── sri-worker.ts                 ← Versión monolítica legacy (sin módulos)
```

---

## 3. Cómo ejecutar

### Modo headless (producción / background)
```bash
npx tsx scripts/worker/index.ts
# o con npm script definido en package.json:
npm run worker:sri
```

### Modo visible (para resolver sesión por primera vez)
```bash
# En Windows PowerShell:
$env:HEADLESS="false"; npx tsx scripts/worker/index.ts
# En Linux/macOS:
HEADLESS=false npx tsx scripts/worker/index.ts
```

> **Importante:** La primera vez que se corre, o cuando expira la sesión, es necesario ejecutar en modo visible para iniciar sesión manualmente en el browser que abre. La sesión queda guardada en `./browser_session/` y se reutiliza en sucesivos arranques headless.

---

## 4. Variables de entorno relevantes

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `HEADLESS` | `true` | Si es `false`, abre Chrome en ventana visible |
| `ANTICAPTCHA_KEY` | *(vacío)* | API key de anti-captcha.com para resolver reCAPTCHA automáticamente |
| `DB_HOST` | `localhost` | Host de MySQL |
| `DB_PORT` | `3306` | Puerto de MySQL |
| `DB_USER` | `root` | Usuario MySQL |
| `DB_PASSWORD` | *(vacío)* | Contraseña MySQL |
| `DB_NAME` | `db_sri` | Nombre de la base de datos |

---

## 5. Ciclo de vida del worker (`index.ts`)

```
Arranque
│
├─ acquireLock()   → Escribe PID en sri-worker.lock (evita instancias dobles)
│
└─ runWorker() [bucle infinito]
    │
    ├─ Consulta scraping_jobs WHERE status='PENDING' ORDER BY created_at ASC LIMIT 1
    │
    ├─ Si no hay jobs → espera 10s → repite
    │
    └─ Si hay job:
        ├─ Lanza Chrome (con plugin Buster si existe ./scripts/buster/)
        ├─ ensureSession()  → auth.ts
        └─ downloadReceivedComprobantes()  → modules/comprobantes.ts
            └─ Al finalizar: cierra browser, espera 5s, repite
```

---

## 6. Autenticación y sesión (`auth.ts`)

### `ensureSession(page, ruc, claveSri, updateProgress)`

1. Navega a `https://srienlinea.sri.gob.ec/sri-en-linea/contribuyente/perfil`
2. Detecta si hay un formulario de login visible (URL contiene `login` o `openid-connect/auth`)
3. Si se necesita login:
   - Rellena usuario (RUC) y contraseña
   - Si hay CAPTCHA y `ANTICAPTCHA_KEY` está configurado → llama `solveRecaptchaAntiCaptcha()`
   - Hace clic en el botón de login
   - Espera hasta 20s (headless) o 120s (modo visible) a que la URL cambie
4. Si la sesión ya existe (cookie en `browser_session/`), omite el login

### `solveRecaptchaAntiCaptcha(page, action?)`

- Usa la librería `@antiadmin/anticaptchaofficial`
- Sitekey del SRI: `6LdukTQsAAAAAIcciM4GZq4ibeyplUhmWvlScuQE`
- Obtiene un token y lo inyecta en `grecaptcha.enterprise.execute` mediante `page.evaluate()`
- Si la cuenta Anti-Captcha no tiene saldo → falla silenciosamente

### `trySolveRecaptcha(page)` — Buster

- Busca un iframe del challenge de reCAPTCHA (`api2/bframe`)
- Dentro del iframe busca el botón `#solver-button` que inyecta la extensión Buster
- Si lo encuentra, hace clic y espera 6s

---

## 7. Scraping de comprobantes (`modules/comprobantes.ts`)

### Función principal: `downloadReceivedComprobantes(page, pool, job, updateProgress, ...)`

Parámetros del `job` (fila de `scraping_jobs`):

| Campo | Descripción |
|---|---|
| `ruc` | RUC del contribuyente |
| `clave_sri` | Contraseña del portal SRI |
| `fecha_desde` | Fecha de inicio del rango (YYYY-MM-DD) |
| `fecha_hasta` | Fecha de fin del rango (YYYY-MM-DD) |
| `tipo_comprobante` | Código SRI: `'1'`=Factura, `'2'`=Liq., `'3'`=NC, `'4'`=ND, `'6'`=Ret., `'todos'`=Todos |
| `action_type` | `'DOWNLOAD_RECEIVED'` (único soportado) |

### Flujo interno

```
Para cada día en [fecha_desde … fecha_hasta]:
  Para cada tipo en typeCodes (si tipo='todos', itera ['1','2','3','4','6']):
    1. Selecciona Año/Mes/Día en los <select> del portal
    2. Selecciona tipo de comprobante en <select id="cmbTipoComprobante">
    3. Hace clic en "Buscar" (button[id*="btnBuscar"])
    4. Espera resultado (tabla de resultados o mensaje "No existen registros")
       - Si aparece error de CAPTCHA → intenta Anti-Captcha + Buster (hasta 5 reintentos)
    5. Si hay tabla:
       Para cada fila (filtrada por clave de acceso de 49 dígitos):
         a. Extrae: clave de acceso, RUC emisor, razón social, total
         b. INSERT/UPDATE en tabla `comprobantes`
         c. Si falta XML → descarga XML (click en botón de XML → waitForDownload → renombra a downloads/XML/<clave>.xml)
         d. Si falta PDF → descarga PDF (click en botón de PDF → waitForDownload → renombra a downloads/RIDE/<clave>.pdf)
         e. Parsea el XML descargado → updateComprobanteFromXml() → actualiza BD con datos completos
    6. Si hay paginador "siguiente" → navega a la siguiente página y repite
```

### Estrategia de nombre de archivos

```
downloads/
├── XML/
│   └── <claveAcceso49digitos>.xml
├── RIDE/
│   └── <claveAcceso49digitos>.pdf
└── temp/
    └── (carpeta temporal para descargas en curso)
```

---

## 8. Mapeo de tipos de comprobante

El portal SRI usa índices numéricos en su dropdown. La base de datos usa los códigos oficiales de 2 dígitos:

| Selector SRI (`tipo_comprobante`) | Código BD (`tipo`) | Descripción |
|---|---|---|
| `'1'` | `'01'` | Factura |
| `'2'` | `'03'` | Liquidación de Compra |
| `'3'` | `'04'` | Nota de Crédito |
| `'4'` | `'05'` | Nota de Débito |
| `'6'` | `'07'` | Comprobante de Retención |
| `'todos'` | *(itera todos)* | Todos los tipos |

La función `mapSriTypeCode(searchTypeCode)` realiza esta conversión.

---

## 9. Base de datos

### Tabla `scraping_jobs`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | INT AUTO_INCREMENT PK | Identificador del job |
| `ruc` | VARCHAR(20) | RUC del contribuyente |
| `clave_sri` | VARCHAR(255) | Contraseña del portal |
| `fecha_desde` | DATE | Inicio del rango |
| `fecha_hasta` | DATE | Fin del rango |
| `tipo_comprobante` | VARCHAR(50) | Código tipo (`'1'`–`'6'` o `'todos'`) |
| `status` | VARCHAR(50) | `PENDING` → `PROCESSING` → `COMPLETED` / `ERROR` |
| `progress_message` | TEXT | Último mensaje de progreso |
| `action_type` | VARCHAR(50) | `DOWNLOAD_RECEIVED` |
| `created_at` / `updated_at` | TIMESTAMP | Fechas de control |

### Tabla `comprobantes`

Campos clave insertados/actualizados por el worker:

| Campo | Descripción |
|---|---|
| `clave_acceso` | Clave de acceso de 49 dígitos (UNIQUE) |
| `tipo` | Código 2 dígitos: `'01'`, `'03'`, `'04'`, `'05'`, `'07'` |
| `serie` | Establecimiento-punto: `001-010` |
| `secuencial` | 9 dígitos: `000013634` |
| `fecha_emision` | Extraída de los primeros 8 dígitos de la clave de acceso (ddmmyyyy → DATE) |
| `emisor_ruc` | RUC del emisor |
| `emisor_razon_social` | Nombre del emisor |
| `receptor_identificacion` | RUC del receptor |
| `importe_total` | Valor total del comprobante |
| `estado` | `'PENDIENTE'` al insertar, `'AUTORIZADO'` al parsear XML |
| `categoria` | Auto-clasificada por `classifyExpense()` (se preserva si ya fue modificada manualmente) |
| `tenant_id` | UUID del tenant dueño del comprobante |

### Tabla `comprobante_xmls`

Registra los archivos XML descargados localmente. El worker **no escribe** en esta tabla directamente; la función `updateComprobanteFromXml()` actualiza `comprobantes` pero los registros de `comprobante_xmls` los inserta `sync-service.ts` al sincronizar con el SOAP del SRI.

> **Nota actual (junio 2026):** Los XMLs y PDFs descargados desde el portal scraping se guardan solo en disco (`downloads/XML/` y `downloads/RIDE/`). La tabla `comprobante_xmls` es poblada por el flujo de sincronización SOAP (`src/lib/sri-api/sync-service.ts`), no por el worker de scraping. Esto significa que si `comprobante_xmls` tiene registros, la sincronización SOAP ya procesó ese comprobante y lo excluye (lógica de `NOT (c.estado = 'AUTORIZADO' AND cx.id IS NOT NULL)`).

---

## 10. Clasificación automática de gastos

La función `classifyExpense(razonSocial)` asigna una categoría basada en palabras clave del nombre del emisor:

| Categoría | Palabras clave |
|---|---|
| `Alimentación` | favorita, supermaxi, aliment, supermercado |
| `Salud` | farmacia, hospital, salud, medico |
| `Educación` | universidad, colegio, educa |
| `Vivienda` | inmobiliaria, arriendo, vivienda |
| `Vestimenta` | ropa, textil, moda |
| `Negocio/Servicios` | telecom, claro, cnt, internet |
| `Otros` | *(cualquier otro)* |

La categoría solo se sobreescribe en la BD si es `NULL` o `'Otros'`, preservando asignaciones manuales del usuario.

---

## 11. Manejo de CAPTCHA

El portal del SRI usa **reCAPTCHA Enterprise Invisible** en el botón "Consultar" de comprobantes recibidos. El worker intenta resolverlo en este orden:

1. **Anti-Captcha** (`ANTICAPTCHA_KEY`): Servicio externo de pago. Si la cuenta tiene saldo, resuelve el token e inyecta en `grecaptcha.enterprise.execute`. Gratuito hasta agotar créditos.
2. **Buster** (extensión Chrome): Si está instalada en `./scripts/buster/`, intenta hacer clic en el botón de resolución de audio del challenge frame.
3. **Reintento manual**: Si ambos fallan, reintenta hasta 5 veces (retrying the search). Si ninguno funciona, omite ese día/tipo y continúa.

> **Problema conocido:** Si la cuenta de Anti-Captcha tiene balance en cero (`ERROR_ZERO_BALANCE`), el worker recae en Buster. Si el challenge no aparece de forma visible, Buster tampoco funciona. En ese caso, el modo headless falla. **Solución temporal:** ejecutar el worker en modo visible (`HEADLESS=false`) para resolver el CAPTCHA manualmente una vez y guardar las cookies.

---

## 12. Integración con la API Next.js

### Encolar un trabajo

`POST /api/sri/scraping` — acepta:
```json
{
  "ruc": "0704439892001",
  "clave_sri": "ClavePortalSRI",
  "fecha_desde": "2026-06-01",
  "fecha_hasta": "2026-06-30",
  "tipo_comprobante": "todos"
}
```
Válido para `tipo_comprobante`: `'1'`, `'2'`, `'3'`, `'4'`, `'6'`, `'todos'`.

La API inserta el job en `scraping_jobs` con `status='PENDING'` e intenta arrancar el worker si no está corriendo.

### Monitorear trabajos

`GET /api/sri/scraping` — devuelve los últimos 20 jobs con su estado y mensaje de progreso.

### UI: Descarga Masiva SRI

En el módulo Documentos (`/documentos`), el botón **"Descarga Masiva SRI"** abre `MassDownloadModal.tsx`. Permite configurar el rango de fechas y tipo de comprobante antes de encolar un job. Refresca el historial de trabajos cada 10 segundos automáticamente.

---

## 13. Problemas conocidos y soluciones

| Problema | Causa | Solución |
|---|---|---|
| Worker no procesa jobs | Sesión SRI expirada | Ejecutar en modo visible para re-login |
| CAPTCHA incorrecto en bucle | Anti-Captcha sin saldo | Recargar saldo o usar modo visible |
| "No se encontraron filas de datos visibles" | Tabla no carga / selector JSF incorrecto | Revisar el selector en `comprobantes.ts` (línea ~881) |
| Comprobantes en BD pero no aparecen en Documentos | `comprobante_xmls` tiene registro → sync los excluye | Normal. El sync SOAP solo procesa no-autorizados sin XML |
| Error `ERROR_ZERO_BALANCE` de Anti-Captcha | Cuenta agotada | Ver sección CAPTCHA arriba |
| `net::ERR_ABORTED` en requests de reCAPTCHA | Respuesta normal del portal, no es un error | Se ignora intencionalmente en el código |

---

## 14. Browser Bridge — nuevo sistema de conexión

A partir de junio 2026, se implementó el **Browser Bridge** (`src/lib/scraping/bridge.ts`) que resuelve el problema de CAPTCHA al reutilizar el navegador entre jobs.

### 14.1 Modos de conexión

| Modo | Descripción | CAPTCHA esperado |
|------|-------------|------------------|
| `cdp` | Se conecta al Chrome del usuario vía CDP (puerto 9222). Si no está abierto con debug port, lo lanza automáticamente. | Sin CAPTCHA (usa la sesión real del usuario) |
| `new_browser` | Lanza Chrome nuevo con el perfil personal del usuario | Posible CAPTCHA en login |
| `headless_separate` | Lanza Chrome headless con `./browser_session/` (comportamiento anterior) | Alto CAPTCHA |

### 14.2 Browser caché

El Bridge mantiene UNA sola instancia de Chrome viva (cacheada). Entre jobs:
- **CDP**: se reusa el browser, solo se cierra la página. El browser del usuario nunca se cierra.
- **new_browser / headless_separate**: se cierra el browser al terminar el job (comportamiento normal).

Esto reduce drásticamente los CAPTCHA porque la sesión del SRI nunca se pierde entre jobs.

### 14.3 Opciones de desarrollo en el modal

Cuando `NEXT_PUBLIC_DEV_MODE=true` o `NODE_ENV=development`, el `MassDownloadModal` muestra una sección colapsable **"Opciones de desarrollo"** con:

- **Modo de conexión**: CDP / Nuevo browser / Headless aislado
- **Estrategia CAPTCHA**: Auto / Solo Anti-Captcha / Solo Buster / Manual
- **Debug**: screenshots, verbose logging, DOM dump

Las opciones se almacenan en la nueva columna `options` (JSONB/Text) de `scraping_jobs`.

### 14.4 Arquitectura

```
┌─ Chrome del Usuario (opcional, con --remote-debugging-port=9222)
│  └── CDP ← puppeteer.connect()
│
├─ Browser Bridge (src/lib/scraping/bridge.ts)
│  ├── getConnectedBrowser(mode) → Browser
│  ├── releasePage(page)         → solo cierra la página
│  └── closeBrowser()            → limpia la caché
│
├─ browser.ts (Vercel) → usa Bridge en local, @sparticuz/chromium en Vercel
├─ sync/route.ts       → usa Bridge, no cierra browser en CDP
└─ worker/index.ts     → usa Bridge para CDP/new_browser,
                         puppeteer-extra para headless_separate
```

### 14.5 Archivos modificados/creados

| Archivo | Cambio |
|---------|--------|
| `src/lib/scraping/bridge.ts` | **Nuevo** — Browser Bridge Service |
| `src/lib/scraping/browser.ts` | Refactorizado para delegar al Bridge |
| `scripts/worker/index.ts` | Refactorizado para usar Bridge + leer `options` del job |
| `src/app/api/sri/sync/route.ts` | Usa Bridge, no cierra browser en CDP |
| `src/app/api/sri/scraping/route.ts` | Acepta campo `options` |
| `src/components/MassDownloadModal.tsx` | Agrega sección "Opciones de desarrollo" |
| `prisma/schema.prisma` | Agrega columna `options` a `ScrapingJob` |
| `scripts/migrate-neon.mjs` | Agrega migración de `options` |

## 15. Cómo agregar soporte para un nuevo tipo de acción

1. Agregar el valor a `action_type` en la API (`route.ts`)
2. En `index.ts`, agregar un nuevo `if (action === 'NUEVO_TIPO')` que llame al módulo correspondiente
3. Crear `scripts/worker/modules/nuevo-modulo.ts` con la lógica de scraping
4. Exportar e importar la función desde `index.ts`
