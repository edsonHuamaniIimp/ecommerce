# Checklist de producción — Integración SGC

> Deploy automático: **push a `main`** dispara `.github/workflows/deploy.yml`
> (`ci` → `build` → `deploy` EC2 → `sync-s3`). El job de deploy solo despliega si
> existen los secrets `EC2_*`; si falta `EC2_HOST`, se salta.

## 1. Secrets de GitHub (Settings → Secrets and variables → Actions)

| Secret | Para | Obligatorio |
|---|---|---|
| `EC2_HOST` | host del servidor de deploy | Sí (si falta, el deploy se salta) |
| `EC2_USERNAME` | usuario SSH | Sí |
| `EC2_SSH_KEY` | llave privada SSH | Sí |
| `EC2_GIT_TOKEN` | token de GitHub para `git pull` en el server (`repo` read) | Sí |
| `EC2_PORT` | puerto SSH | No (default 22) |
| `EC2_APP_PATH` | ruta del repo en el server | No (default `/var/www/contratos-stands`) |
| `AWS_BUCKET` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | sync de assets a S3 | Sí (si falta, se salta) |
| `AWS_DEFAULT_REGION` | región S3 | No (default `us-east-1`) |
| `SGC_RECONCILE_URL` | URL del cron (`https://ecommerce.sistemasiimp.org.pe/api/cron/sgc-reconciliar`) | Sí (cron) |
| `SGC_CRON_SECRET` | valor de `CRON_SECRET` para el header `x-cron-secret` | Sí (cron) |
| `SEED_ON_DEPLOY` | `1` = ejecutar el seed idempotente en cada deploy | No |

> El remoto del server apunta a `https://github.com/edsonHuamaniIimp/ecommerce.git` y el
> token se pasa efímero (no se persiste en `.git/config`).

## 2. Variables del servidor (`.env.prod`, usado por `docker-compose.prod.yml`)

Base: copiar `.env.prod.example` → `.env.prod`. Además del bloque existente
(DB, JWT, planogess, storage, etc.), configurar la integración SGC:

| Variable | Valor |
|---|---|
| `SGC_ENABLED` | `1` |
| `SGC_MODE` | `real` |
| `SGC_API_URL` | base del SGC (lo da el equipo del SGC), ej. `https://<host-sgc>/api/integrations/v1` |
| `SGC_API_KEY` | `sgc_<clave>` del actor con rol `contract-manager` |
| `SGC_AREA_CODE` | catálogo del SGC (ej. `EVENTOS`) |
| `SGC_CONTRACT_TYPE_CODE` | catálogo del SGC (ej. `AUSPICIO`) |
| `SGC_WEBHOOK_SECRET` | secreto HMAC de la suscripción de webhooks |
| `CRON_SECRET` | mismo valor que el secret `SGC_CRON_SECRET` de GitHub |
| `SGC_TIMEOUT_MS` | `10000` (opcional) |

## 3. Webhooks

- El SGC **no** entrega a `localhost`/IP privada. Registrar en el SGC la URL:
  `https://ecommerce.sistemasiimp.org.pe/api/integracion/sgc/webhook`
  y pedir que el host esté en su **lista blanca**.
- Guardar el `SGC_WEBHOOK_SECRET` que entregue el SGC (una sola vez) en `.env.prod`.
- Mientras no haya webhooks, el **cron de reconciliación** cubre el estado (polling).

## 3.1 Seed (usuarios/roles)

El seed es **idempotente** (upsert de roles + usuarios). En producción está **bloqueado por
defecto** (`NEXT_PUBLIC_APP_ENV=production` y `SEED_ALLOW_PROD != 1`). Para sembrar:

- **Automático en deploy**: definir el secret `SEED_ON_DEPLOY=1` (corre en cada deploy), o
- **Automático en el primer arranque**: `SEED_ALLOW_PROD=1` en `.env.prod` (el entrypoint
  siembra solo cuando es el primer run), o
- **Manual**:
  ```bash
  docker exec -e SEED_ALLOW_PROD=1 ctrst-app npm run db:seed
  ```

> El seed crea usuarios de prueba (`admin@iimp.org.pe` / `admin123`, etc.). En producción
> **cambia la contraseña** del admin (o crea tu usuario real) y no dejes los usuarios de prueba.

## 4. Verificación post-deploy

```bash
# En el servidor
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
docker exec ctrst-app npx prisma migrate deploy      # aplica sgc_* (también corre en el deploy)
docker exec ctrst-postgres psql -U ctrst -d contratos_stands -c "\dt" | grep sgc_
curl -fsS https://ecommerce.sistemasiimp.org.pe/api/health

# Cron (desde cualquier host)
curl -fsS -X POST https://ecommerce.sistemasiimp.org.pe/api/cron/sgc-reconciliar \
  -H "x-cron-secret: <CRON_SECRET>"
```

Smoke test funcional:
1. En `/dashboard/solicitudes`, aprobar **Logística** y **Comunicación** de una solicitud de prueba.
2. Verificar que se crea el expediente (panel "Revisión Legal (SGC)" → `ID SGC`).
3. Enviar contrato (doc del admin) y anexos (docs del cliente).
4. Esperar webhooks (o verificar con `POST /api/cron/sgc-reconciliar`).
5. "Generar orden de pago" se habilita solo cuando el SGC apruebe (contrato **Vigente**).
6. Descargar el contrato firmado desde el panel.

## 5. Rollback

- Revertir el commit en `main` (o `workflow_dispatch` con `deploy=true` de un commit previo).
- `SGC_ENABLED=0` apaga la integración sin tocar el resto del sistema.
