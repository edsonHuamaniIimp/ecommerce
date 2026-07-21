# Arquitectura — ContratosStands

> **Estado:** BORRADOR v0.2 — refleja la implementación actual.
> **Relacionado:** `docs/requerimientos.md`, `docs/modelo-datos.md`, `docs/despliegue.md`.

## 1. Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router, Turbopack) | 16.2 |
| UI | React | 19.2 |
| Lenguaje | TypeScript | 5.x |
| Estilos | Tailwind CSS | v4 |
| Design System | `@nrivera-iimp/ui-kit-iimp` (shadcn/ui) | 0.1 |
| 3D | Three.js + `@react-three/fiber` + `@react-three/drei` | 0.185 |
| BD | PostgreSQL | 16 (Docker) |
| ORM | Prisma | v7.8 |
| Auth | JWT (`jose`) | — |
| Runtime | Node.js | 20+ |

## 2. Estructura del proyecto

```
src/
├── app/
│   ├── (public)/              ← Rutas públicas (plano, login)
│   │   ├── layout.tsx          ← Header público + VerticalSwitcher
│   │   ├── plano-isometrico/   ← Plano 3D interactivo
│   │   └── plano-grid/         ← Plano 2D (oculto del menú)
│   ├── (dashboard)/            ← Rutas protegidas (sidebar)
│   │   ├── layout.tsx          ← Sidebar
│   │   ├── dashboard/          ← KPIs + aprobaciones
│   │   ├── planogess/          ← Vista datos API planogess
│   │   ├── gess-mantenedor/    ← Importar + vincular stands
│   │   └── admin-roles/        ← Gestión de roles (admin)
│   ├── auth/login/             ← Página de login
│   ├── api/                    ← Route Handlers (REST)
│   │   ├── auth/login/         ← POST login JWT
│   │   ├── roles/usuarios/     ← CRUD usuarios por rol
│   │   ├── gess/               ← GET/PATCH stands vinculados
│   │   ├── gess/sync/          ← POST sincronizar API externo
│   │   └── planogess/          ← POST proxy KBEventos
│   ├── layout.tsx              ← Root layout + Providers + anti-flash vertical
│   └── globals.css             ← Tailwind v4 + UI Kit
├── components/
│   ├── plano/                  ← Isométrico 3D, grid 2D, planogess-view
│   ├── dashboard/              ← Sidebar, KPIs, aprobaciones
│   ├── layout/                 ← Header público
│   ├── evento/                 ← EventSelectionDialog
│   ├── gess/                   ← GessMantenedor (2 pasos)
│   └── admin/                  ← RolesMantenedor
├── lib/
│   ├── api/services/           ← Fachada (facade → mock/http)
│   ├── mappers/                ← DTO ↔ dominio (snake_case ↔ camelCase)
│   ├── auth.ts                 ← JWT (sign, verify, hasRole, hasPermission)
│   ├── db.ts                   ← PrismaClient (singleton, adapter pg)
│   ├── constants.ts            ← Fuente única (verticales, estados, roles)
│   └── bloques.ts              ← IDs de bloques del plano isométrico
├── contexts/
│   └── evento-context.tsx      ← EventoProvider + useEvento (persistencia)
├── types/
│   ├── dto/models.ts           ← DTOs (snake_case, forma exacta del backend)
│   └── reserva.ts              ← Modelos de dominio (camelCase)
└── middleware.ts               ← Protección de rutas por rol JWT
```

## 3. Patrones de arquitectura

### 3.1 Fachada de Servicios (`api-design-patterns`)

```
Componente → facade.ts → mock.ts (NEXT_PUBLIC_API_MOCK=1)  ← datos fake
                       → http.ts  (NEXT_PUBLIC_API_MOCK=0)  ← API real
```

Ningún componente hace `fetch` directo. Todo pasa por la fachada.

### 3.2 DTO + Mapper

```
Backend (snake_case) → DTO → Mapper → Dominio (camelCase) → Componente
```

DTOs en `src/types/dto/models.ts`, modelos en `src/types/reserva.ts`, mappers en `src/lib/mappers/`.

### 3.3 Autenticación y autorización

```
POST /api/auth/login → valida email en user_role → firma JWT → cookie httpOnly
middleware.ts → lee cookie → verifyToken → hasRole → permite/deniega
```

Roles: `admin`, `logistica`, `legal`, `comunicacion`. Permisos por rol en `ROLES_PERMISSIONS`.

### 3.4 Evento y vertical (multi-evento)

```
EventSelectionDialog (primer ingreso) → localStorage → EventoProvider
  → actualiza vertical CSS (anti-flash en <head>)
  → las páginas server leen getEventoActual() (mock → default Perumin)
```

### 3.5 Proxy a API externa (planogess)

```
POST /api/planogess → fetch server-side → https://secure2.iimp.org:8443/KBEventosPruebas/rest/planogess
  → extrae array recursivo → devuelve datos al cliente
```

SSL self-signed manejado con `NODE_TLS_REJECT_UNAUTHORIZED=0`.

### 3.6 Plano 3D interactivo

```
Three.js + R3F → Canvas con OrbitControls → 52 bloques desde buildItems()
  → multi-select (toggle) → sidebar "Mi selección"
  → modal reserva 3 pasos (Datos, Documentos, Confirmación)
  → vinculación GessStand (bloqueId) → muestra empresa/estado
  → bloques reservados en gris, no seleccionables para reserva
```

## 4. Base de datos

12 tablas PostgreSQL gestionadas con Prisma v7:

| Categoría | Tablas |
|---|---|
| Maestras | `evento_padre`, `evento`, `tipo_stand`, `contrato_plantilla`, `role` |
| Transaccionales | `stand`, `plano_posicion`, `gess_stand`, `reserva`, `reserva_stand`, `cuota`, `aprobacion`, `interop_facturacion`, `user_role` |
| Auditoría | `audit_log` |

## 5. Variables de entorno

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_APP_ENV` | `local` / `qa` / `production` |
| `NEXT_PUBLIC_API_MOCK` | `1` = mock, `0` = API real |
| `DATABASE_URL` | Connection string PostgreSQL |
| `PLANOGESS_API_URL` | URL del API externo KBEventos |
| `JWT_SECRET` | Clave de firma JWT (cambiar en producción) |
