#!/bin/bash
# ===================================================
# Deploy para Plesk UI — Exa-ATI (Docker)
# ===================================================
# Ejecutar después de hacer pull en Plesk (Git extension):
#   bash scripts/deploy-plesk.sh
#
# O configurar como action en Plesk:
#   Git → Repository Settings → Additional deploy actions
# ===================================================

set -euo pipefail

# ─── Configuración ─────────────────────────────────────────
# Directorio donde Plesk clona el repo (ajustar si es necesario)
SOURCE_DIR="${1:-$(pwd)}"
# Directorio del stack Docker en Plesk
STACK_DIR="/opt/psa/var/modules/docker/stacks/exa-ati"
# Archivo compose
COMPOSE_FILE="compose.yaml"
# Puerto de la app
APP_PORT=3001

echo "========================================"
echo "  Exa-ATI — Deploy Plesk (Docker)"
echo "========================================"

# ─── Verificar que estamos en el directorio correcto ────────
echo ""
echo "[1/5] Verificando directorio origen..."

if [ ! -f "$SOURCE_DIR/package.json" ]; then
  echo "ERROR: No se encontró package.json en $SOURCE_DIR"
  echo "Ejecuta desde la raíz del proyecto o pasa la ruta como argumento."
  exit 1
fi

if [ ! -f "$SOURCE_DIR/Dockerfile" ]; then
  echo "ERROR: No se encontró Dockerfile en $SOURCE_DIR"
  exit 1
fi

echo "  Origen: $SOURCE_DIR"
echo "  OK"

# ─── Crear directorio del stack si no existe ────────────────
echo ""
echo "[2/5] Preparando directorio del stack Docker..."

mkdir -p "$STACK_DIR"

# ─── Sincronizar archivos ──────────────────────────────────
echo ""
echo "[3/5] Sincronizando archivos al stack Docker..."

# Limpiar directorio destino (preservando .env)
if [ -d "$STACK_DIR" ]; then
  for item in "$STACK_DIR"/*; do
    name=$(basename "$item")
    if [ "$name" != ".env" ]; then
      rm -rf "$item"
    fi
  done
fi

# Copiar archivos necesarios para el build
cd "$SOURCE_DIR"
for item in *; do
  case "$item" in
    node_modules|.next|.git|downloads|browser_session|logs|*.log)
      ;;
    *)
      cp -r "$item" "$STACK_DIR/"
      ;;
  esac
done

# ─── Crear .env si no existe ──────────────────────────────
echo ""
echo "[4/5] Configurando variables de entorno..."

if [ ! -f "$STACK_DIR/.env" ]; then
  if [ -f "$SOURCE_DIR/.env.plesk.example" ]; then
    cp "$SOURCE_DIR/.env.plesk.example" "$STACK_DIR/.env"
    echo "  AVISO: Se creó .env desde .env.plesk.example"
    echo "  Edita el archivo: nano $STACK_DIR/.env"
  else
    echo "  ERROR: No se encontró .env ni .env.plesk.example"
    exit 1
  fi
else
  echo "  .env existente — no se sobrescribe"
fi

# Verificar que .env tenga DATABASE_URL
if ! grep -q "^DATABASE_URL=" "$STACK_DIR/.env" 2>/dev/null; then
  echo "  AVISO: .env no tiene DATABASE_URL configurado"
fi

echo "  OK"

# ─── Build y Run ──────────────────────────────────────────
echo ""
echo "[5/5] Construyendo e iniciando contenedores..."

cd "$STACK_DIR"

# Verificar si Docker está disponible
if ! command -v docker &> /dev/null; then
  echo "  ERROR: Docker no está instalado"
  exit 1
fi

# Build
echo "  Construyendo imagen..."
docker compose -f "$COMPOSE_FILE" build --no-cache

# Detener contenedores anteriores
echo "  Deteniendo contenedores anteriores..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

# Levantar
echo "  Iniciando servicios..."
docker compose -f "$COMPOSE_FILE" --env-file .env up -d

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
docker compose -f "$COMPOSE_FILE" ps 2>/dev/null || docker ps --filter "name=exa-ati" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "  Configurar proxy inverso en Plesk:"
echo "    Dominio → Proxy Settings → http://127.0.0.1:$APP_PORT"
echo ""
echo "  Logs:"
echo "    docker compose -f $STACK_DIR/$COMPOSE_FILE logs -f"
echo ""
