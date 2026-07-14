#!/bin/sh
# ===================================================
# Deploy completo: Docker + Nginx — Exa-ATI para Plesk
# ===================================================
# Ejecutar por SSH desde la raíz del proyecto:
#   sh scripts/deploy-plesk-nginx.sh
# ===================================================

set -e

# ─── Configuración ─────────────────────────────────────────
SOURCE_DIR="$(pwd)"
STACK_DIR="/opt/psa/var/modules/docker/stacks/exa-ati"
APP_PORT=3001

echo "========================================"
echo "  Exa-ATI — Deploy Docker + Nginx"
echo "========================================"

# ─── 1. Verificar archivos ─────────────────────────────────
echo ""
echo "[1/6] Verificando archivos..."

if [ ! -f "$SOURCE_DIR/package.json" ]; then
  echo "ERROR: No se encontro package.json en $SOURCE_DIR"
  exit 1
fi

if [ ! -f "$SOURCE_DIR/Dockerfile" ]; then
  echo "ERROR: No se encontro Dockerfile en $SOURCE_DIR"
  exit 1
fi

echo "  OK"

# ─── 2. Copiar archivos al stack Docker ────────────────────
echo ""
echo "[2/6] Copiando archivos al stack Docker..."

mkdir -p "$STACK_DIR"

# Guardar .env si existe
if [ -f "$STACK_DIR/.env" ]; then
  cp "$STACK_DIR/.env" /tmp/.env-bak 2>/dev/null || true
fi

# Limpiar y copiar
rm -rf "$STACK_DIR"
mkdir -p "$STACK_DIR"

# Restaurar .env
if [ -f /tmp/.env-bak ]; then
  cp /tmp/.env-bak "$STACK_DIR/.env"
  rm /tmp/.env-bak
fi

# Copiar archivos uno por uno
cd "$SOURCE_DIR"
for item in *; do
  if [ "$item" != "node_modules" ] && [ "$item" != ".next" ] && [ "$item" != ".git" ] && [ "$item" != "downloads" ] && [ "$item" != "browser_session" ] && [ "$item" != "logs" ]; then
    cp -r "$item" "$STACK_DIR/"
  fi
done

echo "  OK"

# ─── 3. Crear .env si no existe ───────────────────────────
echo ""
echo "[3/6] Configurando variables de entorno..."

if [ ! -f "$STACK_DIR/.env" ]; then
  if [ -f "$SOURCE_DIR/.env.plesk.example" ]; then
    cp "$SOURCE_DIR/.env.plesk.example" "$STACK_DIR/.env"
    echo "  AVISO: Se creo .env desde .env.plesk.example"
    echo "  Edita: nano $STACK_DIR/.env"
  else
    echo "  ERROR: No se encontro .env ni .env.plesk.example"
    exit 1
  fi
else
  echo "  .env existente"
fi

echo "  OK"

# ─── 4. Build Docker ──────────────────────────────────────
echo ""
echo "[4/6] Construyendo imagen Docker..."

cd "$STACK_DIR"
docker compose build --no-cache

echo "  OK"

# ─── 5. Levantar contenedores ─────────────────────────────
echo ""
echo "[5/6] Iniciando contenedores..."

docker compose down --remove-orphans 2>/dev/null || true
docker compose --env-file .env up -d

echo "  OK"

# ─── 6. Configurar Nginx (proxy inverso) ──────────────────
echo ""
echo "[6/6] Configurando Nginx (proxy inverso)..."

# Buscar el dominio de Plesk
DOMAIN_DIR=$(ls /var/www/vhosts/ 2>/dev/null | head -1)

if [ -z "$DOMAIN_DIR" ]; then
  echo "  No se encontro dominio en /var/www/vhosts/"
  echo "  Configura el proxy inverso manualmente en Plesk UI"
else
  # Crear directorio de configuracion de Nginx
  NGINX_CONF="/var/www/vhosts/$DOMAIN_DIR/conf"
  mkdir -p "$NGINX_CONF"

  # Crear archivo de configuracion del proxy inverso
  cat > "$NGINX_CONF/vhost_nginx.conf" << 'NGINXEOF'
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 300s;
    proxy_connect_timeout 30s;
    proxy_send_timeout 300s;
    client_max_body_size 50M;
}
NGINXEOF

  echo "  Nginx configurado en: $NGINX_CONF/vhost_nginx.conf"

  # Recargar Nginx
  /usr/local/psa/admin/sbin/httpdmng --reconfigure-domain "$DOMAIN_DIR" 2>/dev/null || \
  service nginx reload 2>/dev/null || \
  nginx -s reload 2>/dev/null || \
  echo "  AVISO: Recarga Nginx manualmente desde Plesk UI"
fi

echo "  OK"

# ─── Resumen ──────────────────────────────────────────────
echo ""
echo "========================================"
echo "  Deploy completado!"
echo "========================================"
echo ""
echo "  Stack: $STACK_DIR"
echo "  Puerto: $APP_PORT"
echo ""

# Verificar estado
echo "  Estado de contenedores:"
docker ps --filter "name=exa-ati" 2>/dev/null || true

echo ""
echo "  La app estara disponible en: http://$DOMAIN_DIR"
echo ""
echo "  Si no funciona, verifica:"
echo "    1. El proxy inverso en Plesk UI → Hosting Settings"
echo "    2. docker logs exa-ati-app"
echo ""
