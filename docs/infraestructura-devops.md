# Infraestructura, Docker y CI/CD — ContratosStands

> **Estado:** v1.1 — 2026-09-15
> **Fuente:** `Dockerfile`, `docker-compose*.yml`, `docker/`, `.github/workflows/deploy.yml`, `scripts/`, `.env*.example`.
>
> **Camino B (IaC objetivo):** la infraestructura AWS con Terraform (ECS Fargate + RDS + S3)
> vive en `terraform/` y está documentada en `docs/01-despliegue/` (arquitectura, reglas de
> despliegue R1-R6 y flujo MCP). Este documento describe el camino A (EC2 + Docker Compose, actual).

---

## 1. Variables de entorno

### 1.1 Desarrollo (`.env.example`)

| Variable | Propósito |
|---|---|
| `NEXT_PUBLIC_APP_ENV` | Ambiente activo (`local`, `qa`, `production`) — expuesto al cliente |
| `NEXT_PUBLIC_API_MOCK` | `1` = datos fake sin backend; `0` = API real |
| `NEXT_PUBLIC_API_URL` | URL base del backend cuando no hay mock |
| `DATABASE_URL` | Cadena de conexión PostgreSQL para Prisma |
| `PLANOGESS_API_URL` | Endpoint externo KBEventos — Plano GESS |
| `KBSERVICIOS_URL` | Endpoint externo KBServicios (eventos y tipos) |
| `JWT_SECRET` | Secreto de firma/validación de JWT |
| `RESEND_API_KEY` | API key de Resend (correos transaccionales) |
| `ADMIN_EMAIL` | Correo administrador / destino de notificaciones |
| `SUNAT_API_TOKEN` | Token para consultas RUC/DNI |
| `STORAGE_PROVIDER` | Backend de archivos: `local` (`public/uploads`) o `s3` |
| `S3_BUCKET` / `S3_REGION` / `S3_ENDPOINT` | Configuración del bucket S3 |

### 1.2 Producción (`.env.prod.example`)

| Variable | Propósito |
|---|---|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_APP_ENV` | `production` |
| `NEXT_PUBLIC_API_MOCK` | `0` |
| `APP_URL` | URL pública de la aplicación |
| `NEXT_PUBLIC_APP_URL` | URL pública que **lee el código** (links de correos, retorno Niubiz, reset password) — `https://ecommerce.sistemasiimp.org.pe` en prod |
| `DB_PASSWORD` | Password del contenedor PostgreSQL |
| `DATABASE_URL` | Conexión Prisma (host = servicio `postgres` del compose) |
| `PLANOGESS_API_URL` / `KBSERVICIOS_URL` | Endpoints de producción |
| `JWT_SECRET` | Secreto de producción (mín. 256 bits) |
| `STORAGE_PROVIDER` | `s3` en producción |
| `S3_BUCKET` / `S3_REGION` / `S3_ENDPOINT` | Bucket de archivos |
| `RUN_MIGRATIONS` | `true` fuerza `prisma migrate deploy` en cada arranque |

> **Adicionales no documentadas en los `.example`:** `NEXT_PUBLIC_API_DOMAIN` y `NEXT_PUBLIC_API_BASE_PATH` (destino del rewrite `/api/proxy/*` en `next.config.ts`).

> ⚠️ **Seguridad:** ninguna credencial real debe versionarse. Usar gestor de secretos y rotar las credenciales históricas antes de producción.

---

## 2. Docker

### 2.1 Imagen (`Dockerfile`)

- **Base:** `node:20-bookworm-slim` (una sola etapa).
- **El código NO se copia en la imagen**: en runtime se monta como volumen (evita rebuilds por cambios de código).
- Capas:
  1. Dependencias de sistema: `nginx`, `curl`, `ca-certificates`, `supervisor`.
  2. `npm ci --include=dev` (capa cacheable).
  3. `npx prisma generate` (capa cacheable).
  4. Configs: `docker/nginx.conf`, `docker/supervisord.conf`, `docker/entrypoint.sh`.
- `EXPOSE 80 443` · `HEALTHCHECK` con `curl -f http://localhost/health`.
- `ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]`.

### 2.2 Arranque (`docker/entrypoint.sh`)

1. Detecta primer deploy si no existe `.next/BUILD_ID`.
2. Si falta `node_modules/next`: `npm ci --include=dev`.
3. Espera PostgreSQL (hasta 30 intentos cada 2 s).
4. `npx prisma generate`.
5. Primer run o `RUN_MIGRATIONS=true`: `npx prisma migrate deploy`.
6. Primer run: `npm run build`.
7. `exec supervisord` → levanta **nginx + Next.js** (`next start -p 3000`).

### 2.3 Nginx (`docker/nginx.conf`)

- Puerto **80** → redirect 301 a HTTPS; puerto **443** con Let's Encrypt del dominio `ecommerce.sistemasiimp.org.pe` (TLS 1.2/1.3).
- `/health` → 200 "OK" (healthcheck).
- `/uploads/` → cache 30 días · `/_next/static` → cache 1 año `immutable`.
- `/` → proxy a `127.0.0.1:3000` (WebSocket upgrade, `X-Forwarded-*`, timeout 120 s, buffering off).
- `client_max_body_size 50M`; bloquea archivos ocultos salvo `.well-known`.

### 2.4 Docker Compose

**Desarrollo (`docker-compose.yml`)** — solo base de datos:

| Servicio | Imagen | Puertos | Volumen |
|---|---|---|---|
| `postgres` (`ctrst-db`) | `postgres:16-alpine` | `5433:5432` | `pgdata` |

**Producción (`docker-compose.prod.yml`)** — app + db:

| Servicio | Detalle |
|---|---|
| `postgres` (`ctrst-db-prod`) | `postgres:16-alpine`, sin puerto al host, volumen `pgdata_prod` |
| `app` (`ctrst-app`) | build `./Dockerfile` → `contratos-stands:latest`; puertos `80:80` y `443:443`; `env_file: .env.prod`; límites 2 CPU / 2G |

Volúmenes del servicio `app`:
- `.:/app` — código fuente del host (cambios sin rebuild).
- `/etc/letsencrypt:/etc/letsencrypt:ro` — certificados SSL.
- Volúmenes anónimos aíslan `/app/node_modules`, `/app/.next`, `/app/prisma/generated`.

---

## 3. CI/CD (`.github/workflows/deploy.yml`)

- **Triggers:** push a `main`, PR a `main`, `workflow_dispatch` (input `deploy`).
- **Concurrency:** grupo `deploy-contratos-stands` con `cancel-in-progress: true`.
- **Entorno:** Node 20, `AWS_DEFAULT_REGION=us-east-1`.

| Job | Depende de | Qué hace |
|---|---|---|
| `ci` | — | checkout, Node 20 + cache, `npm ci`, `prisma generate`, ESLint y `tsc --noEmit` (`continue-on-error`) |
| `build` | `ci` | `npm ci` + `prisma generate` + `npm run build`; sube artefacto `build-assets` (retención 7 días) |
| `deploy` | `ci` | Vía SSH a EC2: `git pull`, rebuild Docker solo si cambió `Dockerfile`/`package*.json`, `docker compose up -d`, `prisma migrate deploy` |
| `sync-s3` | `build` | `aws s3 sync .next/static/ s3://<bucket>/_next/static/ --delete --cache-control max-age=31536000,immutable` |

**Secrets requeridos:** `EC2_HOST`, `EC2_USERNAME`, `EC2_SSH_KEY`, `EC2_PORT`, `EC2_APP_PATH`, `EC2_GIT_TOKEN`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET`, `AWS_DEFAULT_REGION`.

> **Nota:** `ci`, `deploy` y `sync-s3` usan `continue-on-error: true` en pasos clave; se recomienda al proveedor endurecer el pipeline (fallar el build si lint/typecheck fallan).

---

## 4. Scripts de operación

### 4.1 `scripts/deploy.sh` (deploy manual en la EC2)

```bash
bash scripts/deploy.sh [--no-migrate] [--no-build]
```

1. `git pull origin main`
2. `npm ci --include=dev`
3. `npx prisma generate`
4. `npm run build` (omitible)
5. `npx prisma migrate deploy` (omitible)
6. Rebuild Docker `--no-cache` solo si cambiaron `Dockerfile`/`package*.json`
7. `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d`

### 4.2 `scripts/s3-setup.sh`

```bash
bash scripts/s3-setup.sh <bucket-name> [region]
```

1. Crea el bucket · 2. Bloquea acceso público · 3. Política que exige HTTPS ·
4. Etiquetas (`Proyecto=ContratosStands`, `Entorno=Produccion`) · 5. CORS ·
6. Imprime los valores para `.env.prod` y los secrets de GitHub.

---

## 5. Observabilidad y operación

- **Healthcheck:** `GET /health` (nginx, sin auth).
- **Logs:** nginx y Next.js a stdout/stderr del contenedor (capturados por Docker).
- **Auditoría de aplicación:** tabla `audit_log` (acciones clave) y endpoint `POST /api/errors/log` (errores con contexto).
- **Backups:** pendiente de configurar backup automático de PostgreSQL (requisito de producción documentado en `docs/despliegue.md`).

---

## 6. Recomendaciones para el proveedor

1. **Rotar secretos** (`JWT_SECRET`, API keys, passwords) antes de asumir producción.
2. **Endurecer CI**: quitar `continue-on-error` de lint/typecheck; agregar job de tests cuando existan.
3. **Configurar backups automáticos** de PostgreSQL y probar restauración.
4. **Definir gestor de secretos** (AWS Secrets Manager / SSM) en lugar de archivos `.env` planos.
5. **Revisar el modelo de deploy** (código montado como volumen) — evaluar imagen inmutable con `output: "standalone"`.
6. **Monitoreo**: agregar alertas sobre `/health` y errores 5xx.
