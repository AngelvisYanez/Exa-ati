#!/bin/bash
set -e

# ===================================================
# setup-vps.sh — Configuración inicial del VPS
# OFSERCONT IA — Deploy Docker
# ===================================================

echo "========================================"
echo "  Configuración inicial del VPS"
echo "========================================"

# ─── Actualizar sistema ────────────────────────────────────────
apt update && apt upgrade -y

# ─── Instalar dependencias ─────────────────────────────────────
apt install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  software-properties-common \
  fail2ban \
  ufw \
  git

# ─── Instalar Docker ───────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# ─── Instalar Docker Compose plugin ────────────────────────────
if ! docker compose version &> /dev/null; then
  apt install -y docker-compose-plugin
fi

# ─── Configurar fail2ban ───────────────────────────────────────
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
logpath = %(sshd_log)s
EOF
systemctl restart fail2ban

# ─── Configurar firewall ───────────────────────────────────────
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

# ─── Crear directorios de datos persistentes ───────────────────
mkdir -p /opt/exa-ati/data/{downloads,browser_session,logs}
mkdir -p /opt/exa-ati/deploy
chmod 755 /opt/exa-ati/data

# ─── Swap (si tiene menos de 2GB RAM) ──────────────────────────
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_RAM" -lt 4000 ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "[VPS] Swap de 2GB creado."
fi

echo "========================================"
echo "  Setup completado."
echo "  Próximos pasos:"
echo "  1. git clone <repo> /opt/exa-ati/deploy"
echo "  2. cd /opt/exa-ati/deploy"
echo "  3. Crea un .env con las variables necesarias"
echo "  4. Ejecuta: bash scripts/deploy.sh"
echo "========================================"
