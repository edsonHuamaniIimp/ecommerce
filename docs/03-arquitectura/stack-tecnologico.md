# Stack Tecnológico — ContratosStands

> **Estado:** v1.0 — 2026-09-11
> **Fuente:** `package.json`, `tsconfig.json`, `next.config.ts`, configuración del proyecto.

---

## 1. Resumen

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | 20 (LTS, fijado en Docker y CI) |
| Framework | Next.js (App Router + Turbopack) | 16.2.10 |
| UI | React | 19.2.4 |
| Lenguaje | TypeScript (strict) | 5.x |
| Estilos | Tailwind CSS v4 + UI Kit IIMP | ^4 |
| ORM | Prisma + adaptador PostgreSQL | ^7.8.0 |
| Base de datos | PostgreSQL | 16 (Docker) |
| Auth | JWT propio (`jose`) | ^6.2.3 |
| Validación | Zod | ^4.4.3 |
| Correo | Resend (API REST) | — |

---

## 2. Dependencias de producción

### 2.1 Core

| Paquete | Versión | Uso |
|---|---|---|
| `next` | 16.2.10 | Framework (App Router, Route Handlers, Turbopack) |
| `react` / `react-dom` | 19.2.4 | UI |
| `typescript` | ^5 | Tipado estricto (dev) |

### 2.2 Datos y persistencia

| Paquete | Versión | Uso |
|---|---|---|
| `@prisma/client` | ^7.8.0 | Cliente ORM |
| `@prisma/adapter-pg` | ^7.8.0 | Adaptador driver PostgreSQL para Prisma v7 |
| `pg` | ^8.22.0 | Driver PostgreSQL |
| `zustand` | ^5.0.14 | Estado global cliente |
| `idb` (vía cliente) | — | Borradores de reserva en IndexedDB |

### 2.3 Autenticación y seguridad

| Paquete | Versión | Uso |
|---|---|---|
| `jose` | ^6.2.3 | Firma/verificación JWT (cookie httpOnly) |
| `@auth0/nextjs-auth0` | ^4.25.0 | Previsto para migración a Auth0 (no integrado aún) |

### 2.4 UI / UX

| Paquete | Versión | Uso |
|---|---|---|
| `@nrivera-iimp/ui-kit-iimp` | ^0.1.16 | Design system IIMP (shadcn/ui) — **obligatorio** |
| `tailwindcss` | ^4 | Utility-first CSS |
| `lucide-react` | ^0.577.0 | Iconografía |
| `framer-motion` | ^12.42.2 | Animaciones (páginas de error 403/404/500) |
| `recharts` | ^3.9.2 | Gráficos del dashboard |
| `sonner` | ^2.0.7 | Notificaciones toast |
| `next-themes` | ^0.4.6 | Tema claro/oscuro |
| `clsx` + `tailwind-merge` | ^2.1.1 / ^3.6.0 | Composición de clases |
| `react-quill-new` | ^3.8.3 | Editor WYSIWYG (notificaciones personalizadas) |

### 2.5 3D (plano isométrico)

| Paquete | Versión | Uso |
|---|---|---|
| `three` | ^0.185.1 | Motor 3D |
| `@react-three/fiber` | ^9.6.1 | Renderer React para Three.js |
| `@react-three/drei` | ^10.7.7 | Helpers 3D (cámaras, controles, geometrías) |

### 2.6 Formularios y validación

| Paquete | Versión | Uso |
|---|---|---|
| `react-hook-form` | ^7.81.0 | Manejo de formularios |
| `zod` | ^4.4.3 | Validación de esquemas (backend y frontend) |

### 2.7 Utilidades

| Paquete | Versión | Uso |
|---|---|---|
| `dotenv` | ^17.4.2 | Carga de variables de entorno (Prisma config) |
| `client-only` / `server-only` | ^0.0.1 | Guardas de importación por capa |

---

## 3. Dependencias de desarrollo

| Paquete | Versión | Uso |
|---|---|---|
| `prisma` | ^7.8.0 | CLI (generate, db push, migrate, studio) |
| `tsx` | ^4.19.0 | Ejecución TypeScript (seed) |
| `eslint` + `eslint-config-next` | ^9 / 16.2.10 | Linting (flat config) |
| `@tailwindcss/postcss` | ^4 | PostCSS para Tailwind v4 |
| `vitest` | ^3 (config presente) | Testing (sin specs aún) |
| `@types/*` | — | Tipos Node/React/pg |

---

## 4. Scripts npm

| Script | Comando | Propósito |
|---|---|---|
| `dev` | `next dev` | Servidor de desarrollo (Turbopack) |
| `build` | `next build` | Build de producción |
| `start` | `next start` | Servidor de producción |
| `lint` | `eslint` | Linting |
| `db:push` | `prisma db push` | Sincronizar schema → BD (sin migración) |
| `db:migrate` | `prisma migrate dev` | Crear/aplicar migraciones (dev) |
| `db:migrate:deploy` | `prisma migrate deploy` | Aplicar migraciones (producción) |
| `db:seed` | `tsx prisma/seed.ts` | Poblar datos iniciales |
| `db:studio` | `prisma studio` | Explorador visual de BD |
| `db:generate` | `prisma generate` | Regenerar cliente Prisma |
| `clean` | borra `.next` + `prisma generate` | Limpieza de caché |
| `db:reset` | borra `.next` + `db push --accept-data-loss` + seed | Reset completo de BD dev |

---

## 5. Configuraciones clave

### 5.1 `tsconfig.json`

- `strict: true`, `noEmit: true`.
- Alias de paths: `@/*` → `./src/*`.
- `moduleResolution: "bundler"`, `jsx: "react-jsx"`, target `ES2017`.

### 5.2 `next.config.ts`

- `turbopack.root` explícito.
- Alias webpack de `tailwindcss` para compatibilidad con el UI Kit.
- `images.remotePatterns`: `ui-avatars.com`, `images.unsplash.com`, `i.pravatar.cc`, `api.qrserver.com`, `secure2.iimp.org:8443/QRGeneratorApp/**`.
- Rewrite `/api/proxy/:path*` → `NEXT_PUBLIC_API_DOMAIN` + `NEXT_PUBLIC_API_BASE_PATH`.

### 5.3 `tailwind.config.ts`

- Preset `iimpPreset` de `@nrivera-iimp/ui-kit-iimp/preset` (colores, animaciones, theming).
- Content: `./src/**/*.{ts,tsx}` + `dist` del UI Kit.

### 5.4 `vitest.config.ts`

- Entorno `node`, `globals: true`, alias `@` → `./src`.
- Sin setup files ni coverage (pendiente de configurar specs).

### 5.5 `eslint.config.mjs`

- Flat config: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`.
- Ignora `.next/**`, `out/**`, `build/**`, `next-env.d.ts`.

---

## 6. Notas para el proveedor

1. **Next.js 16 tiene breaking changes** respecto a versiones anteriores (APIs async, `"use cache"`, Turbopack). Revisar `node_modules/next/dist/docs/` antes de codificar — está indicado en `AGENTS.md`.
2. **El UI Kit es obligatorio**: no usar HTML puro para controles; usar los componentes de `@nrivera-iimp/ui-kit-iimp`.
3. **Cero errores de TypeScript/ESLint** es requisito de despliegue (pipeline ZERO ERRORS).
4. **Prisma v7** usa `prisma.config.ts` (estilo nuevo) y driver adapters (`@prisma/adapter-pg`).
5. La carpeta `.opencode/` contiene las reglas y skills del proyecto (arquitectura hexagonal, constantes, DTOs, etc.) — ver documento 12.
