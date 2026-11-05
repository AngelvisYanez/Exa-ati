<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:deployment-rule -->
# Despliegue de EXA-ATI (obligatorio)

Esta sección vale para **cualquier agente de IA**, sea Claude, ChatGPT/Codex,
OpenCode, Cursor, Gemini o Copilot. No depende de tu proveedor ni de tus
herramientas.

**La fuente única del procedimiento es [`docs/DESPLIEGUE_PRODUCCION.md`](docs/DESPLIEGUE_PRODUCCION.md).
Léela completa antes de desplegar. Si esta sección y ese documento difieren, manda el documento.**

## Qué es este sistema

`Exa-ati` se publica en `ati.exacontable.com` sobre Plesk (`199.89.55.69`), como
contenedor Docker detrás de nginx. **No** se sirve desde `httpdocs`, **no** usa
Vercel y **no** comparte arquitectura con `exa-tareas-app`/`gestion.exacontable.com`.

## Invariantes que no puedes saltarte

1. Se despliega **solo** el SHA que está en `origin/main`. Nunca un branch, nunca
   un commit no publicado, nunca cambios locales sin confirmar.
2. La release vive en `/opt/exa-ati/releases/<sha>`, clonada limpia. Nunca
   sobrescribas `/opt/exa-ati-test`.
3. La imagen se construye **una vez** y se promueve sin reconstruir.
   `EXA_ATI_IMAGE_TAG` debe ser idéntico al `HEAD` de la release.
4. Pruebas y producción usan **ramas Neon distintas**. Producción nunca apunta a
   la rama de pruebas ni al host de cPanel.
5. En pruebas los WSDL son `celcer.sri.gob.ec`; en producción **no** pueden serlo.
6. Producción solo arranca con `EXA_ATI_PRODUCTION_READY=true`, y eso solo se activa
   tras la captura final y la congelación de escrituras en cPanel.
7. Los stacks de pruebas (`exa-ati-test-app`) y producción (`exa-ati-prod-app`)
   usan **el mismo puerto 3101**: son mutuamente excluyentes.
8. No toques `gestion.exacontable.com` (3010) ni el contenedor `waha`: el servidor
   es compartido.
9. Nunca imprimas `.env*`, secretos ni el contenido del helper de Plesk.

## Antes de decir «está en producción»

Comprueba las señales de la sección 4 del documento. Si el contenedor es
`exa-ati-test-app`, o el compose es `compose.plesk-test.yaml`, o
`EXA_ATI_PRODUCTION_READY` no es `true`, el veredicto es **«no está en producción»**
aunque el health devuelva `200`.

## Verificación

```sh
node scripts/deploy/preflight.mjs --sha <sha-esperado>
```

Es de solo lectura. No sustituye las señales de entorno: no distingue pruebas de
producción.

## Honestidad del reporte

No afirmes que algo está desplegado, sano o verificado sin la salida de un comando
que lo demuestre. Si no tienes herramientas o credenciales, entrega el plan y marca
la comprobación como `PENDIENTE`. Prohibido inventar resultados o fabricar sesiones.
<!-- END:deployment-rule -->
