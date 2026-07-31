#!/usr/bin/env bash
# ─── Deploy manual — Proyecto ContratosStands ─────────────────────────────
# Uso: bash scripts/deploy.sh [--no-migrate] [--no-build]
#
# Ejecutar DENTRO del servidor EC2, en el directorio de la app.
# Ejemplo: cd /var/www/contratos-stands && bash scripts/deploy.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/contratos-stands}"
NO_MIGRATE=false
NO_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --no-migrate) NO_MIGRATE=true ;;
    --no-build)   NO_BUILD=true ;;
  esac
done

echo "🚀  Iniciando deploy en: $APP_DIR"
cd "$APP_DIR"

# ─── 1. Git pull ──────────────────────────────────────────────────────────
echo "📥  git pull origin main ..."
git pull origin main

# ─── 2. Dependencias JS ──────────────────────────────────────────────────
echo "📦  npm ci ..."
npm ci --include=dev

# ─── 3. Prisma Client ────────────────────────────────────────────────────
echo "🔨  npx prisma generate ..."
npx prisma generate

# ─── 4. Build Next.js ────────────────────────────────────────────────────
if [ "$NO_BUILD" = false ]; then
  echo "📦  npm run build ..."
  npm run build
fi

# ─── 5. Migraciones Prisma ───────────────────────────────────────────────
if [ "$NO_MIGRATE" = false ]; then
  echo "🗄️   Ejecutando migraciones..."
  npx prisma migrate deploy
fi

# ─── 6. Reiniciar Docker ─────────────────────────────────────────────────
echo "🐳  Reiniciando contenedores..."

# Detectar si hay cambios en dependencias base para rebuild
BEFORE=$(git rev-parse HEAD@\{1\} 2>/dev/null || echo "")
if [ -n "$BEFORE" ]; then
  CHANGED=$(git diff --name-only "$BEFORE" HEAD -- Dockerfile package.json package-lock.json 2>/dev/null || echo "")
  if [ -n "$CHANGED" ]; then
    echo "📦  Cambios en dependencias base, rebuild..."
    docker compose --env-file .env.prod -f docker-compose.prod.yml build --no-cache
  fi
fi

docker compose --env-file .env.prod -f docker-compose.prod.yml up -d

echo ""
echo "✅  Deploy completado."
