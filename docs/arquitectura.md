# Arquitectura — ContratosStands

> **Estado:** v0.3 — refleja la implementación con arquitectura hexagonal.
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

---

## 2. Backend — Arquitectura Hexagonal (Ports & Adapters)

### 2.1 Principio

El dominio (reglas de negocio) es independiente de cualquier framework, base de datos o protocolo HTTP. Las dependencias apuntan hacia adentro: `infrastructure → application → domain`.

```
┌─────────────────────────────────────────────────────────┐
│                   API Routes (HTTP)                      │
│  src/app/api/**/route.ts                                 │
│  Solo parsean request/response, delegan a application    │
└───────────────────────┬─────────────────────────────────┘
                        │ depende de
┌───────────────────────▼─────────────────────────────────┐
│              Application (Casos de Uso)                  │
│  src/application/                                        │
│  Orquestan la lógica de negocio usando puertos           │
└───────────────────────┬─────────────────────────────────┘
                        │ depende de
┌───────────────────────▼─────────────────────────────────┐
│              Domain (Núcleo puro)                        │
│  src/domain/                                             │
│  Entidades + Puertos (interfaces) — CERO dependencias    │
└───────────────────────▲─────────────────────────────────┘
                        │ implementa
┌───────────────────────┴─────────────────────────────────┐
│         Infrastructure (Adaptadores)                     │
│  src/infrastructure/                                     │
│  Prisma repositories, JWT service                        │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Estructura de directorios

```
src/
├── domain/                         ← Núcleo (sin dependencias externas)
│   ├── models/entities.ts          ← Entidades de dominio puras
│   └── ports/                      ← Interfaces (contratos)
│       ├── evento-repository.ts
│       ├── gess-repository.ts
│       └── role-repository.ts
│
├── application/                    ← Casos de uso
│   └── eventos/evento-service.ts   ← Lógica de negocio de eventos
│
├── infrastructure/                 ← Adaptadores concretos
│   └── persistence/                ← Prisma ORM
│       ├── evento-repository.ts
│       ├── gess-repository.ts
│       └── role-repository.ts
│
├── lib/
│   ├── services.ts                 ← DI container (wiring)
│   ├── auth.ts                     ← JWT (sign/verify/hasRole)
│   ├── db.ts                       ← PrismaClient singleton
│   ├── constants.ts                ← Fuente única de constantes
│   └── utils/date.ts               ← dateUtils (singleton)
│
└── app/api/                        ← Route handlers (HTTP)
    ├── eventos/route.ts            ← GET/POST/PATCH → services.eventos
    ├── eventos/presala/route.ts    ← GET → services.eventos
    ├── auth/                       ← login, logout, session, seleccionar-evento
    ├── gess/                       ← GET/PATCH stands
    ├── gess/sync/                  ← POST sincronizar
    └── roles/                      ← CRUD roles y usuarios
```

### 2.3 Patrones

**Ports & Adapters:** El dominio define interfaces (`IEventoRepository`). La infraestructura las implementa (`EventoPrismaRepository`). La aplicación usa las interfaces sin conocer Prisma.

**Dependency Injection:** `src/lib/services.ts` instancia los repositorios y servicios, inyectándolos manualmente (sin contenedor pesado).

**DTO (Data Transfer Object):** Las API routes reciben/retornan DTOs en `src/types/dto/`. Cada DTO en su propio archivo siguiendo SOLID (Single Responsibility):

```
src/types/dto/
├── auth/          ← login-request, login-response, session, seleccionar-evento
├── eventos/       ← presala, create-evento-request
├── gess/          ← gess-stand, sync-result
└── models.ts      ← re-exports (compatibilidad)
```

**Mapper:** `src/lib/mappers/gess-mapper.ts` convierte GessStandDTO (snake_case) a GessStandDomain (camelCase) para uso en la UI.

---

## 3. Frontend — Arquitectura

### 3.1 Estructura

```
src/
├── app/
│   ├── (public)/                  ← Rutas públicas
│   │   ├── layout.tsx             ← Header + VerticalSwitcher
│   │   ├── page.tsx               ← Home (presala pública)
│   │   └── plano-isometrico/      ← Plano 3D interactivo
│   ├── (dashboard)/               ← Rutas protegidas (login requerido)
│   │   ├── layout.tsx             ← Sidebar + DashboardHeader
│   │   └── dashboard/             ← KPIs, planogess, gess, roles, eventos
│   ├── auth/login/                ← Login page
│   └── presala/                   ← Post-login event version selector
│
├── components/
│   ├── dashboard/                 ← Sidebar, DashboardHeader, StatsCard, Aprobaciones
│   ├── plano/                     ← PlanoIsometrico (3D), GessMantenedor
│   ├── admin/                     ← RolesMantenedor, EventosMantenedor
│   ├── gess/                      ← GessMantenedor
│   └── layout/                    ← Header (público)
│
├── lib/api/services/              ← Client services (nunca fetch directo)
│   ├── internal-api.ts            ← Fetch wrapper tipado
│   ├── auth-service.ts
│   ├── eventos-service.ts
│   ├── gess-service.ts
│   └── roles-service.ts
│
└── contexts/evento-context.tsx    ← EventoProvider
```

### 3.2 Patrones frontend

**Service Pattern:** Ningún componente hace `fetch()` directo. Todos usan servicios tipados de `src/lib/api/services/`.

```
Componente → authService.login() → internalApi.post() → fetch()
```

**DTO + Mapper:** El backend retorna snake_case. El mapper convierte a camelCase para la UI.

```
API response (snake_case) → GessStandDTO → mapGessStandFromDTO() → GessStandDomain (camelCase) → Component
```

**Singleton Utilities:** `dateUtils` en `src/lib/utils/date.ts` centraliza formato de fechas. Prohibido duplicar lógica de formato en componentes.

**Constants First:** Validaciones, estados, roles y permisos siempre desde `src/lib/constants.ts`. Nunca strings hardcodeados.

---

## 4. Flujo de autenticación y eventos

```
1. Público: / → grid de eventos → clic versión → localStorage guarda eventId → /auth/login
2. Login: POST /api/auth/login → valida email en user_role → firma JWT → cookie httpOnly
3. Presala: /presala → lee evento pendiente → auto-selecciona → JWT se re-firma con eventoId
4. Dashboard: middleware verifica JWT → getSession() → filtra por eventoId
5. Cambio de evento: clic en nombre evento (top bar) → /presala → re-selección
```

---

## 5. Base de datos

14 tablas PostgreSQL gestionadas con Prisma v7:

| Categoría | Tablas |
|---|---|
| Maestras | `evento_padre`, `evento`, `tipo_stand`, `contrato_plantilla`, `role` |
| Transaccionales | `stand`, `plano_posicion`, `gess_stand`, `reserva`, `reserva_stand`, `cuota`, `aprobacion`, `interop_facturacion`, `user_role` |
| Auditoría | `audit_log` |

---

## 6. Reglas de desarrollo (`.opencode/reglas/`)

| Regla | Severidad | Descripción |
|---|---|---|
| `constants-first` | CRITICAL | Usar `src/lib/constants.ts` para validaciones, nunca strings sueltos |
| `utility-services` | HIGH | Funciones reutilizables en `src/lib/utils/`, singleton, DRY |
| `api-design-patterns` | HIGH | Fachada de servicios, DTO/Mapper, Zod validation |
| `iimp-ui-kit` | HIGH | Componentes del UI Kit, tokens semánticos, `<span>` en Select |
| `lineamientos-bd` | MEDIUM | PK obligatoria, FK, índices, nomenclatura |

---

## 7. Variables de entorno

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_APP_ENV` | `local` / `qa` / `production` |
| `NEXT_PUBLIC_API_MOCK` | `1` = mock, `0` = API real |
| `DATABASE_URL` | Connection string PostgreSQL |
| `PLANOGESS_API_URL` | URL del API externo KBEventos |
| `JWT_SECRET` | Clave de firma JWT |
