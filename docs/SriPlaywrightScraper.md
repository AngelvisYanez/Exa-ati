<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:session-sri-scraper -->
# SriPlaywrightScraper — Session Progress

## Problema detectado (18 Jun 2026)
- Playwright scraper llegó hasta búsqueda de comprobantes recibidos (seleccionó fecha, tipo, click Consultar) pero `_waitForSearchResult` retornó `captcha_error` en **3ms** (falso positivo)
- No extrajo comprobantes aunque habían resultados
- Daba 0 XMLs y 0 PDFs

## Cambios aplicados (sesión 1 — search fixes)
1. **`_searchAndDownload`** — reescrito con loop de 3 intentos en vez de 1 solo. Ahora processa `table`/`no_results` inmediatamente dentro del loop. En `captcha_error` cierra mensajes de error y continúa al siguiente intento. En `timeout` reintenta hasta agotar.
2. **`_waitForSearchResult`** — ahora espera 3s antes del primer chequeo (para que el search realmente se ejecute). Filtra `loading` indicators antes de decidir resultado. Busca mensajes de CAPTCHA solo dentro de elementos `.ui-messages-error, .rf-msg-err` en vez de en todo el body.
3. **`_clickConsultar`** — separado `PrimeFaces.ab()` y `form.submit()` en steps individuales con retorno. Eliminado parámetro `log` no usado.

## Cambios aplicados (sesión 2 — download reescrito)
1. **`_downloadRowFiles`** — reescrito completamente. Ahora identifica las columnas (Documento, RIDE, Documentos relacionados) por su contenido/atributos, no por el índice de botones dentro del row. Usa Playwright `page.waitForEvent('download')` en vez de filesystem polling.
2. **`_downloadFromColumn`** — nuevo método. Dado un índice de columna, setea `downloadPromise` ANTES de hacer click, espera el evento `download` de Playwright, guarda con `dl.saveAs()`. 2 intentos por fallo.
3. **`_downloadRelacionados`** — nuevo método. Click en columna relacionados → espera 3s → chequea si apareció modal → si sí, extrae clave y botones XML/PDF del modal → los descarga con `waitForEvent('download')` → cierra modal. Si no hay modal, loguea "Sin documentos relacionados".
4. Eliminado **`_waitForFileDownload`** (ya no se usa — reemplazado por `waitForEvent('download')`)

## Cambios aplicados (sesión 4 — extracción completa de datos visibles de la tabla)
1. **`_detectColumnHeaders`** — nuevo método. Escanea `<thead> th` con keywords (RUC, CLAVE, TIPO, FECHA, TOTAL, IVA, etc.) para mapear índices de columnas dinámicamente, con fallback hardcodeado.
2. **`_processTableResults`** — reescrito. Ahora extrae TODOS los campos visibles de cada fila: tipo, RUC emisor, razón social emisor, clave, fechas, subtotal, IVA, total. Los guarda en el DB con INSERT o UPDATE (COALESCE). Llama `updateComprobanteFromXml()` tras descargar el XML para enriquecer metadatos.
3. **`_parseSriDate`** — nuevo helper que convierte `DD/MM/YYYY` a `YYYY-MM-DD`.
4. **Importa `updateComprobanteFromXml`, `extractRuc`, `cleanEmisorRazonSocial`, `parseSriFloat`** desde `sri-utils`.

## Datos que ahora se guardan en `comprobantes` desde la tabla visible:
| Columna tabla DB | Origen |
|---|---|
| `clave_acceso` | Columna Clave / Nro. Autorización (49 dígitos) |
| `tipo` | Columna Tipo (mapeado: Factura→01, NC→04, ND→05, Retención→06) |
| `emisor_ruc` | Columna RUC (extraído con `extractRuc`) |
| `emisor_razon_social` | Columna Razón social (limpio con `cleanEmisorRazonSocial`) |
| `importe_total` | Columna Importe Total |
| `total_sin_impuesto` | Columna Valor sin impuestos |
| `total_iva` | Columna IVA |
| `fecha_emision` | Columna Fecha emisión |
| `fecha_autorizacion` | Columna Fecha y hora de autorización |
| `estado` | Siempre `'PENDIENTE'` (luego `updateComprobanteFromXml` lo cambia a `'AUTORIZADO'`) |
| `receptor_identificacion` | Se usa `this.ruc` (el RUC del usuario logueado) |

## Cambios aplicados (sesión 5 — persistencia del XML descargado en xmlStorage)
1. En `_processTableResults`, tras descargar el XML y llamar `updateComprobanteFromXml`, ahora **guarda el XML en xmlStorage** (`xmlStorage.saveXml`) y registra la ruta en `comprobante_xmls.xml_autorizado_path`.

## Flujo completo tras esta sesión:
```
Login → Búsqueda → Tabla visible
↓
Extrae TODOS los campos de la fila (RUC, razón social, tipo, fechas, valores)
↓
INSERT/UPDATE en comprobantes con esos datos
↓
Descarga XML y RIDE (con _downloadWithCapture: download + response + newPage)
↓
updateComprobanteFromXml() parsea el XML y actualiza metadatos + estado=AUTORIZADO
↓
xmlStorage.saveXml() guarda el XML permanentemente en ./downloads/xmls/{ruc}/{año}/{mes}/autorizados/{clave}.xml
↓
comprobante_xmls actualizado con la ruta del XML
```

## Problemas conocidos
- XML del SRI no dispara `download` event de Playwright (usa PrimeFaces AJAX) → corregido con `_downloadWithCapture` (response + newPage fallback), **por probar**
- RIDE funciona con `waitForEvent('download')`
- Documentos relacionados: modal se abre, descargas **por probar**

## Próximos pasos
1. Probar scraper completo: login → búsqueda → extraer tabla → descargar XML/RIDE → guardar en xmlStorage → comprobantes visibles en UI
2. Si XML sigue sin descargar: interceptar con `page.route('**/*')` antes del click
3. Confirmar que sync muestra los documentos después del scrape

## Problema conocido (reportado por log, 18 Jun 2026)
- RIDE descargó bien (vía `waitForEvent('download')`)
- XML **no se descargó** — `waitForEvent('download')` timeout 2 veces (~44s)
- Modal de relacionados se abrió pero no descargó documentos (se completó en 2s)
- **XMLs: 0, PDFs: 1** al finalizar

## Estado actual del scraper
- Login: funcional
- Búsqueda + CAPTCHA: funcional (table retornó en 3s en 2do intento)
- **Descarga RIDE**: funcional con `waitForEvent('download')`
- **Descarga XML**: ROTA (no dispara download event) — corregido con `_downloadWithCapture` (response + newPage fallback), **por probar**
- **Documentos relacionados**: handler presente, modal se abre, descargas **por probar**
- Paginación: sin cambios

## Próximos pasos
1. Probar con HEADLESS=false después de los fixes de `_downloadWithCapture`
2. Si XML sigue sin descargar: revisar el `waitForResponse` filter (el content-type real)
3. Si response tampoco funciona: interceptar con `page.route('**/*.pdf,**/*.xml,*.do*')` antes del click
4. Confirmar descarga de documentos relacionados desde el modal
<!-- END:session-sri-scraper -->
