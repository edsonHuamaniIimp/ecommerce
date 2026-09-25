# Despliegue — ContratosStands

> Configuración de despliegue adaptada de `montaje-iimp/docs/01-despliegue`.
> Dos caminos soportados:
> - **A) EC2 + Docker Compose** (actual, en producción): `docker-compose.prod.yml` + `scripts/deploy.sh`.
> - **B) AWS ECS Fargate + RDS + S3** (objetivo, IaC): `terraform/` + `Dockerfile.ecs`.
> Reglas de gobernanza: `docs/02-despliegue/REGLAS-DESPLIEGUE.md`.
>
> Este documento unifica el antiguo borrador `docs/despliegue.md` (v0.2): la lista de
> variables por ambiente, las rutas por rol y la verificación post-deploy se incorporaron aquí.

## 1. Requisitos previos

- Node.js 20+
- Docker y Docker Compose
- Git
- (Camino B) Terraform >= 1.8 y AWS CLI con perfil configurado

## 2. Ambiente local (desarrollo)

### 2.1 Primer setup

```bash
git clone <repo>
cd ContratosStands
cp .env.example .env
npm install
```

### 2.2 Base de datos (PostgreSQL en Docker)

```bash
docker compose up -d          # PostgreSQL 16 en localhost:5433
npx prisma migrate deploy     # Aplicar migraciones versionadas (crea tablas)
npx prisma generate           # Generar cliente Prisma
npm run db:seed               # Datos iniciales (eventos, roles, tipos stand)
```

> **Regla de BD (sin deuda técnica)**: TODO cambio de schema se hace con **migraciones versionadas** (`npx prisma migrate dev --name <descripcion>`), nunca con `db push` en un equipo compartido/producción. Producción/QA se construyen con `prisma migrate deploy`.
>
> **El CI lo verifica**: el job `ci` corre `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code` sobre un Postgres efímero. Si hay drift (schema sin migración), CI falla y `deploy-ecs` queda **bloqueado** (`needs: [build-image, ci]`). Así ningún cambio de schema llega a prod sin su migración.

### 2.3 Ejecutar

```bash
npm run dev                    # http://localhost:3001
npx prisma studio              # Explorador de BD en http://localhost:5555
```

### 2.4 Comandos útiles

```bash
docker compose up -d            # Iniciar PostgreSQL
docker compose down             # Detener PostgreSQL
docker compose logs -f          # Ver logs de PostgreSQL
npm run db:seed                 # Poblar datos iniciales
npx prisma migrate dev          # Crear migracion versionada desde cambios en schema (--name <descripcion>)
npx prisma migrate deploy       # Aplicar migraciones pendientes (produccion/CI)
npx prisma migrate status       # Verificar estado de migraciones vs. BD
npx prisma generate             # Regenerar cliente Prisma
npx tsc --noEmit                # Verificar types
npm run build                   # Build de produccion
```

## 3. Variables de entorno por ambiente

La lista completa y comentada vive en `.env.example`. En QA/producción se usa un archivo
propio (`env` del camino A o `terraform.tfvars` + Secrets Manager del camino B).

### 3.1 Local (`.env`)

```env
NEXT_PUBLIC_APP_ENV=local
NEXT_PUBLIC_API_MOCK=1
DATABASE_URL="postgresql://ctrst:ctrst_dev@localhost:5433/contratos_stands"
PLANOGESS_API_URL="https://secure2.iimp.org:8443/KBEventosPruebas/rest/planogess"
JWT_SECRET="dev-secret-cambiar-en-produccion"
```

> `docker compose` publica PostgreSQL en `localhost:5433` (mapeo `5433:5432`). Si tu
> `.env` apunta a `5432`, ajústalo para no chocar con un PostgreSQL local.

### 3.2 QA

```env
NEXT_PUBLIC_APP_ENV=qa
NEXT_PUBLIC_API_MOCK=0
DATABASE_URL="postgresql://<usuario>:<password>@<host-qa>:5432/contratos_stands_qa"
PLANOGESS_API_URL="https://secure2.iimp.org:8443/KBEventosPruebas/rest/planogess"
JWT_SECRET="<clave-segura-qa>"
```

### 3.3 Producción

```env
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_API_MOCK=0
DATABASE_URL="postgresql://<usuario>:<password>@<host-prod>:5432/contratos_stands"
PLANOGESS_API_URL="https://secure2.iimp.org:8443/KBEventos/rest/planogess"
JWT_SECRET="<clave-segura-produccion>"
```

### 3.4 Requisitos adicionales de producción

- `JWT_SECRET`: mínimo 256 bits, generado con `openssl rand -base64 32`.
- `DATABASE_URL`: usar pool de conexiones (PgBouncer o similar).
- HTTPS obligatorio (las cookies JWT usan `secure: true`).
- Logs de auditoría (`audit_log`) habilitados.
- Backup automático de PostgreSQL configurado (**pendiente**; requisito de producción).

## 4. Cuentas de prueba (seed)

Al ejecutar `npm run db:seed`:

| Email | Rol | Contraseña |
|---|---|---|
| `admin@iimp.org.pe` | admin | `admin123` |
| `logistica@iimp.org.pe` | logistica | `logistica123` |
| `legal@iimp.org.pe` | legal | `legal123` |
| `comunicacion@iimp.org.pe` | comunicacion | `comunicacion123` |
| `cliente@iimp.org.pe` | cliente | `cliente123` |

> **Nota por ambiente:**
> - **Local**: el seed corre con `npm run db:seed` (idempotente, `upsert`).
> - **QA / Producción**: la base de datos es **persistente**. El `docker/entrypoint-ecs.sh` solo ejecuta `prisma migrate deploy`; si una migración falla, el arranque **aborta** (ECS conserva la tarea anterior) y **NUNCA** se recrea la BD (`migrate reset` está prohibido). Las cuentas de prueba **no** se crean automáticamente en QA/prod; si se necesitan en QA, se ejecuta `npm run db:seed` de forma manual y controlada.

### 4.1 Rutas por rol

| Ruta | admin | logistica | legal | comunicacion | cliente | público |
|---|---|---|---|---|---|---|
| `/plano` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `/dashboard/solicitudes` | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `/dashboard/roles` | ✓ | | | | | |
| `/dashboard/eventos` | ✓ | | | | | |
| `/auth/login` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### 4.2 Asignación manual de roles

Después del primer deploy, poblar la BD con los roles seed:

```bash
npm run db:seed
```

Luego asignar el primer admin desde el mantenedor (`/admin-roles`) o directamente:

```sql
INSERT INTO user_role (id, user_id, role_id, email)
SELECT gen_random_uuid(), 'user|admin@iimp.org.pe', r.id, 'admin@iimp.org.pe'
FROM role r WHERE r.nombre = 'admin';
```

## 5. Camino A — Producción actual (EC2 + Docker Compose)

### 5.1 Configuración

```bash
cp .env.prod.example .env.prod
# Editar .env.prod con valores reales:
#   - DB_PASSWORD: contraseña segura para PostgreSQL
#   - JWT_SECRET: openssl rand -base64 32
#   - S3_BUCKET: bucket de archivos
```

### 5.2 Requisitos del servidor

- Docker y Docker Compose instalados
- Certificados SSL en `/etc/letsencrypt/live/ecommerce.sistemasiimp.org.pe/`
- Puerto 80 y 443 accesibles
- Al menos 2GB RAM, 2 CPUs

### 5.3 Despliegue inicial

```bash
git clone <repo> /opt/contratos-stands
cd /opt/contratos-stands
cp .env.prod.example .env.prod
# Editar .env.prod con credenciales reales

docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

### 5.4 Actualizar código

```bash
cd /opt/contratos-stands
bash scripts/deploy.sh            # git pull + build + migrate deploy + up -d
```

### 5.5 Ver logs

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

## 6. Camino B — AWS ECS Fargate (objetivo, con Terraform)

> Decisión de arquitectura completa: `docs/02-despliegue/arquitectura-aws.md`.
> Detalle Terraform/MCP: `docs/02-despliegue/aws-terraform.md`.

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # ajustar environment=qa|prod
export AWS_PROFILE="sistemas-aws"              # R4 — ver REGLAS-DESPLIEGUE.md

terraform init
terraform plan  -var-file="terraform.tfvars"   # revisar: SOLO recursos project=contratos-stands
terraform apply -var-file="terraform.tfvars"   # R1: prod SOLO con autorización
```

**Imagen**: `Dockerfile.ecs` (multi-stage, `output: "standalone"` en `next.config.ts`,
entrypoint con `prisma migrate deploy` antes de `node server.js`).

**Migración de BD**: automática en el entrypoint del contenedor (antes de `next start`).

## 7. Estructura Docker

```
├── docker-compose.yml           # Dev: solo PostgreSQL
├── docker-compose.prod.yml      # Prod actual (EC2): PostgreSQL + app (Nginx + Next.js)
├── Dockerfile                   # EC2: Node 20 + Nginx + Supervisor (código montado)
├── Dockerfile.ecs               # ECS: Node 20 multi-stage standalone (imagen inmutable)
└── docker/
    ├── entrypoint.sh            # EC2: espera DB, migra, build, inicia supervisord
    ├── entrypoint-ecs.sh        # ECS: migrate deploy (aborta si falla) + next standalone
    ├── nginx.conf               # Reverse proxy HTTPS → Next.js :3000 (solo EC2)
    └── supervisord.conf         # Gestiona Nginx + Next.js como servicios (solo EC2)
```

## 8. Verificación post-deploy

- [ ] `GET /api/gess?eventoId=...` responde 200
- [ ] `POST /api/auth/login` con email válido retorna JWT
- [ ] `/dashboard` redirige a `/auth/login` sin cookie
- [ ] `/plano` carga el Canvas 3D
- [ ] `docker compose ps` muestra PostgreSQL healthy

## 9. Resolución de problemas

### PostgreSQL no arranca (local)

```bash
docker compose down -v     # Elimina volumen (DATOS!)
docker compose up -d       # Recrea desde cero
```

### Error P1001 (no alcanza DB)

```bash
docker compose ps
npx prisma migrate status
npx prisma migrate deploy
```

> **PROHIBIDO**: `prisma db push --force-reset` / `prisma migrate reset` sobre bases con datos
> (local compartido, QA o producción). Recrean/borran la base. La BD es persistente y solo
> evoluciona con migraciones versionadas.

### Cambios en schema no se reflejan

```bash
npx prisma generate              # Regenerar cliente
npx prisma migrate dev --name <descripcion>   # Crear migracion versionada y aplicarla
npx prisma migrate status        # Confirmar que BD y migraciones estan al dia
```
