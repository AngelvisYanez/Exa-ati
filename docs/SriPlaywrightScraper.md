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

## Problemas resueltos (3 Jul 2026)
1. **Falsos positivos de XML**: Se corrigió el filtro de `waitForResponse` en `_downloadWithCapture` para ignorar respuestas AJAX parciales de JSF (`faces-request: partial/ajax` y `X-Requested-With: XMLHttpRequest`). Anteriormente, al retornar `text/xml`, estas peticiones resolvían `responseP` prematuramente y guardaban respuestas inválidas como XMLs de comprobantes.
2. **Promesas colgadas y Unhandled Rejections**: Se añadieron manejadores `.catch(() => {})` a las promesas pasadas a `Promise.race` dentro de `_downloadWithCapture`. Esto evita que las promesas que no ganaron la carrera causen excepciones no controladas al expirar tras 25s.
3. **Validación de descargas fallidas**: Se implementó una verificación de código de estado HTTP (2xx) antes de guardar el buffer del archivo en descargas directas.
4. **Modal de relacionados**: Se añadió un bucle de espera activa (hasta 7.5s) que aguarda a que la clave de acceso de 49 dígitos esté presente en el texto del modal antes de proceder a la descarga, evitando registrar valores nulos o la clave del padre.
5. **Limpieza de imports**: Se eliminaron los `require()` dinámicos en los métodos de base de datos y xml-storage, cambiándolos por imports ES estáticos en la parte superior.

## Estado actual del scraper
- Login: funcional
- Búsqueda + CAPTCHA: funcional (table retornó en 3s en 2do intento)
- **Descarga RIDE**: funcional con `waitForEvent('download')`
- **Descarga XML**: funcional con fallback mejorado `_downloadWithCapture` (filtra AJAX)
- **Documentos relacionados**: funcional con polling para evitar clave nula y descarga por capture
- Paginación: sin cambios

## Próximos pasos
1. Probar el flujo completo desde la interfaz de usuario en modo de desarrollo (`npm run dev`) con `connection_mode: 'playwright'` en las opciones del job.
2. Monitorear los logs en `auditoria` y `scraping_job_logs` para verificar la descarga exitosa tanto del XML primario como de los relacionados.
<!-- END:session-sri-scraper -->
