# Despliegue de EXA-ATI en Plesk (Docker)

**Fuente única para todos los agentes.** `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/despliegue-produccion.mdc` y `.github/copilot-instructions.md` apuntan aquí. Si un resumen difiere, prevalece este documento. No afirmar un estado sin la salida de un comando que lo demuestre. No imprimir `.env*`, secretos ni el contenido del helper de Plesk.

## 0. Alcance

| Elemento | Valor |
|---|---|
| Repositorio | `AngelvisYanez/Exa-ati`, rama `main` |
| Dominio | `ati.exacontable.com` |
| Plesk | `199.89.55.69` |
| Modelo | Contenedor Docker detrás de nginx en `127.0.0.1:3101` |
| Releases | `/opt/exa-ati/releases/<sha>` |
| Stacks | `exa-ati-test-app` y `exa-ati-prod-app`, mutuamente excluyentes |

No usar `httpdocs`, Vercel ni instrucciones de `exa-tareas-app` / `gestion.exacontable.com`. No detener el servicio de `gestion.exacontable.com` (3010) ni el contenedor `waha`. No sobrescribir `/opt/exa-ati-test`.

## 1. Invariantes

1. Desplegar exactamente el SHA publicado en `origin/main`, desde un clon limpio en `/opt/exa-ati/releases/<sha>`.
2. Construir `exa-ati:<sha>` una vez. Promover esa misma imagen a producción sin reconstruir. `EXA_ATI_IMAGE_TAG` debe igualar el `HEAD` de la release.
3. Usar ramas Neon distintas para pruebas y producción. Producción nunca apunta a la rama de pruebas. Verificar el host de producción configurado sin imprimir la URL.
4. WSDL de pruebas: `celcer.sri.gob.ec`. WSDL de producción: endpoint real, nunca `celcer.sri.gob.ec`.
5. `EXA_ATI_PRODUCTION_READY=true` solo cuando la base, los archivos y las integraciones de producción en Plesk estén comprobados. La migración desde cPanel ya no es una compuerta de cada despliegue.
6. Los dos stacks usan el mismo puerto 3101: detener pruebas antes de arrancar producción.
7. No ejecutar migraciones ni seeds automáticamente. Aplicar las migraciones requeridas de forma controlada sobre la rama correcta, con copia de seguridad y verificación.
8. Verificar cada mutación con un comando posterior de solo lectura. Ante un fallo obligatorio, detenerse y reportar lo pendiente.

## 2. Acceso al servidor

El helper de acceso es `../exa-relavera-desarrollo-api/scripts/run_plesk.ps1`. No imprimir su contenido. Ejemplo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "..\exa-relavera-desarrollo-api\scripts\run_plesk.ps1" -Command "docker ps --format '{{.Names}}'; exit 1"
```

El helper oculta stdout si la orden termina en cero; para diagnósticos **solo de lectura** se puede terminar con `exit 1`. Las mutaciones conservan su código de salida real y se verifican en una llamada posterior. Ejecutar las llamadas en serie. El scheduler limita el comando a 980 caracteres, elimina comillas dobles e interpreta `%` y `$()`: dividir órdenes largas y evitar esas construcciones. No imprimir variables de entorno completas.

## 3. Preflight local y remoto

```sh
git fetch origin main
git ls-remote origin refs/heads/main
git rev-parse HEAD
git status --porcelain=v1
node scripts/deploy/preflight.mjs --sha <sha>
```

`HEAD` debe igualar `origin/main` y la copia para desplegar debe estar limpia. El preflight es de solo lectura, pero no identifica si el dominio sirve pruebas o producción.

En Plesk, comprobar sin imprimir secretos:

```sh
docker ps --format '{{.Names}} {{.Image}} {{.Ports}}'
docker image inspect exa-ati:<sha> --format '{{.Id}}'
ss -ltnp | grep 3101
free -m
df -h /
git -C /opt/exa-ati/releases/<sha> rev-parse HEAD
git -C /opt/exa-ati/releases/<sha> status --porcelain=v1
```

Si el puerto 3101 pertenece a otro sistema, detenerse. Si hay menos de 3 GiB disponibles, no compilar en el servidor; usar la imagen construida por el workflow manual, verificar su checksum e importarla sin reconstruir. Si el estado del servidor contradice este mapa, detenerse y reportarlo.

## 4. Identificar el entorno

Antes de afirmar que está en producción, comprobar el nombre del contenedor y el compose, y **solo la presencia o coincidencia** de estas variables, sin imprimir sus valores sensibles:

| Señal | Pruebas | Producción |
|---|---|---|
| Contenedor | `exa-ati-test-app` | `exa-ati-prod-app` |
| Compose | `compose.plesk-test.yaml` | `compose.plesk-production.yaml` |
| `EXA_ATI_PRODUCTION_READY` | ausente o `false` | `true` |
| SRI WSDL | `celcer.sri.gob.ec` | endpoint real |
| Base de datos | rama Neon de pruebas | rama Neon de producción distinta de pruebas |

Si cualquier señal indica pruebas, el veredicto es **«no está en producción»**, aunque `/api/health` responda `200`. No inferir el entorno solo por el DNS o el health.

## 5. Preparar y construir la release

```sh
git clone --no-checkout https://github.com/AngelvisYanez/Exa-ati.git /opt/exa-ati/releases/<sha>
cd /opt/exa-ati/releases/<sha>
git checkout <sha>
git status --porcelain=v1
```

Usar `.env.plesk-test` y `.env.plesk-production` fuera de Git, derivados de sus ejemplos y con permisos `600`. Validar los nombres necesarios sin mostrar valores. `DATABASE_URL` y `DIRECT_DATABASE_URL` deben ser de la misma rama de su entorno. Comprobar que la rama de producción difiere de la de pruebas. `NEXT_PUBLIC_APP_URL` debe ser `https://ati.exacontable.com`.

```sh
sh scripts/deploy/plesk.sh staging validate
sh scripts/deploy/plesk.sh staging build
```

El build solo se hace en staging y una vez por SHA. Alternativamente, el workflow manual `.github/workflows/plesk-image.yml` crea la imagen fuera del servidor; importar el artefacto únicamente tras verificar checksum. Comprobar `docker image inspect exa-ati:<sha>` y que la etiqueta corresponda al `HEAD`.

## 6. Pruebas

```sh
sh scripts/deploy/plesk.sh staging start
docker ps --format '{{.Names}} {{.Image}} {{.Ports}}'
curl -fsS http://127.0.0.1:3101/api/health
```

El contenedor de pruebas debe llamarse `exa-ati-test-app`. Validar la aplicación mediante resolución dirigida a Plesk antes del corte DNS. Comprobar login, panel con una cuenta legítima, aislamiento de empresas, descargas, escritura y navegador. No fabricar sesiones ni leer secretos de autenticación.

## 7. Compuerta de producción en Plesk

**Un push no activa producción.** Ejecutar en este orden:

1. Comprobar que DNS y HTTPS de `ati.exacontable.com` sirven desde Plesk y que la renovación del certificado está configurada.
2. Comprobar que la rama Neon de producción existe, es distinta de pruebas y contiene los datos vigentes. No promover la rama de pruebas.
3. Comprobar que los archivos persistentes de producción están en `prod_downloads` y tienen propietario y permisos correctos.
4. Preparar `.env.plesk-production` con la rama de producción, el SHA de la imagen, secretos e integraciones reales. Confirmar WSDL reales y ausencia del host de pruebas.
5. Activar `EXA_ATI_PRODUCTION_READY=true` solo tras las verificaciones anteriores.
6. Validar configuración: `sh scripts/deploy/plesk.sh production validate`.
7. Detener **solo** `exa-ati-test-app` para liberar 3101 y arrancar `sh scripts/deploy/plesk.sh production start` con la imagen ya construida.
8. Verificar contenedor, base, SRI, archivos y rutas públicas antes de admitir usuarios.

Si falta cualquiera de los puntos 1–5, **detenerse**. No sustituir una rama Neon de producción con la de pruebas. No tocar el 3010 ni `waha`. La migración histórica desde cPanel no se repite en despliegues posteriores.

## 8. Verificación externa y reporte

Desde fuera del servidor, verificar `200` y base de datos `ok` en `/api/health`, y `200` en `/`, `/precios`, `/registro` e `/iniciar-sesion`. Verificar chunks JavaScript con tipo `application/javascript`, redirección HTTP a HTTPS, certificado vigente, `HEAD` de release igual a `origin/main`, release limpia y señales de la sección 4. Probar `/panel`, `/emitir` y `/comprobantes` con cuenta legítima; si no existe, marcar **PENDIENTE**.

Reportar siempre:

```text
SHA desplegado:        <sha o PENDIENTE>
SHA en origin/main:    <sha o PENDIENTE>
Entorno:               test | production | PENDIENTE
Release activa:        <ruta y SHA o PENDIENTE>
Contenedor:            <nombre, imagen y estado o PENDIENTE>
Puerto:                127.0.0.1:3101 <estado o PENDIENTE>
Build:                 OK | FALLÓ | no ejecutado
Health:                <estado o PENDIENTE>
Verificación externa:  <resultados o PENDIENTE>
Sesión autenticada:    OK | PENDIENTE
Pendientes:            <lista>
Riesgos abiertos:      <lista>
```

No declarar producción sin todas las señales y pruebas requeridas. Conservar respaldos y la release anterior para rollback. Si hay escrituras nuevas, reconciliar datos antes de revertir a una base anterior.
