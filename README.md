# ContratosStands — IIMP

Sistema web de **reserva de stands** para los eventos corporativos del
**Instituto de Ingenieros de Minas del Perú (IIMP)**: PERUMIN, ProExplo,
World Mining Congress (WMC) y GESS.

> **Documentación completa:** ver la carpeta [`docs/`](./docs) y el portal en
> Confluence: `https://iimp-team-ejhn.atlassian.net/wiki/spaces/CTRS`
> (publicado con `node scripts/publish-confluence.mjs --space CTRS`).

## Inicio rápido (desarrollo)

Requisitos: **Node.js 20+**, **Docker** (para PostgreSQL) y Git.

```bash
git clone <repo>
cd ContratosStands
cp .env.example .env
npm install
docker compose up -d        # PostgreSQL 16 en localhost:5433
npm run db:push             # Crear/actualizar tablas
npm run db:seed             # Datos iniciales (roles, usuarios, maestra)
npm run dev                 # http://localhost:3000
```

Login de prueba (seed): `admin@iimp.org.pe` (ver `docs/despliegue.md` para el resto).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 + UI Kit IIMP ·
PostgreSQL 16 + Prisma v7 · JWT (`jose`) · Three.js (plano isométrico) ·
Resend (correo) · Docker + GitHub Actions.

## Arquitectura

Arquitectura **hexagonal** en backend (`domain` / `application` /
`infrastructure` / `controllers`), fachada de servicios + DTO/Mapper en
frontend. Detalle en [`docs/arquitectura.md`](./docs/arquitectura.md).

## Documentación del proyecto (`docs/`)

| Documento | Contenido |
|---|---|
| [resumen-ejecutivo.md](./docs/resumen-ejecutivo.md) | Resumen, alcance, estado y traspaso |
| [requerimientos.md](./docs/requerimientos.md) | Requerimientos funcionales y no funcionales |
| [arquitectura.md](./docs/arquitectura.md) | Estructura completa del código |
| [stack-tecnologico.md](./docs/stack-tecnologico.md) | Dependencias y versiones |
| [modelo-datos.md](./docs/modelo-datos.md) | Modelo de datos (ER + diccionario) |
| [api-inventario.md](./docs/api-inventario.md) | Inventario real de endpoints |
| [endpoints.md](./docs/endpoints.md) | Contrato de API propuesto |
| [openapi.yaml](./docs/openapi.yaml) | Especificación OpenAPI 3.0 |
| [flujos.md](./docs/flujos.md) | Flujos de negocio detallados |
| [api-sistema-montaje.md](./docs/api-sistema-montaje.md) | Integración sistema de montaje |
| [GUIA-CONSUMO.md](./docs/GUIA-CONSUMO.md) | Guía del servicio-persona (externo) |
| [infraestructura-devops.md](./docs/infraestructura-devops.md) | Docker, CI/CD y variables |
| [despliegue.md](./docs/despliegue.md) | Guía de despliegue por ambiente |
| [convenciones-codigo.md](./docs/convenciones-codigo.md) | Reglas y estándares obligatorios |

## Calidad (pipeline ZERO ERRORS)

```bash
npx tsc --noEmit   # tipos
npx eslint         # lint
```

> Antes de escribir código, revisar `AGENTS.md` y las reglas de `.opencode/reglas/`
> (Next.js 16 tiene breaking changes: consultar `node_modules/next/dist/docs/`).
