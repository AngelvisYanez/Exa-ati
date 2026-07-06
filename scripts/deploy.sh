#!/bin/bash
set -e

# ===================================================
# deploy.sh — Despliegue automático con Docker
# OFSERCONT IA
# ===================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "========================================"
echo "  OFSERCONT IA — Deploy Docker"
echo "========================================"

# ─── Verificar .env ────────────────────────────────────────────
if [ ! -f .env ]; then
  if [ -f env.example ]; then
    echo "[DEPLOY] .env no encontrado. Copiando desde env.example..."
    cp env.example .env
    echo "[DEPLOY] ⚠️  Revisa y configura .env antes de continuar."
    echo "[DEPLOY]    Luego ejecuta: bash scripts/deploy.sh"
    exit 1
  else
    echo "[DEPLOY] ERROR: No existe .env ni env.example"
    exit 1
  fi
fi

# ─── Construir imágenes ───────────────────────────────────────
echo "[DEPLOY] Construyendo imágenes Docker..."
docker compose build

# ─── Iniciar servicios ─────────────────────────────────────────
echo "[DEPLOY] Iniciando contenedores..."
docker compose up -d db
echo "[DEPLOY] Esperando a que PostgreSQL esté listo..."
sleep 10
docker compose up -d

# ─── Esperar healthcheck ──────────────────────────────────────
echo "[DEPLOY] Esperando healthcheck de la aplicación..."
MAX_RETRIES=30
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
  if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "[DEPLOY] ✅ Aplicación lista en http://localhost:3001"
    break
  fi
  RETRY=$((RETRY + 1))
  echo "[DEPLOY] Esperando... ($RETRY/$MAX_RETRIES)"
  sleep 5
done

if [ $RETRY -eq $MAX_RETRIES ]; then
  echo "[DEPLOY] ⚠️  Healthcheck no respondió. Revisa los logs:"
  echo "   docker compose logs app"
fi

echo ""
echo "========================================"
echo "  Despliegue completado"
echo "========================================"
echo ""
echo "  App:        http://localhost:3001"
echo "  Nginx:      http://localhost:80"
echo "  PostgreSQL: localhost:5432"
echo ""
echo "  Comandos útiles:"
echo "    docker compose logs -f app    (logs de la app)"
echo "    docker compose logs -f nginx  (logs de nginx)"
echo "    docker compose ps             (estado de servicios)"
echo "    docker compose down           (detener todo)"
echo "========================================"
