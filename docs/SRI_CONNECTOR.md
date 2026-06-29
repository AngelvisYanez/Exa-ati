# Módulo SRI Connector

Conexión con el Servicio de Rentas Internas del Ecuador: emisión, recepción, sincronización y scraping de comprobantes electrónicos.

---

## Stack

- **Next.js 16** (App Router + API Routes backend)
- **TypeScript**
- **PostgreSQL** (Neon en producción, raw SQL + Prisma 7)
- **SOAP** (`soap` npm, WSDLs del SRI)
- **XAdES-EPES** (`xadesjs` + `node-forge` + `@peculiar/webcrypto`)
- **Puppeteer** (scraping por navegador, opcional)
- **JWT** (`jsonwebtoken`, autenticación API)

---

## Índice

1. [Estructura de directorios](#estructura-de-directorios)
2. [Core Library (`src/lib/sri-api/`)](#1-core-library-srclibsri-api)
3. [API Routes (`src/app/api/sri/`)](#2-api-routes-srcappapisri)
4. [Scraping Engine (`src/lib/scraping/`)](#3-scraping-engine-srclibscraping)
5. [Modelos de Base de Datos](#4-modelos-de-base-de-datos)
6. [Flujos Principales](#5-flujos-principales)
7. [Autenticación y Multi-tenant](#6-autenticación-y-multi-tenant)
8. [Tests](#7-tests)

---

## Estructura de directorios

```
src/
├── lib/
│   ├── sri-api/                  # Lógica de negocio SRI (24 archivos)
│   │   ├── config.ts             # Config desde variables de entorno
│   │   ├── db.ts                 # Pool PostgreSQL raw (mysql2 legacy)
│   │   ├── db-prisma.ts          # Pool PostgreSQL con Prisma 7
│   │   ├── auth-helper.ts        # JWT verify + tenant extraction
│   │   ├── user-resolver.ts      # RUC resolution por request
│   │   ├── clave-acceso.ts       # Generador clave 49 dígitos (módulo 11)
│   │   ├── encryption.ts         # AES-256-CBC (scrypt)
│   │   ├── xml-builder.ts        # Construye XML para 6 tipos de comprobante
│   │   ├── xml-signer.ts         # Firma XAdES-EPES con .p12
│   │   ├── xml-storage.ts        # Persistencia de XMLs en disco
│   │   ├── xsd-validator.ts      # Validación estructural de XML
│   │   ├── sri-soap-client.ts    # Cliente SOAP (recepción + autorización)
│   │   ├── sri-error-handler.ts  # Clasificación de errores SRI
│   │   ├── sri-polling-service.ts # Polling batch de autorizaciones
│   │   ├── sync-service.ts       # Sincronización SRI ↔ BD local
│   │   ├── sync-utils.ts         # Tipos + persistencia de resultado sync
│   │   ├── comprobante-importer.ts # Parseo XML + upsert en BD
│   │   ├── tax-calculator.ts     # Cálculos de impuestos (compras/ventas)
│   │   ├── audit-engine.ts       # Alertas de auditoría
│   │   ├── notifications-engine.ts # Notificaciones (App/Email/WhatsApp)
│   │   ├── chat-context.ts       # Contexto estructurado para LLM
│   │   ├── llm-client.ts         # Cliente LLM multi-proveedor
│   │   └── tenant-llm-config.ts  # Config LLM por tenant
│   ├── scraping/                 # Scraping del portal SRI (8 archivos)
│   │   ├── bridge.ts             # Gestión de conexión Puppeteer
│   │   ├── browser.ts            # Wrapper de navegador
│   │   ├── sri-auth.ts           # Login SRI + reCAPTCHA solver
│   │   ├── sri-downloader.ts     # Descarga vía Puppeteer
│   │   ├── sri-http-scraper.ts   # Scraper HTTP directo
│   │   ├── http-client.ts        # Cliente HTTP con cookies/retry
│   │   ├── http-scraper.ts       # Orquestador scraping día por día
│   │   └── sri-utils.ts          # Helpers compartidos de scraping
│   └── sriClient.ts              # Cliente HTTP frontend → /api
├── app/
│   └── api/
│       └── sri/                  # 15 grupos de rutas (ver sección 2)
└── tests/                        # 11 archivos de test
```

---

## 1. Core Library (`src/lib/sri-api/`)

### `config.ts`
- Lee variables de entorno (`SRI_AMBIENTE`, `DB_*`, `JWT_*`, `ANTICAPTCHA_*`, etc.)
- Expone `getSriConfig()` y helpers de directorios (XML_STORAGE_PATH, CERT_PATH)
- `isProduction()` → `SRI_AMBIENTE === '2'`

### `db.ts` / `db-prisma.ts`
- Dos backends de base de datos:
  - `db.ts`: Pool MySQL con `mysql2` (legado, dev local)
  - `db-prisma.ts`: Pool PostgreSQL con `Prisma 7` (producción, Neon)
- Ambos exponen `query(sql, params)`, `queryOne(sql, params)`, `queryAll(sql, params)`
- Selección automática vía `getDb()` según `DATABASE_URL`

### `auth-helper.ts`
- `verifyAuth(req)` → Extrae token `Authorization: Bearer <jwt>`, verifica con `JWT_SECRET`, retorna `{ id, tenantId, email, role }`
- `requireTenantId(user)` → Valida que `tenantId` exista, lo retorna o lanza 401

### `user-resolver.ts`
- `getUserRuc(user, req?)` → Resuelve el RUC del usuario autenticado:
  1. Query param `?ruc=...` (override, requiere role admin)
  2. RUC asociado al usuario en BD (`SELECT ruc FROM usuarios WHERE id = ?`)
  3. RUC del emisor principal del tenant

### `clave-acceso.ts`
- `generarClaveAcceso(opts)` → Genera clave de 49 dígitos según spec SRI:
  - Fecha emisión, tipo comprobante, RUC, ambiente, serie, secuencial, código numérico, tipo emisión
  - Dígito verificador módulo 11
- `validarClaveAcceso(clave)` → Valida formato y dígito verificador
- `calcularDigitoVerificador(clave)` → Algoritmo módulo 11

### `encryption.ts`
- `encrypt(text)` / `decrypt(encrypted)` → AES-256-CBC con clave derivada vía `scrypt`
- Usado para claves SRI, passwords de servicios externos

### `xml-builder.ts`
- `buildXml(tipo, data)` → Construye XML para 6 tipos:
  - `factura` (01), `notaCredito` (04), `notaDebito` (05), `comprobanteRetencion` (07), `liquidacionCompra` (03), `guiaRemision` (06)
- `parseXml(xmlString)` → Parsea XML a objeto JS
- Maneja infoTributaria, detalles, impuestos, pagos, documentos relacionados

### `xml-signer.ts`
- `signXml(xmlString, p12Buffer, p12Password)` → Firma XAdES-EPES:
  1. Carga certificado .p12 con `node-forge`
  2. Extrae clave privada + certificado
  3. Aplica firma digital con `xadesjs`
  4. Retorna XML firmado como string

### `xml-storage.ts`
- `saveXml(tipo, ruc, claveAcceso, fecha, xml)` → Guarda XML en disco
- `getXmlPath(tipo, ruc, claveAcceso, fecha)` → Ruta organizada: `{base}/{tipo}/{ruc}/{YYYY}/{MM}/{claveAcceso}.xml`
- `readXml(path)` → Lee XML de disco

### `xsd-validator.ts`
- `validateXml(xmlContent)` → Validación estructural SIN XSD real (70+ reglas en código):
  - InfoTributaria completa (RUC, ambiente, tipoEmision, razonSocial, etc.)
  - Campos según tipo (factura: infoFactura, retencion: infoCompRetencion, etc.)
  - Totales, impuestos, formas de pago
  - Retorna `{ valido, errors[], warnings[], tipo, claveAcceso }`

### `sri-soap-client.ts`
- `enviarComprobante(xmlFirmado)` → `POST /recepcion?wsdl` → `{ estado, claveAcceso, mensajes[] }`
- `autorizarComprobante(claveAcceso)` → `POST /autorizacion?wsdl` → `{ autorizaciones: { autorizacion: { estado, numeroAutorizacion, fechaAutorizacion, comprobante } } }`
- URLs según ambiente (1=pruebas `celcer.sri.gob.ec`, 2=producción `sri.gob.ec`)

### `sri-error-handler.ts`
- `clasificarError(codigo, mensaje)` → Clasifica errores SRI:
  - `CAMPO_REQUERIDO`, `FORMATO_INVALIDO`, `FIRMA_INVALIDA`, `CLAVE_ACCESO_INVALIDA`, `DUPLICADO`, `SIN_CONEXION`
- `getMensajeAmigable(clasificacion)` → Mensaje legible para el usuario

### `sri-polling-service.ts`
- `startPolling(tenantId, userRuc)` → Inicia intervalo que cada N segundos consulta comprobantes pendientes contra SRI
- `pollPendingComprobantes(tenantId, userRuc)` → Llamada única que:
  1. Busca comprobantes con estado `PENDIENTE|FIRMADO|ENVIADO|DEVUELTA`
  2. Consulta autorización vía SOAP
  3. Actualiza estado y guarda XML si autorizado
- `stopPolling()` → Limpia el intervalo

### `sync-service.ts`
- `sincronizarConSri(tenantId, userRuc, options)` → Sincronización bidireccional SRI ↔ BD local
  - Modos: `completo`, `pendientes`, `emitidos`, `recibidos`
  - Filtros: `fechaDesde`, `fechaHasta`, `estados[]`, `clavesAcceso[]`, `limite`, `reintentar`
  - Flujo:
    1. Construye query según modo/filtros
    2. Itera comprobantes locales (batch de 50)
    3. Para cada uno: consulta `autorizarComprobante` SOAP
    4. Si autorizado: parsea XML, hace upsert en BD, guarda XML
    5. Si no autorizado/rechazado: actualiza estado
    6. Procesa clavesExtra solicitadas (importación directa desde SRI)
    7. Retorna `SyncResult` con procesados, actualizados, importados, errores

### `sync-utils.ts`
- Tipos: `SyncModo`, `SyncResult`, `SyncOptions`
- `persistSyncResult(tenantId, result)` → Guarda resultado en `sync_history`
- `buildSyncMessage(result)` → Mensaje legible

### `comprobante-importer.ts`
- `parseXmlComprobante(xmlString)` → Parsea XML de SRI, extrae: infoTributaria, infoDoc, detalles, impuestos
- `upsertComprobanteFromParsed(parsed, tenantId, userRuc, meta)` → Crea o actualiza comprobante + comprobante_xmls
- `saveAutorizadoXml(comprobanteId, ruc, claveAcceso, fecha, xml)` → Guarda XML autorizado

### `tax-calculator.ts`
- `calcularResumenImpuestos(tenantId, userRuc, fechaDesde, fechaHasta)` → Calcula:
  - Total compras, ventas, retenciones IVA/renta
  - IVA cobrado/pagado
  - Valores para declaración mensual SRI

### `audit-engine.ts`
- `generarAlertas(tenantId, userId)` → Genera alertas de auditoría:
  - Saltos en secuenciales por punto de emisión
  - Comprobantes pendientes de autorización > 48h
  - Declaraciones mensuales atrasadas
  - Discrepancias IVA

### `notifications-engine.ts`
- `procesarNotificaciones(tenantId, alertas)` → Genera notificaciones:
  - Canales: `app` (BD), `email`, `whatsapp`
  - Agrupa por tipo, evita duplicados recientes
  - Inserta en tabla `notificaciones`

### `chat-context.ts`
- `buildChatContext(usuario, mensaje)` → Construye contexto estructurado para LLM
  - Datos del usuario, emisores, resumen de comprobantes, últimas actividades
  - Retorna JSON que se inyecta en el system prompt

### `llm-client.ts`
- `queryLLM(tenantId, prompt, context?)` → Ejecuta consulta a LLM configurado por tenant
- Soporta: Gemini, OpenAI, Claude (según `llm_provider` del tenant)

### `tenant-llm-config.ts`
- `getLLMConfig(tenantId)` → Retorna `{ provider, apiKey, model }` para el tenant
- `setLLMConfig(tenantId, config)` → Actualiza configuración

---

## 2. API Routes (`src/app/api/sri/`)

### `GET /api/sri/comprobantes`
- Lista comprobantes del usuario con filtros (`tipo`, `estado`, `fechaDesde`, `fechaHasta`, `search`, `page`, `limit`, `categoria`)
- Auth: JWT Bearer
- Retorna paginado: `{ data[], total, page, limit, totalPages }`

### `GET /api/sri/comprobantes/[claveAcceso]`
- Detalle de un comprobante por clave de acceso
- Auth: JWT + pertenencia al tenant
- Retorna: `{ comprobante, xml?, pdf? }`

### `GET /api/sri/comprobantes/[claveAcceso]/xml`
- Sirve el XML almacenado del comprobante (Content-Type: `application/xml`)
- Auth: JWT

### `GET /api/sri/comprobantes/[claveAcceso]/pdf`
- Sirve el PDF generado del comprobante (Content-Type: `application/pdf`)
- Auth: JWT

### `POST /api/sri/comprobantes/[claveAcceso]/reenviar`
- Reenvía un comprobante al SRI (útil si no llegó o fue devuelto)
- Auth: JWT
- Flujo: Lee XML almacenado → Envía a `recepcion` SOAP → Actualiza estado

### `PUT /api/sri/comprobantes/[claveAcceso]/categorize`
- Actualiza la categoría de un comprobante
- Body: `{ categoria: string }`

### `POST /api/sri/comprobantes/import`
- Importa comprobantes desde XML subido manualmente
- Body: `{ xmls: string[] }`
- Detecta tipo, valida pertenencia al RUC, clasifica gasto automáticamente, persiste
- Post-import: sincroniza contra SRI vía SOAP

### `POST /api/sri/comprobantes/sync`
- Sincronización manual contra SRI (vía SOAP)
- Body: `{ modo, estados?, limite?, fechaDesde?, fechaHasta?, clavesAcceso? }`
- Modos: `completo` | `pendientes` | `emitidos` | `recibidos`
- Persiste resultado + registra en auditoría
- Auth: JWT + tenant

### `POST /api/sri/comprobantes/retry-pending`
- Re-intenta comprobantes en estado pendiente
- Sin bloqueo: max 10 comprobantes por llamada, delay 150ms entre cada uno
- Auth: JWT

### `POST /api/sri/emitir/factura`
- Emite una factura electrónica
- Body: datos de la factura (receptor, detalles, impuestos, pagos)
- Flujo: Valida emisor → Genera clave acceso → Construye XML → Firma → Envía SOAP → Sincroniza → Guarda
- Auth: JWT + tenant

### `POST /api/sri/emitir/nota-credito`
- Emite nota de crédito (mismo flujo que factura)
- Body: datos NC + `numDocModificado`, `codDocModificado` del documento original

### `POST /api/sri/emitir/retencion`
- Emite comprobante de retención
- Body: datos retención + `docsSustento[]`
- Mismo flujo de emisión

### `POST /api/sri/emitir`
- Endpoint genérico de emisión (wrapper sobre los específicos)
- Body: `{ tipo, ...data }`

### `GET /api/sri/emisor`
- Obtiene datos del emisor asociado al usuario
- Auth: JWT

### `PUT /api/sri/emisor`
- Actualiza datos del emisor
- Auth: JWT + tenant

### `GET /api/sri/emisores`
- Lista todos los emisores del tenant
- Auth: JWT (admin)

### `POST /api/sri/vincular`
- Vincula un nuevo emisor al tenant (registra RUC, datos, certificado)
- Auth: JWT + tenant

### `POST /api/sri/desvincular`
- Desvincula un emisor (lo marca como inactivo)
- Body: `{ emisorId }`
- Auth: JWT + tenant

### `POST /api/sri/sync`
- Ejecuta un job de scraping + sync completo
- Body: `{ jobId }`
- Jobs creados vía `POST /api/sri/scraping`
- Flujo:
  1. Marca job como PROCESSING
  2. Si modo HTTP: ejecuta `runHttpScraping()`
  3. Si modo browser: abre Puppeteer, hace login SRI, ejecuta `downloadReceivedComprobantes()`
  4. Post-scraping: ejecuta `sincronizarConSri()` modo `completo` con SOAP
- Vercel maxDuration: 300s

### `GET /api/sri/sync/status`
- Consulta estado de jobs de sincronización
- Query: `jobId` opcional (si no, lista últimos 10)

### `POST /api/sri/scraping`
- Crea un job de scraping en BD
- Body: `{ ruc, claveSri, fechaDesde, fechaHasta, tipo, actionType, options }`
- Retorna `{ jobId }`

### `GET /api/sri/scraping/[id]/logs`
- Obtiene logs de un job de scraping
- Auth: JWT

### `POST /api/sri/validar-xsd`
- Valida un XML contra reglas estructurales SRI
- Body: `{ xml: string }`
- Retorna `{ valido, errors[], warnings[], tipo, claveAcceso }`

### `GET /api/sri/verificar/[claveAcceso]`
- Verifica estado de un comprobante en SRI vía SOAP
- Auth: JWT
- Retorna estado SRI + datos de autorización

### `GET /api/sri/test-connection`
- Prueba de conexión a SRI (ping a WSDL)
- Auth: JWT

### `GET /api/sri/auditoria`
- Lista eventos de auditoría del tenant
- Query: `page`, `limit`, `accion`, `fechaDesde`, `fechaHasta`

### `GET /api/sri/declaraciones`
- Lista declaraciones mensuales calculadas
- Query: `periodo`, `anio`

### `POST /api/sri/declaraciones`
- Genera/actualiza una declaración mensual
- Body: `{ periodo, anio }`

### `GET /api/sri/mobile-qr`
- Genera QR para autenticación móvil
- Retorna QR en base64 + token temporal

---

## 3. Scraping Engine (`src/lib/scraping/`)

### `bridge.ts`
- `getBrowser(mode)` → Obtiene navegador Puppeteer:
  - `cdp`: Conecta a Chrome externo vía CDP
  - `new`: Lanza navegador local con puppeteer
  - `headless`: Lanza en modo headless
- `releasePage(page)` → Libera página (no cierra navegador en modo CDP)
- `getCachedMode()` → Retorna modo cacheado

### `browser.ts`
- Wrapper simple sobre bridge para casos de uso comunes

### `sri-auth.ts`
- `ensureSession(page, ruc, claveSri, onProgress)` → Login en el portal SRI:
  1. Navega a `srienlinea.sri.gob.ec`
  2. Ingresa RUC + clave
  3. Resuelve reCAPTCHA (Anti-Captcha o Buster)
  4. Verifica sesión activa
- `solveRecaptchaAntiCaptcha(page)` → Resuelve reCAPTCHA vía API Anti-Captcha
- `trySolveRecaptcha(page)` → Intenta resolver con Buster (plugin navegador)

### `sri-http-scraper.ts`
- Scraping HTTP directo SIN navegador (más rápido, Vercel-friendly)
- `scrapeDay(ruc, claveSri, fecha)` → Obtiene comprobantes de un día:
  1. Login por POST
  2. Navegación por formularios (viewstate, eventvalidation)
  3. Parseo de tabla de resultados
  4. Descarga de XML/PDF
- Incluye manejo de sesión, cookies, re-login automático

### `http-client.ts`
- Cliente HTTP genérico para scraping:
  - Cookie jar automático
  - Redirect following
  - Proxy support
  - Retry con backoff
  - Timeout configurable
  - User-agent spoofing

### `http-scraper.ts`
- Orquestador de scraping HTTP:
  - Itera rango de fechas día por día (o en paralelo)
  - Coordina login, descarga, parseo
  - Reporta progreso vía callback

### `sri-downloader.ts`
- Versión browser-based (Puppeteer):
  - Login SRI → Navegación a "Comprobantes Recibidos" → Descarga día por día
  - Usa reCAPTCHA solving
  - Más robusto pero más lento

### `sri-utils.ts`
- Helpers compartidos:
  - `parseSriDate(str)` → Parseo de fechas en formato SRI
  - `extractClaveFromTable(row)` → Extrae clave acceso de fila HTML
  - `parseMonto(str)` → Parsea montos ecuatorianos (`.` miles, `,` decimales)
  - `getTipoFromRow(row)` → Detecta tipo comprobante
  - `formatFechaSRI(date)` → Formatea fecha para query SRI
  - `sleep(ms)` → Delay utilitario

---

## 4. Modelos de Base de Datos

### `tenants`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | Identificador único |
| `nombre` | VARCHAR | Nombre del tenant |
| `dominio` | VARCHAR | Dominio personalizado |
| `activo` | BOOLEAN | Si el tenant está activo | 
| `created_at` | TIMESTAMP | Fecha de creación |

### `usuarios`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | |
| `tenant_id` | UUID FK → tenants | Tenant al que pertenece |
| `email` | VARCHAR | Email único | 
| `password_hash` | VARCHAR | bcrypt hash |
| `role` | ENUM('admin','user') | Rol |
| `ruc` | VARCHAR(13) | RUC asociado |
| `nombres` | VARCHAR | |
| `activo` | BOOLEAN | |

### `emisores`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | |
| `tenant_id` | UUID FK | |
| `ruc` | VARCHAR(13) | RUC del emisor |
| `razon_social` | VARCHAR | |
| `nombre_comercial` | VARCHAR | |
| `direccion` | VARCHAR | |
| `contribuyente_especial` | VARCHAR | Resolución |
| `obligado_contabilidad` | BOOLEAN | |
| `certificado_p12` | BYTEA | Certificado digital |
| `clave_certificado` | TEXT (encrypted) | Password del .p12 |
| `ambiente` | INT(1) | 1=Pruebas, 2=Producción |
| `activo` | BOOLEAN | |
| `created_at` | TIMESTAMP | |

### `comprobantes`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | |
| `tenant_id` | UUID FK | |
| `emisor_id` | UUID FK → emisores | |
| `tipo` | VARCHAR(2) | 01, 03, 04, 05, 06, 07 |
| `serie` | VARCHAR(20) | `{estab}-{ptoEmi}` |
| `secuencial` | VARCHAR(9) | Número secuencial |
| `ambiente` | INT(1) | 1=Pruebas, 2=Producción |
| `tipo_emision` | VARCHAR(1) | 1=Normal, 2=Indisponibilidad |
| `clave_acceso` | VARCHAR(49) | PK natural |
| `fecha_emision` | DATE | |
| `estado` | VARCHAR(20) | PENDIENTE, FIRMADO, ENVIADO, AUTORIZADO, DEVUELTA, RECHAZADO |
| `estado_sri` | VARCHAR(20) | Estado reportado por SRI |
| `fecha_autorizacion` | TIMESTAMP | |
| `numero_autorizacion` | VARCHAR(49) | |
| `importe_total` | DECIMAL(12,2) | |
| `total_sin_impuesto` | DECIMAL(12,2) | |
| `total_iva` | DECIMAL(12,2) | |
| `total_descuento` | DECIMAL(12,2) | |
| `emisor_ruc` | VARCHAR(13) | Denormalizado |
| `emisor_razon_social` | VARCHAR | |
| `receptor_identificacion` | VARCHAR(13) | |
| `receptor_razon_social` | VARCHAR | |
| `categoria` | VARCHAR(50) | Clasificación automática |
| `documentos_relacionados` | TEXT | Docs de sustento (retenciones/NC) |

### `comprobante_xmls`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | |
| `comprobante_id` | UUID FK → comprobantes | |
| `tipo` | VARCHAR(20) | `firmado`, `autorizado` |
| `xml` | TEXT | Contenido XML |
| `created_at` | TIMESTAMP | |

### `secuenciales`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | |
| `emisor_id` | UUID FK | |
| `tipo` | VARCHAR(2) | Tipo comprobante |
| `establecimiento` | VARCHAR(3) | |
| `pto_emision` | VARCHAR(3) | |
| `secuencial_actual` | INT | Último número usado |
| `anio` | INT | Año del secuencial |

### `scraping_jobs`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | |
| `tenant_id` | UUID FK | |
| `ruc` | VARCHAR(13) | RUC a scrapear |
| `clave_sri` | TEXT (encrypted) | Clave SRI portal |
| `fecha_desde` | DATE | |
| `fecha_hasta` | DATE | |
| `action_type` | VARCHAR(50) | `DOWNLOAD_RECEIVED` |
| `status` | VARCHAR(20) | PENDING, PROCESSING, COMPLETED, ERROR |
| `progress_message` | TEXT | |
| `options` | JSONB | Config del job |
| `created_at` | TIMESTAMP | |

### `scraping_job_logs`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | |
| `job_id` | UUID FK → scraping_jobs | |
| `level` | VARCHAR(10) | info, error, success |
| `message` | TEXT | |
| `created_at` | TIMESTAMP | |

---

## 5. Flujos Principales

### Emisión (Factura / NC / Retención)

```
Cliente → POST /api/sri/emitir/factura
  │
  ├─ 1. verifyAuth() → usuario + tenantId
  ├─ 2. getUserRuc() → RUC del emisor
  ├─ 3. Obtiene secuencial desde DB
  ├─ 4. generarClaveAcceso() → 49 dígitos
  ├─ 5. xmlBuilder.buildXml('factura', data) → XML sin firmar
  ├─ 6. xmlSigner.signXml(xml, p12, password) → XML firmado XAdES-EPES
  ├─ 7. sriSoapClient.enviarComprobante(xmlFirmado) → SRI recepción
  ├─ 8. Si recibido: sincronizarConSri(clavesAcceso=[clave]) → espera autorización
  ├─ 9. Guarda XML firmado + autorizado en disco y BD
  └─ 10. Retorna { success, claveAcceso, estado, numeroAutorizacion }
```

### Recepción (Scraping portal SRI)

```
Cliente → POST /api/sri/scraping { ruc, claveSri, fechas }
  │
  ├─ Crea scraping_job (status=PENDING)
  └─ Retorna jobId

POST /api/sri/sync { jobId }
  │
  ├─ Marca job PROCESSING
  ├─ ¿connection_mode?
  │   ├─ http → runHttpScraping()
  │   │   ├─ httpClient.login(ruc, clave)
  │   │   ├─ Por cada día en rango:
  │   │   │   ├─ httpClient.getComprobantes(fecha)
  │   │   │   ├─ parsea tabla HTML
  │   │   │   ├─ descarga XML/PDF
  │   │   │   └─ upsert en BD
  │   │   └─ ...
  │   └─ browser → Puppeteer
  │       ├─ ensureSession() → login + captcha
  │       └─ downloadReceivedComprobantes() → descarga día por día
  │
  └─ Post-scraping: sincronizarConSri(modo='completo') vía SOAP
```

### Sincronización (SOAP)

```
POST /api/sri/comprobantes/sync { modo: 'emitidos' }
  │
  ├─ sincronizarConSri(tenantId, userRuc, { modo: 'emitidos' })
  │   ├─ buildSyncQueryParts()
  │   │   └─ modo='emitidos' → WHERE emisor_ruc = userRuc
  │   ├─ fetchComprobantesForSync() (batch 50)
  │   ├─ Para cada comprobante:
  │   │   ├─ sriSoapClient.autorizarComprobante(claveAcceso)
  │   │   ├─ ¿AUTORIZADO? → parseXmlComprobante()
  │   │   │   ├─ upsertComprobanteFromParsed() → crea/actualiza
  │   │   │   └─ saveAutorizadoXml() → guarda XML
  │   │   ├─ ¿RECHAZADO/DEVUELTA? → actualiza estado
  │   │   └─ ¿NO EXISTE? → log
  │   ├─ Procesa clavesExtra[] (importación directa)
  │   └─ Retorna SyncResult { procesados, actualizados, importados, errores }
  ├─ persistSyncResult()
  └─ INSERT auditoria
```

### Importación Manual

```
POST /api/sri/comprobantes/import { xmls: [...] }
  │
  ├─ Por cada XML:
  │   ├─ Detectar tipo (factura, retencion, NC, ND, LC)
  │   ├─ Validar pertenencia al RUC del usuario
  │   ├─ Clasificar gasto por razón social (classifyExpense)
  │   ├─ Validar no duplicado por clave_acceso
  │   └─ INSERT comprobante
  │
  └─ Post-import: sincronizarConSri(clavesAcceso=importadas)
```

### Reenvío

```
POST /api/sri/comprobantes/:claveAcceso/reenviar
  │
  ├─ Lee XML almacenado (firmado o autorizado)
  ├─ sriSoapClient.enviarComprobante(xml)
  ├─ Si recibido: actualiza estado → 'ENVIADO'
  ├─ sincronizarConSri(clavesAcceso=[clave])
  └─ Retorna nuevo estado
```

### Validación XSD

```
POST /api/sri/validar-xsd { xml: "<factura>...</factura>" }
  │
  ├─ xsdValidator.validateXml(xml)
  │   ├─ Parsea XML
  │   ├─ Detecta tipo de comprobante
  │   ├─ Ejecuta 70+ reglas de validación:
  │   │   ├─ infoTributaria: RUC (13 díg), ambiente (1|2), tipoEmision (1|2), etc.
  │   │   ├─ tipo-specifico: infoFactura, infoCompRetencion, infoNotaCredito, etc.
  │   │   ├─ totales: importeTotal, totalSinImpuestos, totalIva, etc.
  │   │   ├─ impuestos: códigos IVA/ICE/IRBPNR, porcentajes, tarifas
  │   │   └─ formas de pago, documentos relacionados, etc.
  │   └─ Retorna { valido, errors[], warnings[], tipo, claveAcceso }
  └─ 200 OK
```

---

## 6. Autenticación y Multi-tenant

- **JWT Bearer**: Todas las rutas API requieren header `Authorization: Bearer <token>`
- **`verifyAuth(req)`**: Extrae y verifica JWT, retorna `{ id, tenantId, email, role }`
- **Tenant isolation**: Cada query incluye `WHERE tenant_id = ?`
- **Endpoints públicos**: solo `/api/auth/login` y `/api/auth/register`
- **RUC resolution**: `getUserRuc()` resuelve el RUC del usuario desde la BD o query param
- **Encriptación**: Claves SRI y passwords de certificados encriptados con AES-256

---

## 7. Tests

| Archivo | Coverage |
|---------|----------|
| `tests/xsd-validator.test.ts` | Validación XML: factura, retención, NC, ND, LC — casos válidos e inválidos |
| `tests/xml-signer.test.ts` | Firma XAdES-EPES con certificado de prueba |
| `tests/xml-builder.test.ts` | Construcción XML para factura, retención, NC |
| `tests/xml-builder-nota-debito.test.ts` | Construcción XML nota de débito |
| `tests/sri-soap-client.test.ts` | Cliente SOAP (mockeado): envío y autorización |
| `tests/sri-polling-service.test.ts` | Polling batch de comprobantes pendientes |
| `tests/sri-error-handler.test.ts` | Clasificación de errores SRI |
| `tests/clave-acceso.test.ts` | Generación y validación de clave 49 dígitos |
| `tests/audit-engine.test.ts` | Generación de alertas de auditoría |
| `tests/notifications-engine.test.ts` | Generación de notificaciones multicanal |
| `tests/routes-exist.test.ts` | Verifica que todas las rutas API existen |

Total: **115 tests** en **11 archivos** — todos pasando.
