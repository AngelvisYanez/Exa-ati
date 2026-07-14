#!/bin/bash
# ===================================================
# Script de Despliegue — Exa-ATI en Plesk (Docker)
# ===================================================
# Ejecutar desde la raíz del servidor o vía SSH:
#   bash scripts/deploy-plesk.sh
#
# Requisitos previos:
#   - Docker y Docker Compose instalados
#   - Git instalado
#   - Archivo .env configurado en la raíz del proyecto
# ===================================================

set -euo pipefail

REPO_URL="https://github.com/angelvisyanez/Exa-ati.git"
DEPLOY_DIR="/var/www/exa-ati"
BRANCH="main"
COMPOSE_FILE="docker-compose.plesk.yml"

echo "========================================"
echo "  Exa-ATI — Despliegue en Plesk (Docker)"
echo "========================================"

# ─── 1. Verificar dependencias ─────────────────────────────
echo ""
echo "[1/6] Verificando dependencias..."

if ! command -v docker &> /dev/null; then
  echo "ERROR: Docker no está instalado."
  echo "Instalar: https://docs.docker.com/engine/install/"
  exit 1
fi

if ! docker compose version &> /dev/null; then
  echo "ERROR: Docker Compose no está instalado."
  echo "Instalar: https://docs.docker.com/compose/install/"
  exit 1
fi

if ! command -v git &> /dev/null; then
  echo "ERROR: Git no está instalado."
  echo "Instalar: apt-get install git"
  exit 1
fi

echo "  Docker: $(docker --version)"
echo "  Compose: $(docker compose version --short)"
echo "  Git: $(git --version)"
echo "  OK"

# ─── 2. Clonar o actualizar repositorio ────────────────────
echo ""
echo "[2/6] Configurando repositorio..."

if [ -d "$DEPLOY_DIR/.git" ]; then
  echo "  Repositorio existente. Actualizando..."
  cd "$DEPLOY_DIR"
  git fetch origin
  git checkout $BRANCH
  git pull origin $BRANCH
else
  echo "  Clonando repositorio..."
  if [ -d "$DEPLOY_DIR" ]; then
    echo "  Directorio $DEPLOY_DIR existe pero no es un repositorio git."
    echo "  Eliminando contenido anterior..."
    rm -rf "$DEPLOY_DIR"
  fi
  git clone -b $BRANCH $REPO_URL "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
fi

echo "  Rama: $(git branch --show-current)"
echo "  Último commit: $(git log -1 --pretty=format:'%h %s (%cr)')"
echo "  OK"

# ─── 3. Configurar variables de entorno ────────────────────
echo ""
echo "[3/6] Configurando variables de entorno..."

if [ ! -f ".env" ]; then
  if [ -f ".env.plesk.example" ]; then
    echo "  No se encontró .env. Copiando desde .env.plesk.example..."
    cp .env.plesk.example .env
    echo "  IMPORTANTE: Edita el archivo .env con tus valores reales."
    echo "  nano $DEPLOY_DIR/.env"
    echo ""
    echo "  Presiona Enter cuando hayas editado .env..."
    read -r
  else
    echo "  ERROR: No se encontró .env ni .env.plesk.example"
    echo "  Crea el archivo .env en $DEPLOY_DIR"
    exit 1
  fi
fi

echo "  Variables de entorno: .env encontrado"
echo "  OK"

# ─── 4. Construir imagen Docker ────────────────────────────
echo ""
echo "[4/6] Construyendo imagen Docker (esto puede tardar varios minutos)..."

docker compose -f $COMPOSE_FILE build --no-cache

echo "  Imagen construida exitosamente"
echo "  OK"

# ─── 5. Detener contenedores anteriores ────────────────────
echo ""
echo "[5/6] Deteniendo contenedores anteriores..."

docker compose -f $COMPOSE_FILE down --remove-orphans 2>/dev/null || true

echo "  OK"

# ─── 6. Levantar servicios ────────────────────────────────
echo ""
echo "[6/6] Levantando servicios..."

docker compose -f $COMPOSE_FILE --env-file .env up -d

echo ""
echo "========================================"
echo "  Despliegue completado!"
echo "========================================"
echo ""
echo "  Servicios:"
docker compose -f $COMPOSE_FILE ps
echo ""
echo "  Logs en tiempo real:"
echo "    docker compose -f $COMPOSE_FILE logs -f"
echo ""
echo "  Logs de la app:"
echo "    docker compose -f $COMPOSE_FILE logs -f app"
echo ""
echo "  La aplicación está disponible en:"
echo "    http://localhost:3001"
echo ""
echo "  Para configurar el proxy inverso en Plesk:"
echo "    1. Ve a tu dominio > Hosting Settings"
echo "    2. Configura el proxy inverso a http://localhost:3001"
echo "    3. O usa la directiva Nginx:"
echo ""
echo "    location / {"
echo "      proxy_pass http://127.0.0.1:3001;"
echo "      proxy_http_version 1.1;"
echo "      proxy_set_header Upgrade \$http_upgrade;"
echo "      proxy_set_header Connection 'upgrade';"
echo "      proxy_set_header Host \$host;"
echo "      proxy_set_header X-Real-IP \$remote_addr;"
echo "      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
echo "      proxy_set_header X-Forwarded-Proto \$scheme;"
echo "    }"
echo ""
