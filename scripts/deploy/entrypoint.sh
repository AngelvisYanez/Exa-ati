#!/bin/bash
set -e

echo "========================================"
echo "  OFSERCONT IA — Entrypoint"
echo "========================================"

echo "[ENTRYPOINT] Iniciando aplicación..."
exec node node_modules/next/dist/bin/next start -p 3001
