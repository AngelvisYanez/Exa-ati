# Despliegue de EXA-ATI en producción sobre Plesk

Fuente única para todos los agentes. Leer completa antes de desplegar. Actualizar estas reglas no autoriza ejecutar un corte de producción. Ningún procedimiento garantiza disponibilidad sin verificar el resultado real.

## 1. Alcance y arquitectura

- Repositorio autorizado: https://github.com/AngelvisYanez/Exa-ati.git, rama main.
- Dominio: ati.exacontable.com. Plesk: 199.89.55.69. Proxy: 127.0.0.1:3101.
- Releases inmutables: /opt/exa-ati/releases/<sha>.
- Arquitectura objetivo del código actual: Node.js nativo con exa-ati.service (systemd), enlace /opt/exa-ati/current, entorno /opt/exa-ati/env/active.env y datos /opt/exa-ati/shared/{downloads,browser_session,logs,tmp}.

El 30/10/2026 se observó exa-ati-test-app activo, sin servicio nativo activo. Es evidencia histórica, no el estado actual. Descubrir siempre el proceso que sirve el puerto y el dominio. Los archivos Docker y plesk.sh están eliminados en la copia actual: no ejecutar órdenes históricas que dependan de ellos. Si sigue Docker, la migración nativa exige un plan, respaldo y autorización del corte; no cambiar arquitectura como efecto secundario de actualizar una versión.

No usar httpdocs, Vercel ni procedimientos de otros proyectos. No tocar gestion.exacontable.com (3010), waha ni /opt/exa-ati-test. Prohibidas podas globales Docker, reinicios del host y cambios globales de nginx como parte de este despliegue.

## 2. Acceso y secretos

Helper: ../exa-relavera-desarrollo-api/scripts/run_plesk.ps1 -Command <orden>. Nunca imprimir su contenido. Llamadas en serie; máximo 980 caracteres por orden. El scheduler elimina comillas dobles e interpreta porcentajes y sustituciones de shell: evitar esas construcciones y dividir órdenes largas.

El helper oculta stdout cuando la orden termina bien. Solo en diagnósticos de lectura puede terminarse con exit 1 para ver la salida: ese código por sí solo no demuestra fallo remoto. En mutaciones conservar el código real y verificar después con otra llamada de lectura.

Nunca imprimir .env*, entornos completos de procesos o contenedores, URLs de conexión, tokens ni cookies. Mostrar nombres, comparaciones booleanas y metadatos no sensibles. No fabricar sesiones ni usar secretos para saltarse el login.

## 3. Preflight obligatorio

Registrar fecha, objetivo production y SHA. Ejecutar comprobaciones de lectura:

```sh
docker ps --format '{{.Names}} {{.Image}} {{.Ports}}'
systemctl is-active exa-ati
ss -ltnp | grep 3101
readlink -f /opt/exa-ati/current
readlink -f /opt/exa-ati/env/active.env
grep proxy_pass /var/www/vhosts/system/ati.exacontable.com/conf/vhost_nginx.conf
free -m
df -h /
git ls-remote https://github.com/AngelvisYanez/Exa-ati.git refs/heads/main
```

Interpretar ausencia de Docker o systemd según la arquitectura descubierta. Si contradice el plan o el puerto pertenece a otro sistema, detener la activación y resolverlo. No matar procesos sin identificarlos.

Solo desplegar el SHA completo de 40 caracteres publicado en main. Preparar un clon limpio con remoto autorizado; comprobar HEAD y git status --porcelain=v1 --untracked-files=all. Si la copia local tiene cambios, usar un clon limpio: no borrar ni confirmar trabajo ajeno automáticamente. Consultar main nuevamente antes de activar; si avanzó, preparar la release correcta.

Mantener un bloqueo exclusivo durante el despliegue: una sola ejecución puede modificar EXA-ATI. Registrar ejecución, SHA y versión anterior fuera de la release. No retirar bloqueos activos sin identificar a su propietario.

## 4. Identidad de producción

Comprobar el archivo preparado y el entorno efectivo del proceso real, sin imprimir secretos:

- EXA_ATI_ENV=production, EXA_ATI_PRODUCTION_READY=true y NODE_ENV=production.
- EXA_ATI_RELEASE_SHA igual al HEAD de la release y al SHA autorizado.
- NEXT_PUBLIC_APP_URL=https://ati.exacontable.com.
- DATABASE_URL y DIRECT_DATABASE_URL válidas y de la misma rama normalizando hosts pooled/directos. Comparar contra la rama de pruebas y el origen cPanel: ambas deben ser distintas de producción. EXA_ATI_DB_ISOLATED=true por sí solo no demuestra aislamiento.
- Ambos WSDL presentes y correspondientes a endpoints oficiales del SRI de producción. Rechazar celcer.sri.gob.ec, URLs arbitrarias y placeholders. Revisar SRI_ENVIRONMENT y proxies para impedir mezcla de ambientes.
- Secretos e integraciones requeridos configurados; datos persistentes accesibles por el usuario del servicio y respaldados fuera de la release.

Reportar por separado dominio público accesible y producción verificada. DNS en Plesk o health 200 no prueban identidad del entorno. Un contenedor de pruebas o señales contradictorias impiden declarar producción. No renombrar recursos ni cambiar flags para aparentar una migración.

## 5. Primer corte desde cPanel o pruebas

Con autorización explícita del corte y evidencia persistida, realizar en orden:

1. Preparar TTL 300 y esperar la expiración del anterior; HTTPS con renovación automática comprobada.
2. Respaldar base y archivos y comprobar su recuperación. Identificar procesos y trabajos que escriben.
3. Congelar escrituras y trabajos del origen; registrar la hora.
4. Capturar archivos finales y crear una rama Neon nueva desde el origen actualizado. No promover los datos de pruebas.
5. Preparar y validar configuración e integraciones reales. Verificar aislamiento y conteos de datos sin información personal.
6. Importar y verificar archivos persistentes finales antes de admitir usuarios o trabajos que escriban en el destino.
7. Solo entonces establecer EXA_ATI_PRODUCTION_READY=true, activar y verificar. Mantener el origen en mantenimiento durante la propagación.

Si ya existe producción, conservar su base y datos. Una actualización ordinaria no copia cPanel ni crea una base vacía. Migraciones y seeds nunca se ejecutan automáticamente: requieren plan compatible, respaldo y verificación de la rama correcta.

## 6. Preparar y compilar

Clonar el repositorio autorizado en /opt/exa-ati/releases/<sha> y hacer checkout separado del SHA. Comprobar clon limpio antes de introducir artefactos y enlaces. Nunca compilar sobre la release activa.

Construir una vez por SHA con npm ci y npm run build, versión Node soportada y variables públicas correctas para producción: Next.js puede incrustarlas en el build. No promover un build con configuración pública de pruebas. No imprimir secretos en logs. Con menos de 3 GiB disponibles, no compilar en el servidor compartido; preparar un artefacto compatible y verificar procedencia, SHA y checksum.

Exigir salida de build cero, .next/BUILD_ID y manifiesto con SHA, Node, checksum y resultado. node_modules/next no demuestra un build terminado. Un archivo de salida de un intento anterior no demuestra éxito del actual.

Preparar production.env fuera de Git, permisos restrictivos y propietario adecuado. La unidad nativa debe ejecutar como exaati, escuchar solo en 127.0.0.1:3101, usar Restart=always, límite de memoria 1 GiB y estar habilitada al reiniciar. Comprobar versión Node, Chrome y permisos de datos.

`scripts/deploy/deploy.mjs` implementa los controles de despliegue nativo descritos abajo. Requiere un servicio nativo previamente aprovisionado y recuperable: no crea unidades ni migra Docker. La verificación de systemd, permisos, sockets y recuperación real en Plesk sigue siendo obligatoria; las pruebas locales no la sustituyen.

### Uso del script nativo

Ejecutar en Linux/Plesk con permisos para leer el entorno efectivo y reiniciar exclusivamente exa-ati. Preparar primero el usuario exaati, la unidad habilitada, los directorios persistentes y sus permisos. La release debe ser escribible por exaati para compilar; npm se ejecuta con ese usuario. El script no ejecuta migraciones ni modifica nginx, DNS u otros servicios.

Los archivos test.env y production.env requieren permisos 600, NODE_ENV=production y valores literales en una sola línea. No se admiten duplicados, escapes ni comillas internas; no hay expansión de variables. test.env es obligatorio para comparar las bases. Las URLs SRI deben coincidir exactamente con los endpoints oficiales usados por la aplicación; los proxies requieren revisión separada.

```sh
node scripts/deploy/deploy.mjs validate --mode production --sha <sha>
node scripts/deploy/deploy.mjs build --mode production --sha <sha>
node scripts/deploy/deploy.mjs activate --mode production --sha <sha> --approval /ruta/protegida/aprobacion.json
node scripts/deploy/deploy.mjs status --mode production --sha <sha>
```

build es síncrono: para ejecutarlo en segundo plano usar una sesión del operador con log protegido y conservar el código real. No anuncia éxito antes de terminar. Rechaza una release activa, artefactos previos o un manifiesto existente; un fallo requiere investigar y preparar una release limpia durante una intervención controlada, no recompilar a ciegas. El manifiesto protegido guarda SHA, modo, huellas de configuración y artefacto y versión Node. No editarlo para superar una validación. Cambiar configuración después del build invalida su evidencia.

Para activate, el JSON de aprobación debe incluir sha, mode, previousSha, backupReference, backupVerified=true, rollbackCompatible=true, productionGateVerified=true y expiresAt como fecha ISO futura a menos de 24 horas. El operador crea esa evidencia solo tras comprobar respaldo, compatibilidad y compuerta; el script valida la declaración, no demuestra por sí mismo la existencia o restaurabilidad del respaldo. Ver scripts/deploy/approval.example.json. No confirmar estos campos automáticamente.

El script conserva snapshots de entorno con permisos y propietario, reemplaza los enlaces individualmente de forma atómica y restaura ambos si falla la activación o la verificación técnica. No existe una transacción atómica conjunta de los dos enlaces: el bloqueo serializa despliegues y el reinicio se hace después de ambos reemplazos. Los registros protegidos quedan en shared/logs. No eliminar snapshots mientras una release pueda necesitarlos.

El resultado TECHNICAL_CHECKS_OK deja pendientes la sesión legítima, las integraciones y la comprobación desde fuera del servidor. La comprobación pública ejecutada por activate sale desde Plesk; ejecutar también preflight desde una máquina externa. LOCAL_CHECKS_OK de status tampoco declara producción completa. Pruebas del script: npm run test:deploy.

## 7. Activación y recuperación

Antes de interrumpir la versión actual, registrar y comprobar release, entorno y configuración anteriores, respaldos y procedimiento de restauración compatible con los datos actuales. Conservar la configuración anterior protegida sin sobrescribirla durante la preparación.

Activar enlaces por reemplazo atómico y bajo bloqueo; no borrar primero current o active.env. En una migración, detener únicamente el proceso de EXA-ATI identificado. Verificar cada mutación con una llamada posterior independiente de lectura.

Dentro de un plazo acotado exigir servicio activo, HTTP 200, JSON status=healthy y checks.database=ok. Confirmar que el proceso que responde es el nuevo y ejecuta el SHA y entorno esperados; la versión anterior también puede responder al health.

Si falla la activación o la verificación, marcar FALLIDO y restaurar release y entorno anteriores solo cuando sean compatibles con los datos actuales; reiniciar únicamente EXA-ATI y verificar recuperación. Si existen escrituras o esquema incompatibles, congelar escrituras y ejecutar el plan de recuperación aprobado. Nunca revertir datos o DNS a ciegas ni reiniciar repetidamente para ocultar un fallo.

## 8. Verificación externa y cierre

Desde fuera de Plesk, comprobar:

- DNS hacia 199.89.55.69; cadena TLS válida y certificado vigente para el dominio. Renovación programada comprobada por separado.
- HTTP redirige a HTTPS. Health 200 con healthy y database=ok.
- /, /precios, /registro e /iniciar-sesion responden 200. Todos los chunks del login responden 200 y tipo JavaScript; descubrir assets del build real sin asumir nombres de webpack o Turbopack.
- SHA remoto igual al ejecutado, release limpia y señales de producción de la sección 4.
- Login legítimo y acceso a /panel, /emitir, /comprobantes, descargas y aislamiento entre empresas. Sin cuenta disponible: PENDIENTE, nunca fabricar sesión.
- Trabajos programados ejecutados por una sola instancia. Integraciones y SRI mediante operaciones expresamente autorizadas; verificar un despliegue no autoriza emitir comprobantes reales, cobrar ni enviar mensajes.

node scripts/deploy/preflight.mjs --sha <sha> aporta comprobaciones externas de solo lectura, pero no certifica entorno ni SHA del proceso servido. No reemplaza las comprobaciones remotas. Investigar pruebas fallidas; no omitirlas para lograr un resultado verde.

Entregar siempre fecha, evidencia y este reporte:

```text
Dominio público:       accesible | fallo | PENDIENTE
SHA en origin/main:    <sha>
SHA ejecutado:         <sha o PENDIENTE>
Arquitectura real:     <servicio o contenedor>
Entorno verificado:    production | test | PENDIENTE
Release activa:        <ruta>
Build y artefacto:     <resultado y referencia>
Puerto y proceso:      <resultado>
Health y base:         <resultado>
Verificación externa:  <resultado>
Sesión autenticada:    OK | PENDIENTE (motivo)
Rollback preparado:    <referencia y compatibilidad>
Resultado:             PRODUCCIÓN VERIFICADA | INCOMPLETO | FALLIDO
Pendientes:            <lista>
```

PRODUCCIÓN VERIFICADA exige todas las comprobaciones obligatorias correctas. Si faltan credenciales o evidencia, reportar INCOMPLETO y el bloqueo exacto. Conservar origen y respaldos al menos siete días después del primer corte, y releases anteriores con sus evidencias para recuperar actualizaciones.
