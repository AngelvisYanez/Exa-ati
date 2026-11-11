<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:deployment-rule -->
# Despliegue de EXA-ATI en Plesk

La fuente única y obligatoria es [docs/DESPLIEGUE_PRODUCCION.md](docs/DESPLIEGUE_PRODUCCION.md). Leerla completa antes de preparar o ejecutar un despliegue; prevalece sobre documentos históricos.

- Destino: ati.exacontable.com, Plesk 199.89.55.69, puerto 127.0.0.1:3101.
- Descubrir la arquitectura real antes de actuar. El código actual prepara systemd; no usar scripts Docker eliminados ni cambiar arquitectura durante una actualización ordinaria.
- Solo SHA completo publicado en main, clon limpio, build comprobado, bloqueo exclusivo y rollback compatible preparado.
- Producción exige configuración efectiva de producción, datos aislados de pruebas/cPanel y compuerta inicial documentada. Nunca resolver faltantes cambiando flags o renombrando contenedores.
- Validar después de activar tanto el proceso real como el dominio desde fuera. Dominio accesible y producción verificada son resultados distintos.
- No tocar gestion.exacontable.com (3010), waha ni trabajo local ajeno. Nunca imprimir secretos ni el helper de acceso.
- No declarar éxito sin evidencia. Fallos obligatorios detienen el proceso; comprobaciones pendientes se reportan como INCOMPLETO.

Actualizar reglas no ejecuta ni autoriza por sí mismo un corte de producción.
<!-- END:deployment-rule -->
