# Convenciones de Código y Reglas del Proyecto — ContratosStands

> **Estado:** v1.0 — 2026-09-11
> **Fuente:** `AGENTS.md`, `.opencode/reglas/`, `.opencode/skills/`, configuración del proyecto.
> **Nota:** estas reglas son **obligatorias**. El pipeline de despliegue exige **ZERO errores** de ESLint y TypeScript.

---

## 1. Regla de oro — Next.js 16 no es el Next.js "conocido"

Este proyecto usa **Next.js 16.2.10** con breaking changes (APIs async, convenciones,
Turbopack, `"use cache"`). **Antes de escribir código**, consultar la documentación
local en `node_modules/next/dist/docs/` (lo indica `AGENTS.md`).

---

## 2. Arquitectura backend — Hexagonal (Ports & Adapters)

Estructura obligatoria por capas:

```
src/
├── domain/            # Núcleo puro: models + ports (interfaces)
│   ├── models/        # Entidades de dominio
│   └── ports/         # Interfaces de repositorios y clientes externos
├── application/       # Casos de uso por dominio
│   ├── auth/
│   ├── eventos/
│   ├── gess/
│   ├── reservas/
│   └── solicitudes/
├── infrastructure/    # Adaptadores concretos
│   ├── persistence/   # Repositorios Prisma
│   └── external/      # Clientes HTTP (KBServicios, Planogess, entidades, etc.)
├── controllers/       # Capa HTTP (delgada)
├── validators/        # Schemas Zod
├── lib/server/        # Router, servicios (DI), handlers, storage, email, auth
└── app/api/           # Route Handlers (wiring declarativo)
```

- **`src/lib/server/router.ts`** — `createRouter()` une segmentos y despacha acciones.
- **`src/lib/server/services.ts`** — contenedor DI singleton.
- **Route handlers delgados**: sin lógica de negocio.

### 2.1 Patrones obligatorios de API (`api-design-patterns`)

- Arquitectura hexagonal (arriba).
- **Zod** para toda validación de entrada.
- **DTOs explícitos** de request/response — **un archivo por DTO** (SOLID).
- **Mapper** snake_case ↔ camelCase.
- **`handler()` wrapper** global de errores.
- **Constantes** para validaciones (nunca strings hardcodeados).
- **Documentar con Swagger/OpenAPI** en `docs/openapi.yaml`.

---

## 3. Arquitectura frontend

- **Fachada de Servicios API** en `src/lib/api/services/` (servicios tipados por dominio).
- **DTOs** en `src/types/dto/` (un archivo por request/response).
- **Mappers** en `src/lib/shared/mappers/`.
- **Contextos**: `EventoContext` (evento activo), tema, vertical.
- **Componentes** en `src/components/<dominio>/`.

---

## 4. Reglas obligatorias (`.opencode/reglas/`)

| Regla | Contenido |
|---|---|
| **`constants-first`** (CRITICAL) | Usar SIEMPRE constantes de `src/lib/constants.ts` para validaciones, estados, roles y permisos. **Prohibido** strings o números hardcodeados. |
| **`utility-services`** | Servicios utilitarios centralizados (singleton) en `src/lib/utils/` (fechas, validaciones, helpers). **Prohibido** duplicar lógica en componentes. |
| **`api-design-patterns`** | Hexagonal + fachada frontend + DTO/Mapper + OpenAPI + constantes. |
| **`lineamientos-bd`** | Nomenclatura (`TB*`, `PK_`, `FK_`, `IDX_`), PK obligatoria, normalización, índices, auditoría. Consultar al modelar tablas. |
| **`iimp-ui-kit`** | **Solo componentes del UI Kit IIMP** (`@nrivera-iimp/ui-kit-iimp`). Nunca HTML puro para controles. Tokens semánticos de color. Regla Radix + Google Translate: envolver texto en `<span>` dentro de Select/Popover/Dropdown. |
| **`strict-boundaries`** | El frontend **nunca** importa de `server/application/infrastructure/domain`. Cada utilidad nueva va en `server`, `client` o `shared` según su dependencia. |
| **`code-production-process`** | Pipeline de calidad para implementaciones no triviales (research → architect → implement → tests → security → critic). |
| **`test-driven-development`** | Escribir tests antes/junto al código. |
| **`systematic-debugging`** | Diagnóstico guiado por causa raíz, no parches. |
| **`verification-before-completion`** | Verificar (comandos + output) antes de declarar algo terminado. |
| **`pre-merge`** | Checklist antes de integrar: tipos, lint, migraciones sin datos, análisis de impacto de upgrades. |
| **`security-scanning`** | Secretos, dependencias, SAST, triaje, excepciones con expiración. |
| **`code-review-standards`** | Checklist con severidad (CRITICAL/HIGH/MEDIUM/LOW). |

---

## 5. Calidad de código — Pipeline ZERO ERRORS

- **TypeScript estricto**: `strict: true`. **Prohibido `any`**. No usar `""` ni `Record<string, any>` como tipos.
- **ESLint** con `eslint-config-next` (flat config).
- **Verificación obligatoria antes de terminar**:
  ```bash
  npx tsc --noEmit
  npx eslint
  ```
- **No ejecutar `npm run build` como verificación de rutina** (lo maneja el owner/CI).

---

## 6. Convenciones de UI (UI Kit IIMP)

- **Verticales** (theming): `proexplo`, `wmc`, `gess`, `perumin` — clase `vert-*` + `data-vertical` en `<html>`.
- Persistencia en `localStorage` (`iimp-vertical`); cambio por URL `?theme=`.
- **Tokens semánticos**: `bg-primary`, `text-primary-foreground`, `bg-muted`, `border-border`. **No** colores hardcodeados.
- **Dark mode** nativo vía clase `.dark` (next-themes).
- **Responsive en bandejas**: columnas ocultas progresivamente (`hidden sm:table-cell`), `overflow-x-auto`, paginación compacta en mobile, `min-w-0` en contenedores `flex-1`.
- **Anti-flash de vertical**: script `public/vertical-init.js` cargado en `layout.tsx` (hoistado al `<head>`).

---

## 7. Base de datos

- **PostgreSQL + Prisma v7** con `@prisma/adapter-pg`.
- Config en `prisma.config.ts` (estilo v7), schema en `prisma/schema.prisma`.
- **Convenciones** (`lineamientos-bd`):
  - PK obligatoria en toda tabla; FK con integridad referencial.
  - Auditoría: `creadoEn`, `actualizadoEn`, `creadoPor`.
  - Nomenclatura relacional sugerida: `TB<T>_CTRST_<DESCRIPCION>` (módulo `CTRST`).
  - Baja lógica con `flgActivo` para preservar auditoría.
- **Migraciones**: `npm run db:migrate` (dev) / `db:migrate:deploy` (producción).

---

## 8. Testing

- **Vitest** configurado (`vitest.config.ts`, entorno node, alias `@`).
- **No hay specs aún** — pendiente prioritario para el proveedor.
- La regla `test-driven-development` exige escribir tests antes/junto al código.

---

## 9. Skills del proyecto (`.opencode/skills/`)

El proyecto incluye skills de stack para consulta on-demand (no cargar todas):

- **Next.js**: `nextjs-core`, `nextjs-v16`, `next-dev-loop`, `next-cache-components-*`, `next-partial-prefetching-adoption`.
- **TypeScript / Tailwind**: `typescript-core`, `tailwind`.
- **Prisma**: `prisma-database-setup`, `prisma-client-api`, `prisma-postgres`, `prisma-cli`, `prisma-upgrade-v7`.
- **Auth**: `auth0`.
- **Animación**: `framer-motion`, `three-fiber`.

**Regla de ahorro de tokens:** leer solo la `description`; cargar la skill únicamente si aplica a la tarea.

---

## 10. Flujo de trabajo con IA (opencode)

El proyecto usa **opencode** con reglas y skills. Configuración en `opencode.json` (proyecto) y `~/.config/opencode/opencode.jsonc` (global). Los MCP configurados (GitLab, Confluence) permiten leer MRs y publicar documentación.

> **Para el proveedor:** si usan otra herramienta de IA, las reglas de `.opencode/reglas/` siguen siendo el estándar de código del proyecto — leerlas y respetarlas.
