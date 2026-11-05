# Instrucciones para GitHub Copilot

Las instrucciones comunes del repositorio están en [`AGENTS.md`](../AGENTS.md).

## Despliegue

La fuente única del procedimiento es
[`docs/DESPLIEGUE_PRODUCCION.md`](../docs/DESPLIEGUE_PRODUCCION.md). Léela completa
antes de proponer o ejecutar un despliegue.

Resumen:

- `ati.exacontable.com` corre en Plesk (`199.89.55.69`) como contenedor Docker en
  `/opt/exa-ati/releases/<sha>`, detrás de nginx en `127.0.0.1:3101`.
- No se sirve desde `httpdocs`, no usa Vercel y no comparte arquitectura con
  `exa-tareas-app` / `gestion.exacontable.com`.
- Solo se despliega el SHA publicado en `origin/main`.
- Pruebas y producción usan el mismo puerto 3101 y son mutuamente excluyentes.
- Producción solo arranca con `EXA_ATI_PRODUCTION_READY=true` y la compuerta de la
  sección 10 del documento.
- Verificación de solo lectura: `node scripts/deploy/preflight.mjs --sha <sha>`.
