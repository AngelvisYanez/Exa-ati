# Despliegue de EXA-ATI en Plesk

Seguir [el procedimiento de migracion y despliegue](docs/PLESK_MIGRATION.md).

Usar solo un commit publicado en main, una rama Neon aislada y un directorio propio de EXA-ATI. No ejecutar deploy-plesk-nginx.sh en el servidor compartido: borra el stack y selecciona un dominio automaticamente.

Gestion escucha en 3010; EXA-ATI usa 127.0.0.1:3101. Los procesos de Gestion no forman parte de este despliegue.
