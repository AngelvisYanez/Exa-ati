@AGENTS.md

# Despliegue

Antes de desplegar EXA-ATI, lee **completo** [`docs/DESPLIEGUE_PRODUCCION.md`](docs/DESPLIEGUE_PRODUCCION.md).
Es la fuente única del procedimiento; `AGENTS.md` solo resume los invariantes.

Puntos que más se olvidan:

- El sitio **no** se sirve desde `httpdocs` ni desde Vercel: es un contenedor Docker
  en `/opt/exa-ati/releases/<sha>` detrás de nginx, puerto `127.0.0.1:3101`.
- Pruebas (`exa-ati-test-app`) y producción (`exa-ati-prod-app`) comparten el 3101.
  Antes de arrancar producción hay que detener pruebas.
- Si el contenedor es `exa-ati-test-app` o falta `EXA_ATI_PRODUCTION_READY=true`,
  **no está en producción**, aunque `/api/health` responda `200`.
- Producción no se activa por un push: requiere la compuerta de la sección 7.
- Verifica siempre desde fuera con `node scripts/deploy/preflight.mjs --sha <sha>`.
