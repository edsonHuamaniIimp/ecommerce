#!/bin/bash
# ─── Entrypoint — ContratosStands Docker ──────────────────────────────────
set -e

echo "🚀  ContratosStands — Iniciando..."

# ─── Setup de primer deploy ──────────────────────────────────────────────
FIRST_RUN=false
if [ ! -d ".next" ] || [ ! -f ".next/BUILD_ID" ]; then
    FIRST_RUN=true
fi

# ─── Asegurar node_modules ───────────────────────────────────────────────
if [ ! -d "node_modules/next" ]; then
    echo "📦  Instalando dependencias JS..."
    npm ci --include=dev
    FIRST_RUN=true
fi

# ─── Esperar PostgreSQL ──────────────────────────────────────────────────
if [ -n "${DATABASE_URL}" ]; then
    echo "⏳  Esperando PostgreSQL..."
    for i in $(seq 1 30); do
        if npx prisma db push --skip-generate 2>/dev/null; then
            echo "✅  PostgreSQL listo."
            break
        fi
        sleep 2
    done
fi

# ─── Prisma: generar cliente y correr migraciones ────────────────────────
echo "🔨  Generando Prisma Client..."
npx prisma generate

if [ "$FIRST_RUN" = true ] || [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "🗄️   Ejecutando migraciones..."
    npx prisma migrate deploy || echo "⚠️  migrate deploy fallo (posiblemente primera ejecucion)"
fi

# ─── Primer deploy: build completo ──────────────────────────────────────
if [ "$FIRST_RUN" = true ]; then
    echo "📦  Build Next.js..."
    npm run build
fi

echo "✅  Listo. Iniciando servicios..."

# ─── Iniciar Supervisor (nginx + Next.js) ─────────────────────────────────
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
