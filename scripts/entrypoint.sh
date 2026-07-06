#!/bin/bash
set -e

echo "========================================"
echo "  OFSERCONT IA — Entrypoint"
echo "========================================"

# ─── Esperar a que PostgreSQL esté listo ─────────────────────
if [ -n "$DATABASE_URL" ]; then
  echo "[ENTRYPOINT] Verificando PostgreSQL..."
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\).*/\1/p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
  DB_PORT=${DB_PORT:-5432}

  for i in $(seq 1 30); do
    if node -e "const n=require('net');const c=n.connect($DB_PORT,'$DB_HOST',()=>{process.exit(0)});c.on('error',()=>{process.exit(1)});" 2>/dev/null; then
      echo "[ENTRYPOINT] PostgreSQL está listo."
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo "[ENTRYPOINT] ERROR: PostgreSQL no está disponible después de 30 intentos."
      exit 1
    fi
    echo "[ENTRYPOINT] PostgreSQL no está listo aún — esperando 2s... (intento $i/30)"
    sleep 2
  done
fi

# ─── Sincronizar esquema de base de datos ────────────────────
echo "[ENTRYPOINT] Ejecutando prisma generate..."
npx prisma generate

echo "[ENTRYPOINT] Ejecutando prisma db push..."
DATABASE_URL="$DATABASE_URL" DIRECT_DATABASE_URL="$DATABASE_URL" npx prisma db push --accept-data-loss 2>&1 | tail -10

# ─── Seed (catálogos + tenant por defecto) ───────────────────
echo "[ENTRYPOINT] Ejecutando seed..."
DATABASE_URL="$DATABASE_URL" npx prisma db seed 2>&1 | tail -10

echo "[ENTRYPOINT] Iniciando aplicación..."
exec npx next start -p 3001
