#!/usr/bin/env bash
# Deploy EXA-ATI from GitLab CI. See docs/DESPLIEGUE_PRODUCCION.md.
set -euo pipefail

ROOT=/opt/exa-ati
NODE=/opt/plesk/node/26/bin/node
REPO=git@gitlab.com:exacontable1/exa-ati.git
CLONE_KEY="$ROOT/private/gitlab-ci/id_ed25519_clone"
SHA="${1:-}"
MODE=production
export GIT_SSH_COMMAND="ssh -i $CLONE_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o BatchMode=yes"

if [[ ! "$SHA" =~ ^[a-f0-9]{40}$ ]]; then
  echo "Indica el SHA completo de 40 caracteres." >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Ejecutar como root en Plesk." >&2
  exit 1
fi

if [[ -e "$ROOT/.deploy.lock" ]]; then
  echo "Despliegue bloqueado: .deploy.lock existente." >&2
  exit 1
fi

RELEASE="$ROOT/releases/$SHA"
BIN_DIR="$ROOT/bin"
PRIVATE_BACKUP="$ROOT/private/ci-backup-$(date -u +%Y%m%dT%H%M%SZ)-${SHA:0:12}"
APPROVAL="$PRIVATE_BACKUP/approval.json"
DEPLOY_JS=""

mkdir -p "$BIN_DIR" "$ROOT/private" "$ROOT/releases" "$ROOT/shared/logs" "$ROOT/shared/tmp"
chmod 700 "$ROOT/private"

echo "CI deploy start sha=$SHA"

# Prefer deploy.mjs from the target release once cloned; bootstrap from current if needed.
bootstrap_deploy_js() {
  if [[ -f "$RELEASE/scripts/deploy/deploy.mjs" ]]; then
    DEPLOY_JS="$RELEASE/scripts/deploy/deploy.mjs"
  elif [[ -L "$ROOT/current" && -f "$ROOT/current/scripts/deploy/deploy.mjs" ]]; then
    DEPLOY_JS="$ROOT/current/scripts/deploy/deploy.mjs"
  elif [[ -f "$BIN_DIR/deploy.mjs" ]]; then
    DEPLOY_JS="$BIN_DIR/deploy.mjs"
  else
    echo "No se encontro deploy.mjs para bootstrap." >&2
    exit 1
  fi
}

prepare_release() {
  if [[ -d "$RELEASE" ]]; then
    git -C "$RELEASE" -c safe.directory="$RELEASE" remote get-url origin >/dev/null
    git config --global --add safe.directory "$RELEASE" 2>/dev/null || true
    if [[ "$(git -C "$RELEASE" -c safe.directory="$RELEASE" rev-parse HEAD)" != "$SHA" ]]; then
      echo "Release existente con HEAD distinto; se requiere directorio limpio." >&2
      exit 1
    fi
    if [[ -d "$RELEASE/.next" ]]; then
      echo "Release ya tiene artefactos .next; no se reutiliza." >&2
      exit 1
    fi
    if [[ -f "$ROOT/shared/logs/build-$SHA.json" ]]; then
      echo "Ya existe manifiesto de build para este SHA." >&2
      exit 1
    fi
  else
    git clone --no-checkout "$REPO" "$RELEASE"
    git config --global --add safe.directory "$RELEASE" 2>/dev/null || true
    git -C "$RELEASE" -c safe.directory="$RELEASE" fetch --depth 1 origin "$SHA"
    git -C "$RELEASE" -c safe.directory="$RELEASE" checkout --detach "$SHA"
    chown -R exaati:psacln "$RELEASE"
  fi

  local dirty
  dirty="$(git -C "$RELEASE" -c safe.directory="$RELEASE" status --porcelain=v1 --untracked-files=all || true)"
  if [[ -n "$dirty" ]]; then
    echo "Release no esta limpia." >&2
    exit 1
  fi
  local origin
  origin="$(git -C "$RELEASE" -c safe.directory="$RELEASE" remote get-url origin)"
  if [[ "$origin" != "$REPO" ]]; then
    echo "Origen Git no autorizado." >&2
    exit 1
  fi
}

backup_current() {
  mkdir -p "$PRIVATE_BACKUP"
  chmod 700 "$PRIVATE_BACKUP"
  {
    echo "sha=$SHA"
    echo "started=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "current=$(readlink -f "$ROOT/current" 2>/dev/null || true)"
    echo "active=$(readlink -f "$ROOT/env/active.env" 2>/dev/null || true)"
    echo "service=$(systemctl is-active exa-ati 2>/dev/null || true)"
  } >"$PRIVATE_BACKUP/meta.txt"
  chmod 600 "$PRIVATE_BACKUP/meta.txt"

  if [[ -L "$ROOT/current" ]]; then
    readlink "$ROOT/current" >"$PRIVATE_BACKUP/current.link"
    chmod 600 "$PRIVATE_BACKUP/current.link"
  fi
  if [[ -L "$ROOT/env/active.env" ]]; then
    readlink "$ROOT/env/active.env" >"$PRIVATE_BACKUP/active.link"
    cp -a "$(readlink -f "$ROOT/env/active.env")" "$PRIVATE_BACKUP/active.env.copy"
    chmod 600 "$PRIVATE_BACKUP/active.link" "$PRIVATE_BACKUP/active.env.copy"
  fi
  systemctl cat exa-ati >"$PRIVATE_BACKUP/exa-ati.service.txt" 2>/dev/null || true
  chmod 600 "$PRIVATE_BACKUP/exa-ati.service.txt" 2>/dev/null || true

  if [[ ! -s "$PRIVATE_BACKUP/current.link" || ! -s "$PRIVATE_BACKUP/active.env.copy" ]]; then
    echo "Respaldo incompleto: falta estado nativo recuperable." >&2
    exit 1
  fi
  echo "backup=$PRIVATE_BACKUP"
}

set_release_sha_env() {
  local envf="$ROOT/env/production.env"
  if [[ ! -f "$envf" ]]; then
    echo "Falta production.env." >&2
    exit 1
  fi
  if ! grep -q '^EXA_ATI_RELEASE_SHA=' "$envf"; then
    echo "Falta EXA_ATI_RELEASE_SHA en production.env." >&2
    exit 1
  fi
  sed -i "s/^EXA_ATI_RELEASE_SHA=.*/EXA_ATI_RELEASE_SHA=$SHA/" "$envf"
  chmod 600 "$envf"
  chown exaati:psacln "$envf"
  if ! grep -q "^EXA_ATI_RELEASE_SHA=$SHA$" "$envf"; then
    echo "No se pudo fijar EXA_ATI_RELEASE_SHA." >&2
    exit 1
  fi
  if ! grep -q '^EXA_ATI_PRODUCTION_READY=true$' "$envf"; then
    echo "Compuerta EXA_ATI_PRODUCTION_READY no esta en true." >&2
    exit 1
  fi
}

write_approval() {
  local previous
  previous="$(basename "$(readlink -f "$ROOT/current")")"
  if [[ ! "$previous" =~ ^[a-f0-9]{40}$ ]]; then
    echo "previousSha invalido." >&2
    exit 1
  fi
  if [[ "$previous" == "$SHA" ]]; then
    echo "La release ya esta activa." >&2
    exit 1
  fi
  local expires
  expires="$(date -u -d '+6 hours' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v+6H +%Y-%m-%dT%H:%M:%SZ)"
  cat >"$APPROVAL" <<EOF
{
  "sha": "$SHA",
  "mode": "$MODE",
  "previousSha": "$previous",
  "backupReference": "$PRIVATE_BACKUP",
  "backupVerified": true,
  "rollbackCompatible": true,
  "productionGateVerified": true,
  "expiresAt": "$expires"
}
EOF
  chmod 600 "$APPROVAL"
}

drop_caches_if_needed() {
  local free_bytes
  free_bytes="$("$NODE" -e 'console.log(require("node:os").freemem())')"
  if [[ "$free_bytes" -lt $((3 * 1024 * 1024 * 1024)) ]]; then
    sync
    echo 3 >/proc/sys/vm/drop_caches || true
  fi
}

prepare_release
bootstrap_deploy_js
backup_current
set_release_sha_env
drop_caches_if_needed

echo "validate"
"$NODE" "$DEPLOY_JS" validate --mode "$MODE" --sha "$SHA"

echo "build"
"$NODE" "$DEPLOY_JS" build --mode "$MODE" --sha "$SHA"

# After clone, prefer the release copy for activate/status.
DEPLOY_JS="$RELEASE/scripts/deploy/deploy.mjs"
install -m 0755 "$RELEASE/scripts/deploy/from-gitlab.sh" "$BIN_DIR/from-gitlab.sh"
install -m 0644 "$RELEASE/scripts/deploy/deploy.mjs" "$BIN_DIR/deploy.mjs"

write_approval
echo "activate"
"$NODE" "$DEPLOY_JS" activate --mode "$MODE" --sha "$SHA" --approval "$APPROVAL"

echo "status"
"$NODE" "$DEPLOY_JS" status --mode "$MODE" --sha "$SHA"

echo "CI deploy TECHNICAL_CHECKS_OK sha=$SHA backup=$PRIVATE_BACKUP"
