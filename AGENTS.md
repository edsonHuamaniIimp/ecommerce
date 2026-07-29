<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Skills y reglas del proyecto

Este proyecto define skills y reglas en `.opencode/`. opencode las descubre
automáticamente (las de `.opencode/reglas/` están registradas en `opencode.json`
vía `skills.paths`).

## Cómo usar las reglas (biblioteca on-demand)

Las reglas son una **biblioteca de consulta**, NO material de lectura obligatoria en
cada prompt. Para ahorrar tokens:

1. **No leas todas las reglas por defecto.** Solo tienes visible su `description`.
2. Antes de actuar, **pregúntate**: "¿esta tarea toca el área de alguna regla?".
3. Si la respuesta es sí, **entonces** carga esa regla concreta con la tool `skill`
   y profundiza. Si no, procede sin cargarla.
4. Carga la regla en el momento en que la necesitas (p. ej. `lineamientos-bd` justo
   antes de modelar tablas), no "por si acaso".

## Reglas disponibles (`.opencode/reglas/`)

- `code-production-process` — pipeline de calidad para cualquier implementación no trivial.
- `code-review-standards` — estándares de revisión de código.
- `test-driven-development` — escribir tests antes/junto al código.
- `systematic-debugging` — diagnóstico de bugs guiado por causa raíz.
- `verification-before-completion` — verificar antes de declarar algo terminado.
- `pre-merge` — checklist antes de integrar cambios.
- `security-scanning` — revisión de seguridad.
- `constants-first` — **CRITICAL**: usar SIEMPRE constantes de `src/lib/constants.ts` para validaciones, estados, roles y permisos. Nunca strings o numeros hardcodeados.
- `utility-services` — usar servicios utilitarios centralizados (singleton) en `src/lib/utils/` para funciones reutilizables. Prohibe duplicar logica de formato/parseo en componentes.
- `api-design-patterns` — diseño de APIs (REST/route handlers). Documentar las APIs con **Swagger/OpenAPI** (`docs/openapi.yaml`). Patrones obligatorios: Arquitectura Hexagonal (Ports & Adapters) en backend, Fachada de Servicios en frontend, DTO/Mapper (un archivo por request/response — SOLID), constantes para validaciones (nunca strings hardcodeados).
- `lineamientos-bd` — estándares/buenas prácticas de persistencia y BD (nomenclatura, PK, normalización, índices). Cargar al modelar tablas/entidades/migraciones.
- `iimp-ui-kit` — lineamientos de estilo/frontend IIMP: UI Kit (`@nrivera-iimp/ui-kit-iimp`), verticales/theming, tipado estricto y regla Radix + Google Translate. Usar SIEMPRE al construir UI.

## Skills de stack (`.opencode/skills/`) — cómo construir

Invoca la skill del stack al tocar su área:

- `nextjs-core` — patrones de App Router, Server Components, Server Actions, caching.
- `nextjs-v16` — novedades de Next.js 16 (Turbopack, cache components).
- `next-dev-loop` — ciclo de desarrollo Next.js: errores, fast refresh, debugging.
- `next-cache-components-optimizer` — optimizar `"use cache"`, cacheLife, cacheTag.
- `next-cache-components-adoption` — migrar componentes a `"use cache"`.
- `next-partial-prefetching-adoption` — Partial Prefetching (PPR).
- `typescript-core` — patrones y buenas prácticas de TypeScript.
- `tailwind` — estilado utility-first con Tailwind.
- `prisma-database-setup` — configuración de Prisma con PostgreSQL, driver adapters.
- `prisma-client-api` — API del cliente Prisma: queries, mutaciones, transacciones.
- `prisma-postgres` — patrones específicos de PostgreSQL con Prisma.
- `prisma-cli` — comandos: `db push`, `migrate`, `generate`, `studio`, `seed`.
- `prisma-upgrade-v7` — referencia de migración a Prisma v7.
- `auth0` — autenticación y autorización con Auth0 (Next.js). Roles, permisos, middleware.

Regla práctica: antes de codificar una tarea, carga la skill de stack aplicable
y la regla de metodología correspondiente.
