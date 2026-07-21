# Despliegue — ContratosStands

> **Estado:** BORRADOR v0.2.

## 1. Requisitos previos

- Node.js 20+
- Docker (para PostgreSQL local)
- Git

## 2. Ambiente local (desarrollo)

### 2.1 Primer setup

```bash
git clone <repo>
cd ContratosStands
cp .env.example .env
npm install
```

### 2.2 Base de datos

```bash
docker compose up -d        # PostgreSQL 16 en localhost:5432
npm run db:push              # Crear/actualizar tablas
npm run db:seed              # Datos iniciales (eventos, roles, tipos stand)
```

### 2.3 Variables en `.env`

```env
NEXT_PUBLIC_APP_ENV=local
NEXT_PUBLIC_API_MOCK=1
DATABASE_URL="postgresql://ctrst:ctrst_dev@localhost:5432/contratos_stands"
PLANOGESS_API_URL="https://secure2.iimp.org:8443/KBEventosPruebas/rest/planogess"
JWT_SECRET="dev-secret-cambiar-en-produccion"
```

### 2.4 Ejecutar

```bash
npm run dev                 # http://localhost:3000
npx prisma studio           # Explorador de BD en http://localhost:5555
```

### 2.5 Comandos útiles

```bash
npm run db:push             # Sincronizar schema → BD (sin migrations)
npm run db:seed             # Poblar datos iniciales
npm run db:studio           # Prisma Studio
npx prisma generate         # Regenerar cliente Prisma
npx tsc --noEmit            # Verificar types
```

## 3. Ambiente QA

### 3.1 Configuración

```env
NEXT_PUBLIC_APP_ENV=qa
NEXT_PUBLIC_API_MOCK=0
DATABASE_URL="postgresql://<usuario>:<password>@<host-qa>:5432/contratos_stands_qa"
PLANOGESS_API_URL="https://secure2.iimp.org:8443/KBEventosPruebas/rest/planogess"
JWT_SECRET="<clave-segura-qa>"
```

### 3.2 Despliegue

```bash
npm ci
npx prisma generate
npx prisma migrate deploy    # Aplica migraciones pendientes
npm run build
npm start
```

## 4. Ambiente producción

### 4.1 Configuración

```env
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_API_MOCK=0
DATABASE_URL="postgresql://<usuario>:<password>@<host-prod>:5432/contratos_stands"
PLANOGESS_API_URL="https://secure2.iimp.org:8443/KBEventos/rest/planogess"
JWT_SECRET="<clave-segura-produccion>"
```

### 4.2 Requisitos adicionales

- `JWT_SECRET`: mínimo 256 bits, generado con `openssl rand -base64 32`
- `DATABASE_URL`: usar pool de conexiones (PgBouncer o similar)
- HTTPS obligatorio (las cookies JWT usan `secure: true`)
- Logs de auditoría (`audit_log`) habilitados
- Backup automático de PostgreSQL configurado

### 4.3 Despliegue

```bash
npm ci --production
npx prisma generate
npx prisma migrate deploy
npm run build
npm start
```

## 5. Asignación de roles (primer admin)

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

## 6. Verificación post-deploy

- [ ] `GET /api/gess?eventoId=...` responde 200
- [ ] `POST /api/auth/login` con email válido retorna JWT
- [ ] `/dashboard` redirige a `/auth/login` sin cookie
- [ ] `/plano-isometrico` carga el Canvas 3D
- [ ] `docker compose ps` muestra PostgreSQL healthy
