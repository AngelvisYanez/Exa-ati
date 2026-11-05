# EXA-ATI: migracion de cPanel a Plesk

Usar exclusivamente un commit publicado en main y una copia limpia fuera del directorio de Gestion. Conservar /opt/exa-ati-test como preparacion; las versiones definitivas se clonan en /opt/exa-ati/releases/<sha>. No sobrescribir cambios versionados del servidor.

El helper Plesk indicado por la regla de exa-tareas-app permite el acceso. Usar PATH=/opt/plesk/node/26/bin:/usr/bin:/bin y no incluir comillas dobles, porcentajes ni sustituciones de comandos en la orden enviada al scheduler. No imprimir el helper ni secretos. Para diagnosticos de lectura se puede terminar con exit 1; las mutaciones mantienen su salida real y se verifican por separado.

## Construccion y prueba

El workflow manual `plesk-image.yml` construye el SHA de main en GitHub, sin credenciales de produccion, y comprueba Google Chrome. Descargar el artefacto en el servidor por un enlace temporal privado, verificar su checksum e importar con docker load. La imagen se llama exa-ati:<sha>. Esto evita compilar en el Plesk compartido cuando no tiene 3 GiB disponibles. La alternativa local `sh scripts/deploy/plesk.sh staging build` aplica ese umbral y limita el builder a 2 GiB.

Crear una rama Neon de pruebas desde el endpoint realmente usado por cPanel. No asumir que .neon identifica produccion. Copiar .env.plesk-test.example a .env.plesk-test, completar el SHA publicado, las URLs de la nueva rama y los secretos necesarios por via privada; aplicar chmod 600. No activar correo, pagos ni WhatsApp en esta fase.

```sh
sh scripts/deploy/plesk.sh staging validate
sh scripts/deploy/plesk.sh staging start
```

El puerto es 127.0.0.1:3101. Validar el dominio ati.exacontable.com mediante resolucion dirigida a Plesk antes de cambiar DNS. Importar los XML/PDF al volumen test_downloads con estructura y propietario UID 1001. Comprobar salud, acceso real, aislamiento de empresas, descargas, escritura y navegador. No ejecutar migraciones ni seeds automaticamente.

El contenedor de EXA-ATI tiene un limite de 1 GiB de RAM, sin swap adicional, para conservar la capacidad del servidor compartido. Si las pruebas reales de scraping superan ese limite, ampliar primero la capacidad del servidor; no retirar el limite sin comprobar recursos. Chrome usa configuracion y cache dentro de /app/tmp, escribibles por el usuario sin privilegios.

## Corte de produccion

Reducir TTL a 300 y esperar el TTL previo. Preparar HTTPS de ati.exacontable.com en Plesk. Congelar escrituras y trabajos en cPanel, capturar archivos finales y crear una nueva rama Neon desde el origen actualizado: no promover la rama usada para pruebas.

Completar .env.plesk-production desde su ejemplo con la rama final, el mismo SHA de imagen, los secretos e integraciones actuales de cPanel. No conservar los WSDL forzados a pruebas. Solo tras verificar la captura final activar EXA_ATI_PRODUCTION_READY=true. Detener exclusivamente el contenedor de pruebas para liberar 3101 y arrancar:

```sh
sh scripts/deploy/plesk.sh production validate
sh scripts/deploy/plesk.sh production start
```

Importar y comprobar los archivos finales en prod_downloads antes de admitir usuarios. Validar HTTPS y salud contra Plesk; cambiar el registro A de ati.exacontable.com a 199.89.55.69. Conservar cPanel en mantenimiento durante la propagacion y verificar login, chunks JavaScript y funciones principales con una cuenta legitima. No fabricar sesiones.

Conservar origen y respaldos siete dias. Antes de nuevas escrituras en Plesk puede revertirse DNS y retirar mantenimiento del origen. Despues de nuevas escrituras, congelar Plesk y reconciliar datos antes de revertir. Comprobar reinicio automatico del contenedor y renovacion SSL.
