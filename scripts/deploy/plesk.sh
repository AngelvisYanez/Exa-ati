#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "${0%/*}/../.." && pwd)
cd "$ROOT_DIR"

MODE=${1:-staging}
ACTION=${2:-start}
case "$MODE" in
  staging) ENV_FILE=.env.plesk-test; COMPOSE_FILE=compose.plesk-test.yaml ;;
  production) ENV_FILE=.env.plesk-production; COMPOSE_FILE=compose.plesk-production.yaml ;;
  *) echo 'Uso: sh scripts/deploy/plesk.sh staging|production validate|build|start' >&2; exit 1 ;;
esac
case "$ACTION" in validate|build|start) ;; *) echo 'Accion no valida.' >&2; exit 1 ;; esac
RELEASE_SHA=$(git rev-parse HEAD)
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo 'Hay cambios versionados en esta copia; revisar antes de desplegar.' >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Falta $ENV_FILE. Copia el ejemplo correspondiente y configura la instancia." >&2
  exit 1
fi

NODE_BIN=$(command -v node || true)
if [ -z "$NODE_BIN" ]; then
  for candidate in /opt/plesk/node/26/bin/node /opt/plesk/node/24/bin/node /opt/plesk/node/22/bin/node /opt/plesk/node/20/bin/node /opt/plesk/node/18/bin/node; do
    if [ -x "$candidate" ]; then
      NODE_BIN=$candidate
      break
    fi
  done
fi
if [ -z "$NODE_BIN" ]; then
  echo "No se encontró Node.js en el host Plesk para validar la configuración." >&2
  exit 1
fi

"$NODE_BIN" - "$ENV_FILE" "$MODE" "$RELEASE_SHA" <<'NODE'
const fs = require('node:fs');
const values = {};
const mode = process.argv[3];
const releaseSha = process.argv[4];
for (const line of fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z_0-9]*)=(.*)$/);
  if (match) values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
}
function fail(message) {
  console.error(message);
  process.exit(1);
}
function dbHost(name) {
  const value = values[name];
  if (!value || /USUARIO|CLAVE|HOST|BASE/.test(value)) fail(`${name} falta o tiene valores de ejemplo.`);
  try {
    const url = new URL(value);
    if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname || !url.username || !url.pathname.slice(1)) {
      fail(`${name} no es una URL PostgreSQL completa.`);
    }
    return url.hostname.toLowerCase().replace('-pooler.', '.');
  } catch {
    fail(`${name} no es una URL PostgreSQL válida.`);
  }
}
const sourceHost = values.EXA_ATI_SOURCE_DB_HOST?.toLowerCase().replace('-pooler.', '.');
if (!sourceHost) fail('Falta EXA_ATI_SOURCE_DB_HOST para verificar el aislamiento.');
const appHost = dbHost('DATABASE_URL');
const directHost = dbHost('DIRECT_DATABASE_URL');
if (appHost === sourceHost || directHost === sourceHost) fail('Una URL de pruebas apunta al host de Neon usado por cPanel.');
if (appHost !== directHost) fail('DATABASE_URL y DIRECT_DATABASE_URL deben apuntar a la misma rama de pruebas.');
if (values.EXA_ATI_DB_ISOLATED !== 'true') fail('La instancia requiere una rama aislada de Neon.');
if (values.EXA_ATI_IMAGE_TAG !== releaseSha) fail('EXA_ATI_IMAGE_TAG debe ser el SHA exacto de esta copia publicada.');
if (values.NEXT_PUBLIC_APP_URL !== 'https://ati.exacontable.com') fail('El dominio de esta migracion debe ser https://ati.exacontable.com.');
if (mode === 'production' && values.EXA_ATI_PRODUCTION_READY !== 'true') fail('Produccion requiere confirmar la captura final y la congelacion de cPanel con EXA_ATI_PRODUCTION_READY=true.');
try {
  if (new URL(values.NEXT_PUBLIC_APP_URL).protocol !== 'https:') throw new Error();
} catch {
  fail('NEXT_PUBLIC_APP_URL debe ser una URL HTTPS válida.');
}
for (const name of ['JWT_SECRET', 'ENCRYPTION_KEY', 'ENCRYPTION_SALT', 'CRON_SECRET']) {
  if (!values[name] || values[name] === 'REEMPLAZAR') fail(`Configura ${name} antes de desplegar.`);
}
if (mode === 'staging') {
  for (const name of ['SRI_RECEPTION_WSDL', 'SRI_AUTHORIZATION_WSDL']) {
    try {
      const url = new URL(values[name]);
      if (url.protocol !== 'https:' || url.hostname !== 'celcer.sri.gob.ec') throw new Error();
    } catch {
      fail(`${name} debe apuntar al servicio HTTPS de pruebas del SRI (celcer.sri.gob.ec).`);
    }
  }
  if (values.SRI_PROXY_HOST) fail('No configurar SRI_PROXY_HOST en pruebas sin revisar su destino.');
} else {
  for (const name of ['SRI_RECEPTION_WSDL', 'SRI_AUTHORIZATION_WSDL']) {
    if (!values[name]) continue;
    try {
      const url = new URL(values[name]);
      if (url.protocol !== 'https:' || url.hostname === 'celcer.sri.gob.ec') throw new Error();
    } catch {
      fail(`${name} no debe conservar la configuracion de pruebas al promover produccion.`);
    }
  }
}
NODE

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker no está instalado o no está disponible para este usuario en Plesk." >&2
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet
if [ "$ACTION" = validate ]; then
  echo 'Configuracion validada.'
  exit 0
fi
if [ "$ACTION" = build ]; then
  if [ "$MODE" != staging ]; then
    echo 'La imagen se construye en staging y se promueve sin reconstruir.' >&2
    exit 1
  fi
  AVAILABLE_KB=$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)
  if [ "${AVAILABLE_KB:-0}" -lt 3145728 ]; then
    echo 'No compilar: se requieren al menos 3 GiB disponibles para conservar la capacidad de Gestion.' >&2
    exit 1
  fi
  BUILDER=exa-ati-build-$(printf '%.12s' "$RELEASE_SHA")
  docker buildx create --name "$BUILDER" --driver docker-container --driver-opt memory=2g,memory-swap=2g >/dev/null
  trap 'docker buildx rm "$BUILDER" >/dev/null 2>&1 || true' EXIT
  docker buildx build --builder "$BUILDER" --load --progress plain --tag "exa-ati:$RELEASE_SHA" --build-arg NEXT_PUBLIC_APP_URL=https://ati.exacontable.com .
  exit 0
fi
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-build

PORT=$(sed -n 's/^EXA_ATI_TEST_PORT=\([0-9][0-9]*\).*/\1/p' "$ENV_FILE" | tail -1)
PORT=${PORT:-3101}
echo "Verificando http://127.0.0.1:$PORT/api/health"
i=0
while [ "$i" -lt 30 ]; do
  if curl --fail --silent --show-error --max-time 4 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    echo "EXA-ATI lista en el puerto local $PORT."
    exit 0
  fi
  i=$((i + 1))
  sleep 5
done

echo "La aplicación no pasó /api/health. Revisa: docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs app" >&2
exit 1
