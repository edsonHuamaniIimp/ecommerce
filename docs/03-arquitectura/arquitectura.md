# Arquitectura de Archivos — ContratosStands

> Estructura completa del proyecto con detalle backend/frontend.  
> Ultima actualizacion: 2026-08-03

---

## Indice

1. [Raiz del proyecto](#1-raiz-del-proyecto)
2. [Prisma (Base de Datos)](#2-prisma-base-de-datos)
3. [Documentacion](#3-documentacion)
4. [Configuracion](#4-configuracion)
5. [Backend — `src/` (lado servidor)](#5-backend)
   - [5.1 Domain — Nucleo puro](#51-domain)
   - [5.2 Application — Casos de uso](#52-application)
   - [5.3 Infrastructure — Adaptadores concretos](#53-infrastructure)
   - [5.4 Controllers — Capa HTTP](#54-controllers)
   - [5.5 Validators — Zod schemas](#55-validators)
   - [5.6 API Routes — Wiring declarativo](#56-api-routes)
   - [5.7 Lib — Utilidades compartidas del servidor](#57-lib)
   - [5.8 Middleware](#58-middleware)
6. [Frontend — `src/` (lado cliente)](#6-frontend)
   - [6.1 Pages y Layouts (App Router)](#61-pages-y-layouts)
   - [6.2 Components](#62-components)
   - [6.3 Hooks](#63-hooks)
   - [6.4 Contexts](#64-contexts)
   - [6.5 API Client Layer](#65-api-client-layer)
   - [6.6 DTOs (Data Transfer Objects)](#66-dtos)
   - [6.7 Lib — Utilidades compartidas del cliente](#67-lib-cliente)

---

## 1. Raiz del proyecto

```
ContratosStands/
├── AGENTS.md                      # Instrucciones para agentes IA (Next.js agent rules)
├── bitacora.md                    # Bitacora de desarrollo (contexto de sesiones)
├── CLAUDE.md                      # Instrucciones para Claude
├── docker-compose.yml             # Docker Compose desarrollo (PostgreSQL)
├── docker-compose.prod.yml        # Docker Compose produccion
├── Dockerfile                     # Imagen Docker de la app
├── docker/                        # Configuracion Docker (nginx, supervisor)
│   ├── entrypoint.sh
│   ├── nginx.conf
│   └── supervisord.conf
├── docs/                          # Documentacion del proyecto
│   ├── arquitectura.md            # Arquitectura general (este documento)
│   ├── despliegue.md              # Guia de despliegue
│   ├── endpoints.md               # Lista de endpoints
│   ├── flujos.md                  # Flujos de negocio detallados
│   ├── modelo-datos.md            # Modelo de datos (24 tablas)
│   ├── openapi.yaml               # Especificacion OpenAPI
│   └── requerimientos.md          # Requerimientos funcionales
├── eslint.config.mjs              # ESLint config
├── next.config.ts                 # Next.js config
├── opencode.json                  # Config de opencode (skills/reglas)
├── package.json                   # Dependencias y scripts
├── postcss.config.mjs             # PostCSS config
├── prisma.config.ts               # Prisma config (datasource)
├── prisma/                        # ORM — schema + migraciones + seed
│   ├── schema.prisma              # 25 modelos con indices y constraints
│   ├── seed.ts                    # Seed: roles, usuarios, maestra
│   └── migrations/                # Migraciones SQL
│       ├── 0001_init/
│       └── 0002_add_revision_table/
├── public/                        # Archivos estaticos + uploads locales
│   └── uploads/                   # Archivos subidos (desarrollo local)
├── scripts/                       # Scripts de infraestructura
│   ├── deploy.sh
│   └── s3-setup.sh
├── src/                           # Codigo fuente (ver secciones 5 y 6)
├── tailwind.config.ts             # Tailwind CSS config
└── tsconfig.json                  # TypeScript config
```

---

## 2. Prisma (Base de Datos)

```
prisma/
├── schema.prisma                  # 25 modelos (ver modelo-datos.md)
├── seed.ts                        # Datos iniciales
└── migrations/
    └── 0001_init/migration.sql    # Migracion inicial
    └── 0002_add_revision_table/   # Migracion: tabla revision_historial
```

**Modelos principales en `schema.prisma`:**

| Grupo | Modelos |
|-------|---------|
| Maestras | `EventoPadre`, `Evento`, `EventoMetadata`, `TipoStand`, `Maestra`, `Role`, `UserRole`, `GessStand` |
| Solicitudes | `Solicitud`, `SolicitudStand`, `SolicitudDocumento`, `Revision`, `RevisionHistorial`, `Reevaluacion` |
| Reservas | `Reserva`, `ReservaStand`, `Cuota`, `Aprobacion`, `InteropFacturacion` |
| Otros | `Stand`, `PlanoPosicion`, `Alerta`, `AuditLog`, `Config` |

---

## 3. Documentacion

```
docs/
├── arquitectura.md       # Este documento
├── despliegue.md          # Despliegue en produccion
├── endpoints.md           # Catalogo de endpoints API
├── flujos.md              # Flujos de negocio (solicitud, re-evaluacion, auspicios, permisos)
├── modelo-datos.md        # Esquema de BD detallado
├── openapi.yaml           # Especificacion OpenAPI/Swagger
└── requerimientos.md      # Requerimientos funcionales del sistema
```

---

## 4. Configuracion

```
next.config.ts              # Next.js (Turbopack, imagenes, rewrites)
tailwind.config.ts          # Tailwind v4, tema IIMP, colores verticales
tsconfig.json               # TypeScript strict, paths: @/*
postcss.config.mjs          # PostCSS plugins
eslint.config.mjs           # ESLint rules
prisma.config.ts            # Prisma: datasource URL
opencode.json               # Skills y reglas de .opencode/
package.json                # Scripts: dev, build, db:seed, db:reset, clean
.env                        # Variables de entorno (NO versionado)
```

**Scripts clave (`package.json`):**

| Script | Comando |
|--------|---------|
| `dev` | `next dev --turbo` |
| `build` | `next build` |
| `db:seed` | `tsx prisma/seed.ts` |
| `db:generate` | `prisma generate` |
| `db:push` | `prisma db push` |
| `db:reset` | Borra .next + db push --force-reset + generate + seed |
| `clean` | Borra .next + regenerate Prisma Client |

---

## 5. Backend

### Arquitectura Hexagonal (Ports & Adapters)

```
Controller (HTTP)  →  Application Service  →  Port (interface)  →  Adapter (Prisma/HTTP)
     │                      │                       │                    │
  validators            casos de uso          ISolicitudesRepo    SolicitudesPrismaRepo
  Zod schemas           orquestacion          IGessRepository     GessPrismaRepository
  handler()             reglas de negocio     IKbServiciosClient  KbServiciosClient
  DomainError           DomainError           IEventoRepository   EventoPrismaRepository
```

### 5.1 Domain

Capa mas interna — **sin dependencias externas**. Solo TypeScript puro. Define que existe, no como se implementa.

```
src/domain/
├── models/
│   └── entities.ts              # Interfaces de dominio (35+ entidades)
│       ├── GessStandEntity       # Stand del plano GESS
│       ├── SolicitudRow          # Fila de solicitud (vista plana)
│       ├── RevisionEntity        # Revision por area
│       ├── ReevaluacionEntity    # Solicitud de re-evaluacion
│       ├── RevisionHistorialEntity # Archivo de cambios
│       ├── EventoEntity          # Evento/version
│       ├── EventoPadreEntity     # Vertical (PERUMIN, GESS...)
│       ├── UserRoleEntity        # Usuario con rol
│       ├── RoleEntity            # Rol con permisos
│       └── ...                   # Otros: StandEntity, ReservaEntity, etc.
│
└── ports/                        # Interfaces (contratos) — 7 puertos
    ├── solicitudes-repository.ts # ISolicitudesRepository (12 metodos)
    ├── evento-repository.ts      # IEventoRepository
    ├── gess-repository.ts        # IGessRepository
    ├── auth-repository.ts        # IAuthRepository
    ├── role-repository.ts        # IRoleRepository
    ├── kbservicios-client.ts     # IKbServiciosClient (API externo KBServicios)
    └── planogess-client.ts       # IPlanogessClient (API externo plano GESS)
```

**`ISolicitudesRepository`** (el mas completo — 12 metodos):
- `listar()`, `detalle()`, `crearSolicitud()`
- `crearRevisionInicial()`, `crearOActualizarRevision()`
- `crearReevaluacion()`, `tieneReevaluacionPendiente()`
- `atenderReevaluacionAprobacion()`, `atenderReevaluacionRechazo()`
- `darDeBajaSolicitud()`, `marcarOrdenPago()`
- `obtenerHistorial()`, `crearAlertaReserva()`
- `crearDocumentoAdjunto()`, `findDocumento()`, `eliminarDocumento()`

### 5.2 Application

Casos de uso — orquestan logica de negocio. **No acceden a Prisma directamente** (usan puertos).

```
src/application/
├── alertas/
│   └── alertas-service.ts        # AlertasApplicationService
│       ├── listar(session)       # Filtra por rol (admin ve userId:admin)
│       ├── marcarLeida(session)  # Marca como leida (admin+propio)
│       └── marcarTodasLeidas()   # Marca todas (admin+propio)
│
├── auth/
│   └── auth-service.ts           # AuthApplicationService
│       ├── login()               # Autenticacion contra user_role
│       ├── session()             # JWT payload actual
│       ├── seleccionarEvento()   # Actualiza JWT con eventoId
│       ├── perfil()              # CRUD de perfil
│       └── resetPassword()       # Flujo de reset
│
├── eventos/
│   ├── evento-service.ts         # EventoApplicationService
│   │   ├── findAll(), crear(), actualizar()
│   │   └── findOrCreateEvento()  # Crea evento desde API on-demand
│   └── presala-service.ts        # PresalaApplicationService
│       └── listarEventos()       # Lista eventos publicos para presala
│
├── gess/
│   └── gess-service.ts           # GessApplicationService
│       ├── listar()              # Stands GESS paginados
│       ├── actualizarStand()     # Actualiza datos de stand
│       └── sync()                # Sincroniza desde API KBEventos
│
├── reservas/
│   └── reserva-service.ts        # ReservaApplicationService
│       └── reservar()            # Crea solicitud + revisiones + alertas + emails
│
└── solicitudes/
    └── solicitudes-service.ts    # SolicitudesApplicationService
        ├── listar(), detalle()
        ├── revisar()             # Valida area y estado
        ├── uploadDocumento()     # Decide userId (null si admin)
        ├── eliminarDocumento()   # Valida propiedad (DomainError si no)
        └── inicializarRevisiones()
```

### 5.3 Infrastructure

Implementaciones concretas de los puertos.

```
src/infrastructure/
├── persistence/                  # Adaptadores de BD (Prisma)
│   ├── solicitudes-repository.ts # SolicitudesPrismaRepository
│   │   ├── mapRow() async        # Mapper Solicitud → SolicitudRow
│   │   ├── computeEstadoSolicitud() # Logica de estado automatico
│   │   ├── mapRevision()         # Mapper Revision → RevisionEntity
│   │   └── ... todos los metodos del puerto
│   ├── evento-repository.ts      # EventoPrismaRepository
│   ├── gess-repository.ts        # GessPrismaRepository
│   ├── auth-repository.ts        # AuthPrismaRepository
│   └── role-repository.ts        # RolePrismaRepository
│
└── external/                     # Clientes HTTP para APIs externas
    ├── kbservicios-client.ts     # KbServiciosClient (API GeneXus)
    └── planogess-client.ts       # PlanogessClient (API KBEventos)
```

**Detalle de `solicitudes-repository.ts`:**
- `listar(params)` — query paginada con filtros, includes: gessStand, revisiones, reevaluaciones, docsAdjuntos, _count
- `detalle(id)` — findUnique con todos los includes
- `mapRow(row)` — mapper async que resuelve multi-stand (consulta SolicitudStand + GessStand)
- `crearDocumentoAdjunto()` — inserta en solicitud_documento
- `findDocumento()` — busca por id, retorna id + userId
- `eliminarDocumento()` — soft delete (flgActivo = false)

### 5.4 Controllers

Capa HTTP delgada — **solo parsea request, llama al servicio, retorna success/error**.

```
src/controllers/
├── solicitudes.controller.ts     # 12 endpoints
│   ├── listar(GET)               # Filtros: eventoId, page, search, userId
│   ├── detalle(GET)              # Por id
│   ├── revisar(POST)             # Crear/actualizar revision
│   ├── notificar(POST)           # Envio de correo (auto/personalizado)
│   ├── reevaluar(POST)           # Cliente solicita re-evaluacion
│   ├── atenderReevaluacion(POST) # Admin aprueba/rechaza
│   ├── darDeBaja(POST)           # Baja logica
│   ├── ordenPago(POST)           # Marcar pendiente_pago
│   ├── modificar(POST)           # Modificar solicitud
│   ├── historial(GET)            # Historial de cambios
│   ├── uploadDocumento(POST)     # Subir documento adjunto
│   └── eliminarDocumento(POST)   # Soft delete documento
│
├── alertas.controller.ts         # 3 endpoints
│   ├── listar(GET)               # Listar alertas del usuario
│   ├── marcarLeida(POST)         # Marcar una como leida
│   └── marcarTodasLeidas(POST)   # Marcar todas
│
├── auth.controller.ts            # 7 endpoints (login, logout, session, perfil, etc.)
├── eventos.controller.ts         # CRUD de eventos
├── gess.controller.ts            # Stands GESS
├── kbservicios.controller.ts     # Proxy API KBServicios
├── maestra.controller.ts         # Diccionario maestra
├── reserva.controller.ts         # Creacion de reservas
├── roles.controller.ts           # CRUD de roles y usuarios
└── consultas.controller.ts       # Consultas SUNAT/RENIEC
```

### 5.5 Validators

Zod schemas para validacion de entrada. Un archivo por entidad.

```
src/validators/
├── solicitudes.validator.ts      # Schemas: listar, detalle, revisar, reevaluar
├── eventos.validator.ts          # Schemas: crear, actualizar
├── gess.validator.ts             # Schema: actualizar stand
└── reserva.validator.ts          # Schema: crear reserva
```

### 5.6 API Routes

Capa de routing — **100% declarativa** usando `createRouter()`. Sin logica, sin try/catch.

```
src/app/api/
├── solicitudes/[...slug]/route.ts    # 12 acciones: listar, detalle, revisar, notificar, etc.
├── alertas/[...slug]/route.ts        # 3 acciones: listar, marcar-leida, marcar-todas-leidas
├── auspicios/
│   ├── listar/route.ts               # POST → proxy API externo listauspicio
│   └── grabar/route.ts               # POST → proxy API externo saveauspicio
├── auth/[...slug]/route.ts           # 7 acciones: login, logout, session, perfil, etc.
├── eventos/[...slug]/route.ts        # CRUD eventos
├── gess/[...slug]/route.ts           # Stands GESS
├── kbservicios/[...slug]/route.ts    # Proxy KBServicios
├── maestra/[...slug]/route.ts        # Diccionario maestra
├── planogess/[...slug]/route.ts      # Proxy plano GESS
├── reniec/[...slug]/route.ts         # Consulta RENIEC
├── reservas/[...slug]/route.ts       # Creacion reservas
├── roles/[...slug]/route.ts          # CRUD roles
├── sunat/[...slug]/route.ts          # Consulta SUNAT
└── upload/route.ts                   # Subida de archivos
```

**Patron de ruta:**
```ts
// src/app/api/solicitudes/[...slug]/route.ts
import { createRouter } from "@/lib/router";
import { solicitudesController } from "@/controllers/solicitudes.controller";

export const { GET, POST } = createRouter({
  GET: {
    listar: (req) => solicitudesController.listar(req),
    detalle: (req) => solicitudesController.detalle(req),
    historial: (req) => solicitudesController.historial(req),
  },
  POST: {
    revisar: (req) => solicitudesController.revisar(req),
    notificar: (req) => solicitudesController.notificar(req),
    // ... 9 acciones mas
  },
});
```

### 5.7 Lib (Servidor)

Utilidades exclusivas del lado servidor. Protegidas con `import 'server-only'`.

```
src/lib/
├── server/                         ← Solo Node.js (Prisma, JWT, NextResponse)
│   ├── db.ts                       # Singleton Prisma client
│   ├── auth.ts                     # Logica JWT
│   │   ├── signToken(payload)      # Firma JWT con permisos de roles
│   │   ├── verifyToken(token)      # Verifica y decodifica
│   │   ├── getSession()            # Session desde cookie
│   │   ├── getTokenFromRequest()   # Extrae token de cookie/header
│   │   ├── hasRole(p, ...roles)    # Verifica rol
│   │   └── hasPermission(p, perm)  # Verifica permiso (admin bypass)
│   ├── router.ts                   # createRouter() + DomainError
│   │   ├── createRouter(config)    # Enrutador declarativo con error handler
│   │   └── DomainError             # Error tipado (code, status)
│   ├── api-response.ts             # success() y error() (NextResponse)
│   ├── handlers.ts                 # handler() wrapper global (legacy)
│   ├── email.ts                    # sendEmail() via Resend API
│   ├── email-templates.ts          # buildRevisionEmail() HTML template
│   ├── services.ts                 # Contenedor DI (singleton)
│   ├── storage.ts                  # Storage adapter (local/S3)
│   ├── pagination.ts               # Helpers de paginacion (server)
│   └── utils/
│       └── cookie.ts               # getTokenFromHeaders (Request), set/clear cookie (NextResponse)
│
├── shared/                         ← Funciones puras (sin Node.js ni browser)
│   ├── constants.ts                # Constantes tipadas (370+ lineas)
│   │   ├── ROLES, ROLES_PERMISSIONS
│   │   ├── ALL_PERMISSIONS (21 en 6 secciones)
│   │   ├── ESTADOS_SOLICITUD, ESTADOS_STAND
│   │   ├── REVISION_AREAS, RESULTADOS_APROBACION
│   │   ├── API_ERROR_CODES, LS_KEYS
│   │   └── PERMISSION_SECTIONS
│   ├── api-types.ts                # ApiResponse<T>, ApiResult<T> (solo tipos)
│   ├── utils.ts                    # cn() — helper de clases Tailwind
│   ├── utils/
│   │   ├── date.ts                 # dateUtils: format(), formatDateTime(), toInputValue()
│   │   └── form-validator.ts       # Validacion de formularios
│   ├── mappers/                    # snake_case ↔ camelCase
│   │   ├── gess-mapper.ts
│   │   ├── gess.ts
│   │   └── reserva.ts
│   └── planos/                     # Definiciones de planos 3D
│       ├── registry.ts
│       └── gess/
│           ├── index.ts, bloques.ts, construccion.ts, tipos.ts
│
└── client/                         ← Solo browser (localStorage, IndexedDB, fetch)
    ├── indexed-db.ts               # IndexedDB (borradores de formulario)
    └── api/                        # Fachada de servicios API (ver 6.5)
        ├── client.ts, config.ts
        └── services/               # 16 servicios por dominio
```

### 5.8 Middleware

```
src/middleware.ts                   # Proteccion JWT de rutas
├── PROTECTED[]                     # Array de rutas protegidas
│   ├── path: string               # Prefijo de ruta (startsWith)
│   ├── roles: string[]            # Roles permitidos
│   └── permission?: string        # Permiso requerido (opcional)
├── middleware(request)            # Funcion principal
│   ├── Skip public routes        # /auth/login, /presala, /, /403, /api/auth/*
│   ├── For each PROTECTED route  # Verifica JWT → roles → permission
│   ├── Admin bypass eventoId     # Admin no requiere eventoId
│   └── Redirect                   # /auth/login (sin token) o /403 (sin permiso)
└── config.matcher                 # Pattern de rutas a interceptar
```

---

## 6. Frontend

### Arquitectura: Service Layer + DTO + Mapper

```
Componente  →  solicitudesService  →  internalApi  →  fetch(/api/...)
                    │                      │
              SolicitudDTO           ApiResponse<T>
              (tipado fuerte)        (success/error)
```

### 6.1 Pages y Layouts

App Router de Next.js con route groups `(dashboard)` y `(public)`.

```
src/app/
├── layout.tsx                     # Layout raiz (Providers: Theme, Vertical, Tooltip)
├── globals.css                    # Estilos globales (Tailwind + tema IIMP)
├── providers.tsx                  # Providers (ThemeProvider, VerticalProvider, TooltipProvider)
├── favicon.ico
│
├── (public)/                      # Route group: rutas publicas
│   ├── layout.tsx                 # Layout publico (sin sidebar)
│   ├── page.tsx                   # Home: selector de eventos con colores verticales
│   └── plano/
│       └── page.tsx               # Plano 3D interactivo (Three.js)
│
├── (dashboard)/                   # Route group: requiere autenticacion
│   ├── layout.tsx                 # Layout con sidebar + header + alertas
│   └── dashboard/
│       ├── page.tsx               # Panel de control (KPIs)
│       ├── auspicios/page.tsx     # Busqueda y registro de auspicios
│       ├── datos-evento/page.tsx  # Datos y precios del evento
│       ├── eventos/page.tsx       # CRUD de versiones de evento
│       ├── mis-solicitudes/page.tsx  # Solicitudes del cliente
│       ├── perfil/page.tsx        # Perfil de usuario
│       ├── reservas/page.tsx      # Gestion de reservas
│       ├── roles/page.tsx         # Roles y permisos
│       ├── solicitudes/page.tsx   # Bandeja admin de solicitudes
│       ├── stands/page.tsx        # Gestion de stands
│       └── vinculacion/page.tsx   # Vinculacion desde API KBEventos
│
├── 403/page.tsx                   # Pagina de acceso denegado
├── presala/page.tsx               # Selector de evento/version
└── auth/login/page.tsx            # Login
```

**Dashboard Layout (`src/app/(dashboard)/layout.tsx`):**
```
┌──────────────────────────────────────────────┐
│  Sidebar  │  Header (evento, alertas, user)  │
│  (colapsable)                               │
│           │───────────────────────────────── │
│           │                                  │
│           │  Contenido (children)            │
│           │                                  │
└──────────────────────────────────────────────┘
```

### 6.2 Components

Componentes React organizados por dominio.

```
src/components/
├── dashboard/                     # Componentes del layout dashboard
│   ├── sidebar.tsx                # Menu vertical con permisos (11 items)
│   │   ├── navItems[]             # Cada item con href, label, icon, permission
│   │   ├── canSee(perm)           # Verifica permiso o admin:full
│   │   └── loaded flag            # No renderiza items hasta cargar permisos
│   ├── dashboard-header.tsx       # Header: evento, campanita alertas, user menu
│   │   ├── loadAlertas()          # Poll cada 30s API alertas
│   │   └── handleAlertClick()     # Evento personalizado o router.push
│   ├── dashboard-content.tsx      # Panel de control (KPIs)
│   ├── dashboard-table.tsx        # Tabla de datos (legacy)
│   ├── stats-card.tsx             # Tarjeta de estadistica
│   ├── evento-selector.tsx        # Selector de evento
│   └── aprobaciones-section.tsx   # Seccion de aprobaciones
│
├── solicitudes/                   # Modulo completo de solicitudes
│   ├── solicitudes-manager.tsx    # Admin: bandeja + detalle + revision
│   │   ├── Tabla con estados, docs, acciones
│   │   ├── DetailSection (acordeon)
│   │   ├── useAlertaNavigate hook
│   │   └── Funciones helper (esMultiStand, estaPendiente, puedeRevisar, etc.)
│   ├── mis-solicitudes-manager.tsx # Cliente: mis solicitudes + detalle
│   ├── solicitud-review.tsx       # Modal de revision por areas (steps)
│   │   ├── Steps: Comunicacion → Legal → Logistica
│   │   ├── Documentos del cliente consolidados (3 fuentes)
│   │   └── Aprobar/Rechazar con justificacion obligatoria
│   ├── revision-step-indicator.tsx # Indicador visual de steps
│   ├── notificar-modal.tsx        # Modal de notificacion (auto/personalizado)
│   ├── historial-modal.tsx        # Historial de cambios de revision
│   ├── modificar-solicitud-modal.tsx # Modal de re-evaluacion (docs + justificacion)
│   └── cliente-upload-modal.tsx   # Modal de upload de docs en multi-stand
│
├── plano/                         # Plano 3D y reserva
│   ├── plano-isometrico.tsx       # Componente 3D principal (Three.js)
│   │   ├── Canvas + OrbitControls
│   │   ├── Bloque3D (mesh interactivo)
│   │   ├── Seleccion multiple de stands
│   │   ├── Post-submit modal (flujo multi-stand)
│   │   └── Auto-sync desde API
│   ├── planogess-view.tsx         # Vista de stands GESS
│   ├── datos-evento-manager.tsx   # Datos del evento
│   ├── plano-grid.tsx / plano-grid-2d.tsx  # Plano 2D alternativo
│   ├── plano-stands.tsx           # Lista de stands
│   └── reserva/                   # Wizard de reserva (3 steps)
│       ├── reserva-modal.tsx      # Contenedor del wizard
│       ├── step-datos.tsx         # Step 0: Datos comerciales
│       ├── step-documentos.tsx    # Step 1: Docs (single o timeline multi)
│       ├── step-confirmacion.tsx  # Step 2: Confirmacion
│       ├── step-indicator.tsx     # Indicador visual de steps
│       ├── use-reserva-form.ts    # Hook: estado, validacion, submit, IndexedDB
│       └── interfaces.ts         # Tipos: FormDatos, GessLinkedInfo, StepDef
│
├── stands/
│   └── stands-manager.tsx         # Bandeja de stands con docs/imagenes
│
├── reservas/
│   └── reservas-manager.tsx       # Gestion de reservas (legacy)
│
├── reserva/
│   ├── reserva-form.tsx           # Formulario de reserva (legacy)
│   └── reserva-workspace.tsx      # Workspace de reserva (legacy)
│
├── admin/
│   ├── roles-mantenedor.tsx       # CRUD roles y permisos
│   └── eventos-mantenedor.tsx     # CRUD eventos
│
├── gess/
│   └── gess-mantenedor.tsx        # Mantenedor GESS
│
├── shared/
│   ├── pagination.tsx             # Componente de paginacion
│   └── table-skeleton.tsx         # Skeleton loader para tablas
│
├── evento/
│   └── event-selection-dialog.tsx # Dialogo de seleccion de evento
│
├── layout/
│   └── header.tsx                 # Header publico
│
└── estado-badge.tsx               # Badge de estado reutilizable
```

**Detalle de `DetailSection` (acordeon):**
```tsx
// Usado en solicitudes-manager.tsx y mis-solicitudes-manager.tsx
function DetailSection({ id, title, open, onToggle, children }) {
  // Borde redondeado, shadow en hover, chevron animado
  // Transicion grid-rows + opacity
  // Solo una seccion abierta a la vez (accordionOpen state)
}
```

### 6.3 Hooks

```
src/hooks/
└── use-alerta-navigate.ts         # Hook para navegacion desde alertas
    ├── Escucha evento "alerta:navigate"
    ├── Si mismo path → fetch detalle + abre modal (sin recargar URL)
    └── Si otro path → ignora (el header usa router.push)
```

### 6.4 Contexts

```
src/contexts/
└── evento-context.tsx             # Contexto de evento seleccionado
```

### 6.5 API Client Layer

Capa de servicios API para el frontend. Fachada que encapsula las llamadas HTTP. Protegida con `import 'client-only'`.

```
src/lib/client/api/
├── config.ts                      # Configuracion de API (base URL, mock flag)
├── client.ts                      # Cliente HTTP base
├── http.ts                        # Utilidades HTTP
├── types.ts                       # Tipos compartidos de API
├── internal-api.ts                # Cliente interno (incluye token JWT)
│
├── services/                      # Servicios por dominio (16 servicios)
│   ├── solicitudes-service.ts     # SolicitudesService
│   │   ├── listar(), detalle(), revisar(), notificar()
│   │   ├── reevaluar(), modificar(), darDeBaja(), ordenPago()
│   │   ├── atenderReevaluacion(), uploadDocumento(), eliminarDocumento()
│   │   ├── subirArchivo(), historial()
│   │   └── Tipos: SolicitudDTO, SolicitudesPaginatedDTO
│   ├── alertas-service.ts         # AlertasService
│   │   └── listar(), marcarLeida(), marcarTodasLeidas()
│   ├── auth-service.ts            # AuthService
│   │   └── login(), logout(), getSession(), seleccionarEvento(), perfil(), resetPassword()
│   ├── eventos-service.ts         # EventosService
│   ├── gess-service.ts            # GessService (stands, vincular)
│   ├── maestra-service.ts         # MaestraService (diccionarios)
│   ├── roles-service.ts           # RolesService (CRUD)
│   ├── kbservicios-service.ts     # KbServiciosService
│   ├── perfil-service.ts          # PerfilService
│   ├── sunat-service.ts           # SunatService (consulta RUC)
│   ├── facade.ts                  # Fachada unificada
│   ├── mock.ts / mock-data.ts     # Mock data para desarrollo
│   └── types.ts                   # Tipos de respuesta de API
```

### 6.6 DTOs

Data Transfer Objects — un archivo por request/response (principio SOLID).

```
src/types/dto/
├── solicitudes/
│   └── solicitudes-response.dto.ts  # SolicitudDTO, SolicitudesPaginatedDTO
│       ├── SolicitudDTO             # 24 campos (id, standCode, estadoSolicitud, docsAdjuntos, etc.)
│       ├── ReevaluacionDTO          # id, estado, motivo, documentos, createdBy, createdAt
│       ├── RevisionDTO              # id, area, estado, comentario, createdBy, etc.
│       └── SolicitudesPaginatedDTO  # data[], total, page, perPage, totalPages
│
├── auth/                            # 13 archivos DTO
│   ├── login-request.dto.ts         # LoginRequestDTO
│   ├── login-result.dto.ts          # LoginResultDTO
│   ├── login-response.dto.ts        # LoginResponseDTO
│   ├── session.dto.ts               # SessionDTO (JWT payload)
│   ├── session-result.dto.ts        # SessionResultDTO
│   ├── seleccionar-evento-request.dto.ts
│   ├── seleccionar-evento-result.dto.ts
│   ├── perfil-result.dto.ts
│   ├── perfil-update-request.dto.ts
│   ├── reset-password-request.dto.ts
│   ├── confirm-reset-request.dto.ts
│   ├── confirm-reset-result.dto.ts
│   ├── request-reset-result.dto.ts
│   └── index.ts                     # Barrel export
│
├── eventos/                         # 5 archivos DTO
│   ├── presala.dto.ts               # EventoPresalaDTO, EventoPadrePresalaDTO
│   ├── create-evento-request.dto.ts
│   ├── update-evento-request.dto.ts
│   ├── eventos-response.dto.ts
│   └── index.ts
│
├── gess/                            # 4 archivos DTO
│   ├── gess-stand.dto.ts            # GessStandDTO (13 campos + docsAdjuntos)
│   ├── gess-response.dto.ts
│   ├── sync-result.dto.ts
│   └── index.ts
│
├── maestra/
│   ├── maestra-item.dto.ts
│   └── index.ts
│
├── reserva/
│   ├── reserva-request.dto.ts
│   └── index.ts
│
├── reservas/                        # (vacio — legacy)
├── roles/                           # (vacio — legacy)
│
├── models.ts                        # Tipos de modelo genericos
└── pagination.dto.ts               # Tipo de paginacion generico
```

### 6.7 Lib (Cliente)

Utilidades exclusivas del lado cliente. Protegidas con `import 'client-only'`.

```
src/lib/client/
├── indexed-db.ts                   # IndexedDB (autoguardado de formularios)
└── api/                            # Fachada de servicios API (ver 6.5)
    ├── client.ts                   # Cliente HTTP (fetch + localStorage)
    ├── config.ts                   # Config (NEXT_PUBLIC_API_URL)
    └── services/                   # 16 servicios por dominio
        ├── internal-api.ts         # Cliente interno con JWT
        ├── solicitudes-service.ts
        ├── auth-service.ts
        ├── alertas-service.ts
        ├── eventos-service.ts
        ├── gess-service.ts
        ├── maestra-service.ts
        ├── roles-service.ts
        ├── kbservicios-service.ts
        ├── perfil-service.ts
        ├── sunat-service.ts
        ├── facade.ts
        ├── mock.ts / mock-data.ts
        └── types.ts
```

Las utilidades compartidas (sin dependencia de entorno) estan en `src/lib/shared/` (ver 5.7).

---

## 7. Resumen de Capas

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (cliente)                      │
│                                                             │
│  Pages (App Router)  →  Components  →  Services (fachada)  │
│       │                      │              │               │
│  DTOs (tipado)         Hooks + Contexts   internalApi      │
│                                            (fetch)         │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP
┌──────────────────────────────┴──────────────────────────────┐
│                     BACKEND (servidor)                       │
│                                                              │
│  Route (createRouter)  →  Controller  →  Application       │
│       │                      │               │              │
│  Declarativo            Valida request   Orquesta negocio   │
│  Sin logica             Sin try/catch    DomainError        │
│                               │               │              │
│                          Validators         Port (interface) │
│                          (Zod)                   │           │
│                                            ┌────┴────┐      │
│                                     Infrastructure        │
│                                     ├── Persistence (Prisma)
│                                     └── External (HTTP)     │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. Flujo de Datos Tipico

```
Usuario hace click en "Revisar"
  │
  ▼
solicitudes-manager.tsx
  │  setReviewRow(row); setReviewOpen(true)
  ▼
solicitud-review.tsx (modal)
  │  Usuario escribe justificacion, click "Aprobar"
  ▼
solicitudesService.revisar({ solicitudId, area, estado, comentario })
  │  POST /api/solicitudes/revisar
  ▼
createRouter() → solicitudesController.revisar(request)
  │  Valida sesion, parsea body
  ▼
services.solicitudes.revisar({...})
  │  Valida area (constants), valida estado (constants)
  ▼
repo.crearOActualizarRevision({...})
  │  Crea RevisionHistorial (estado anterior)
  │  Actualiza Revision (nuevo estado)
  ▼
Prisma → PostgreSQL
  │
  ▼
Response → controller retorna success(revision)
  │
  ▼
Componente actualiza estado local
```

---

## 9. Convenciones Clave

| Regla | Archivo |
|-------|---------|
| Constantes, nunca strings hardcodeados | `src/lib/shared/constants.ts` |
| Colores de badge semanticos (estados) | `src/lib/shared/constants.ts` → `BADGE_STYLES` |
| Tipos de respuesta API (compartidos) | `src/lib/shared/api-types.ts` |
| Controller sin logica de negocio, sin prisma, sin try/catch | `.opencode/reglas/api-design-patterns/SKILL.md` |
| Limites estrictos server/client/shared | `.opencode/reglas/strict-boundaries/SKILL.md` |
| DTOs: un archivo por request/response | `src/types/dto/{dominio}/` |
| Validacion con Zod | `src/validators/` |
| Arquitectura Hexagonal (Ports & Adapters) | `src/domain/ports/` → `src/infrastructure/` |
| Servicios utilitarios singleton | `src/lib/shared/utils/` |
| Mapper snake_case ↔ camelCase | `src/lib/shared/mappers/` |
| Fachada de servicios API en frontend | `src/lib/client/api/services/` |
| UI Kit IIMP (shadcn) + Tailwind | `@nrivera-iimp/ui-kit-iimp` |
| Permisos por item de menu | `src/components/dashboard/sidebar.tsx` |
