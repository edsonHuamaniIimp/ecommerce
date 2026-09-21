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

Login de prueba (seed): `admin@iimp.org.pe` (ver `docs/02-despliegue/despliegue.md` para el resto).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 + UI Kit IIMP ·
PostgreSQL 16 + Prisma v7 · JWT (`jose`) · Three.js (plano isométrico) ·
Resend (correo) · Docker + GitHub Actions.

## Arquitectura

Arquitectura **hexagonal** en backend (`domain` / `application` /
`infrastructure` / `controllers`), fachada de servicios + DTO/Mapper en
frontend. Detalle en [`docs/03-arquitectura/arquitectura.md`](./docs/03-arquitectura/arquitectura.md).

## Documentación del proyecto (`docs/`)

Índice completo en [`docs/README.md`](./docs/README.md). Documentos agrupados por contexto:

| Grupo | Documento | Contenido |
|---|---|---|
| Inicio | [00-inicio/resumen-ejecutivo.md](./docs/00-inicio/resumen-ejecutivo.md) | Resumen, alcance, estado y traspaso |
| Inicio | [00-inicio/requerimientos.md](./docs/00-inicio/requerimientos.md) | Requerimientos funcionales y no funcionales |
| Inicio | [00-inicio/flujos.md](./docs/00-inicio/flujos.md) | Flujos de negocio detallados |
| Funcional | [01-funcional/README.md](./docs/01-funcional/README.md) | Funcionalidad implementada por módulo (visión, roles, flujos) |
| Despliegue | [02-despliegue/despliegue.md](./docs/02-despliegue/despliegue.md) | Despliegue por ambiente (EC2+Compose / ECS+Terraform) |
| Despliegue | [02-despliegue/arquitectura-aws.md](./docs/02-despliegue/arquitectura-aws.md) | Decisión de arquitectura AWS |
| Despliegue | [02-despliegue/aws-terraform.md](./docs/02-despliegue/aws-terraform.md) | Terraform + convención de tags |
| Despliegue | [02-despliegue/REGLAS-DESPLIEGUE.md](./docs/02-despliegue/REGLAS-DESPLIEGUE.md) | Reglas de gobernanza (R1-R6) |
| Arquitectura | [03-arquitectura/arquitectura.md](./docs/03-arquitectura/arquitectura.md) | Estructura completa del código |
| Arquitectura | [03-arquitectura/stack-tecnologico.md](./docs/03-arquitectura/stack-tecnologico.md) | Dependencias y versiones |
| Arquitectura | [03-arquitectura/modelo-datos.md](./docs/03-arquitectura/modelo-datos.md) | Modelo de datos (ER + diccionario) |
| Arquitectura | [03-arquitectura/convenciones-codigo.md](./docs/03-arquitectura/convenciones-codigo.md) | Reglas y estándares obligatorios |
| API | [04-api/api-inventario.md](./docs/04-api/api-inventario.md) | Inventario real de endpoints |
| API | [04-api/endpoints.md](./docs/04-api/endpoints.md) | Contrato de API propuesto |
| API | [04-api/openapi.yaml](./docs/04-api/openapi.yaml) | Especificación OpenAPI 3.0 |
| Integraciones | [05-integraciones/integracion-sgc.md](./docs/05-integraciones/integracion-sgc.md) | Integración con el SGC |
| Integraciones | [05-integraciones/api-sistema-montaje.md](./docs/05-integraciones/api-sistema-montaje.md) | API consumida por el Sistema de Montaje |
| Integraciones | [05-integraciones/guia-consumo-servicio-persona.md](./docs/05-integraciones/guia-consumo-servicio-persona.md) | Guía del servicio-persona (externo) |
| Operación | [06-operacion/infraestructura-devops.md](./docs/06-operacion/infraestructura-devops.md) | Docker, CI/CD y variables |
| Operación | [06-operacion/pruebas-produccion.md](./docs/06-operacion/pruebas-produccion.md) | Data de prueba aislada en producción |
| Seguridad | [07-seguridad/](./docs/07-seguridad) | Auditoría de seguridad (run 1 y run 2) |

## Calidad (pipeline ZERO ERRORS)

```bash
npx tsc --noEmit   # tipos
npx eslint         # lint
```

> Antes de escribir código, revisar `AGENTS.md` y las reglas de `.opencode/reglas/`
> (Next.js 16 tiene breaking changes: consultar `node_modules/next/dist/docs/`).
