#!/bin/sh
# ===================================================
# Deploy Plesk sin Docker — Exa-ATI
# ===================================================
# Ejecutar por SSH desde la raiz del repositorio:
#   sh scripts/deploy-plesk.sh
# ===================================================

set -e

# ─── Configuracion ─────────────────────────────────────────
SOURCE_DIR="$(pwd)"
DEPLOY_DIR="/var/www/vhosts/exa-ati"
APP_PORT=3001

echo "========================================"
echo "  Exa-ATI — Deploy Plesk (sin Docker)"
echo "========================================"

# ─── 1. Verificar archivos ─────────────────────────────────
echo ""
echo "[1/7] Verificando archivos..."

if [ ! -f "$SOURCE_DIR/package.json" ]; then
  echo "ERROR: No se encontro package.json"
  exit 1
fi

echo "  OK"

# ─── 2. Preparar directorio ────────────────────────────────
echo ""
echo "[2/7] Preparando directorio de deploy..."

mkdir -p "$DEPLOY_DIR"

# ─── 3. Copiar archivos ────────────────────────────────────
echo ""
echo "[3/7] Copiando archivos..."

cd "$SOURCE_DIR"
for item in *; do
  if [ "$item" != "node_modules" ] && [ "$item" != ".next" ] && [ "$item" != ".git" ] && [ "$item" != "downloads" ] && [ "$item" != "browser_session" ] && [ "$item" != "logs" ]; then
    cp -r "$item" "$DEPLOY_DIR/"
  fi
done

echo "  OK"

# ─── 4. Variables de entorno ───────────────────────────────
echo ""
echo "[4/7] Configurando variables de entorno..."

if [ ! -f "$DEPLOY_DIR/.env" ]; then
  if [ -f "$SOURCE_DIR/.env.plesk.example" ]; then
    cp "$SOURCE_DIR/.env.plesk.example" "$DEPLOY_DIR/.env"
    echo "  AVISO: Se creo .env — Edita: nano $DEPLOY_DIR/.env"
  fi
else
  echo "  .env existente"
fi

echo "  OK"

# ─── 5. Instalar dependencias ─────────────────────────────
echo ""
echo "[5/7] Instalando dependencias..."

cd "$DEPLOY_DIR"
npm install --production=false

echo "  OK"

# ─── 6. Build ─────────────────────────────────────────────
echo ""
echo "[6/7] Construyendo aplicacion..."

npx prisma generate
npm run build

echo "  OK"

# ─── 7. Configurar Nginx ──────────────────────────────────
echo ""
echo "[7/7] Configurando Nginx..."

NGINX_CONF="/var/www/vhosts/conf"
mkdir -p "$NGINX_CONF"

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

echo "  Nginx configurado"
/usr/local/psa/admin/sbin/httpdmng --reconfigure-all 2>/dev/null || \
service nginx reload 2>/dev/null || \
echo "  AVISO: Recarga Nginx desde Plesk UI"

# ─── Resumen ──────────────────────────────────────────────
echo ""
echo "========================================"
echo "  Deploy completado!"
echo "========================================"
echo ""
echo "  Directorio: $DEPLOY_DIR"
echo "  Puerto: $APP_PORT"
echo ""
echo "  Para iniciar la app:"
echo "    cd $DEPLOY_DIR"
echo "    node app.js &"
echo ""
echo "  O usa el boton 'Restart App' en Plesk UI"
echo ""
