#!/bin/sh
# ===================================================
# Deploy Plesk sin Docker — Exa-ATI
# ===================================================
# Ejecutar desde /httpdocs/exa-ati:
#   sh scripts/deploy-plesk.sh
# ===================================================

set -e

DEPLOY_DIR="/httpdocs/exa-ati"

echo "========================================"
echo "  Exa-ATI — Deploy Plesk"
echo "========================================"

# ─── 1. Ir al directorio ──────────────────────────────────
echo ""
echo "[1/5] Entrando a $DEPLOY_DIR..."

cd "$DEPLOY_DIR"

if [ ! -f "package.json" ]; then
  echo "ERROR: No se encontro package.json en $DEPLOY_DIR"
  exit 1
fi

echo "  OK"

# ─── 2. Variables de entorno ───────────────────────────────
echo ""
echo "[2/5] Verificando variables de entorno..."

if [ ! -f ".env" ]; then
  if [ -f ".env.plesk.example" ]; then
    cp .env.plesk.example .env
    echo "  Se creo .env — Edita: nano .env"
  else
    echo "  AVISO: No hay archivo .env"
  fi
else
  echo "  .env existente"
fi

echo "  OK"

# ─── 3. Instalar dependencias ─────────────────────────────
echo ""
echo "[3/5] Instalando dependencias..."

npm install

echo "  OK"

# ─── 4. Build ─────────────────────────────────────────────
echo ""
echo "[4/5] Construyendo aplicacion..."

npm run build

echo "  OK"

# ─── 5. Configurar Nginx ──────────────────────────────────
echo ""
echo "[5/5] Configurando Nginx..."

mkdir -p /var/www/vhosts/conf

cat > /var/www/vhosts/conf/vhost_nginx.conf << 'NGINXEOF'
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

# ─── Resumen ──────────────────────────────────────────────
echo ""
echo "========================================"
echo "  Deploy completado!"
echo "========================================"
echo ""
echo "  Reinicia la app en Plesk UI → Restart App"
echo ""
