#!/bin/bash
# Entrypoint ECS — ContratosStands (Next.js standalone)
set -e

echo "[entrypoint] ContratosStands ECS - iniciando..."

# Tareas one-off de mantenimiento: si se pasa un comando, se ejecuta y termina
# (no arranca la app). Ejemplo:
#   aws ecs run-task ... --overrides '{"containerOverrides":[{"name":"app",
#     "command":["npx","prisma","migrate","resolve","--rolled-back","0002_add_revision_table"]}]}'
if [ "$#" -gt 0 ]; then
    echo "[entrypoint] Comando puntual: $*"
    exec "$@"
fi

# Aplica migraciones versionadas con reintentos. NUNCA recrea ni borra la base:
# prohibido `migrate reset --force` / `db push --force-reset` / `--accept-data-loss`.
# Si las migraciones no se pueden aplicar, se ABORTA el arranque (ECS conserva la
# tarea anterior por el circuit breaker); jamás se destruyen datos automáticamente.
if [ -n "${DATABASE_URL}" ]; then
    echo "[entrypoint] Esperando PostgreSQL y aplicando migraciones..."
    MIGRATE_CMD="node node_modules/prisma/build/index.js migrate deploy"
    if [ ! -f "node_modules/prisma/build/index.js" ]; then
        MIGRATE_CMD="npx prisma migrate deploy"
    fi

    MIGRADO="false"
    for i in $(seq 1 30); do
        if $MIGRATE_CMD; then
            echo "[entrypoint] Migraciones aplicadas."
            MIGRADO="true"
            break
        fi
        echo "[entrypoint] DB no lista o migracion fallida (intento $i/30)..."
        sleep 2
    done

    if [ "$MIGRADO" != "true" ]; then
        echo "[entrypoint] ERROR: no se pudieron aplicar las migraciones tras 30 intentos."
        echo "[entrypoint] Se aborta el arranque SIN tocar los datos. Revisar la migracion manualmente."
        exit 1
    fi

    # Poblado inicial OPCIONAL y controlado (seed idempotente con upsert).
    # Solo se ejecuta si RUN_SEED=true (nunca en prod por defecto).
    # Usa seed-auth.ts (roles + usuarios) porque es autocontenido: la imagen ECS
    # standalone NO copia src/, y seed.ts depende de src/.
    if [ "${RUN_SEED}" = "true" ]; then
        echo "[entrypoint] RUN_SEED=true -> poblando roles + usuarios (seed-auth)..."
        SEED_ALLOW_PROD=1 npx tsx prisma/seed-auth.ts
        echo "[entrypoint] Seed auth aplicado."
    fi
fi

# Seed de assets estaticos al volumen EFS (public/uploads en prod). La imagen
# commiteada queda tapada por el mount de EFS, por lo que se copia al volumen
# si aun no existe. Idempotente y NO bloqueante: un fallo aqui no debe tumbar
# el arranque de la app.
if [ -f /app/seed-assets/perumin-mapa-pabellones.jpg ]; then
    mkdir -p /app/public/uploads || true
    if [ ! -f /app/public/uploads/perumin-mapa-pabellones.jpg ]; then
        cp /app/seed-assets/perumin-mapa-pabellones.jpg /app/public/uploads/ 2>/dev/null \
            && echo "[entrypoint] Imagen del macro copiada al volumen (uploads)." \
            || echo "[entrypoint] AVISO: no se pudo copiar la imagen del macro al volumen."
    fi
fi

echo "[entrypoint] Iniciando Next.js standalone..."
exec node server.js
