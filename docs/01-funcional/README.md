# Documentación funcional — ContratosStands

Describe la **funcionalidad implementada y verificada en el código** del sistema de
reserva de stands del IIMP. Cada documento lista propósito, roles/permisos, rutas,
endpoints, flujos, estados, reglas de negocio y limitaciones observadas.

> Alcance: lo que existe hoy en el repositorio. Lo **no implementado** o dudoso se marca
> explícitamente como *limitación*. Para el diseño/requerimientos originales ver
> [`../00-inicio/requerimientos.md`](../00-inicio/requerimientos.md) y
> [`../00-inicio/flujos.md`](../00-inicio/flujos.md).

## Mapa de módulos

| # | Módulo | Documento | Página principal | Permiso |
|---|---|---|---|---|
| 1 | Portal público, plano y reserva | [01-publico-y-reservas.md](./01-publico-y-reservas.md) | `/`, `/presala`, `/plano`, `/mapa`, `/plano-grid` | público + `stands:plano` |
| 2 | Solicitudes de alquiler y aprobaciones | [02-solicitudes-y-aprobaciones.md](./02-solicitudes-y-aprobaciones.md) | `/dashboard/solicitudes`, `/dashboard/mis-solicitudes`, `/dashboard/reservas` | `solicitudes:view` |
| 3 | Auspicios | [03-auspicios.md](./03-auspicios.md) | `/dashboard/auspicios` | `auspicios:view` |
| 4 | Facturación y pagos | [04-facturacion.md](./04-facturacion.md) | `/dashboard/facturacion` | `facturacion:view` |
| 5 | Laboratorio 3D (planos) | [05-laboratorio-3d.md](./05-laboratorio-3d.md) | `/dashboard/laboratorio` | `laboratorio:view` / `laboratorio:manage` |
| 6 | Eventos, datos del evento y stands | [06-eventos-datos-y-stands.md](./06-eventos-datos-y-stands.md) | `/dashboard/eventos`, `/dashboard/datos-evento`, `/dashboard/stands`, `/dashboard/vinculacion` | `events:manage`, `eventos:datos`, `stands:manage`, `stands:vinculacion` |
| 7 | Administración (roles, usuarios, perfil) | [07-administracion.md](./07-administracion.md) | `/dashboard/roles`, `/dashboard/perfil` | `roles:manage` |
| 8 | Integraciones externas y autenticación | [08-integraciones.md](./08-integraciones.md) | — | varias |

## Actores y roles

Roles definidos en `src/lib/shared/constants.ts:195-201`:

| Rol | Descripción | Permisos principales |
|---|---|---|
| `admin` | Acceso total (`admin:full`, bypass en `hasPermission`) | todo |
| `logistica` | Revisa solicitudes (área Logística) y gestiona stands | `dashboard:view`, `stands:manage`, `stands:plano`, `solicitudes:review:logistica`, `auspicios:view` |
| `legal` | Revisa solicitudes (área Legal) | `dashboard:view`, `stands:plano`, `solicitudes:review:legal`, `auspicios:view` |
| `comunicacion` | Revisa solicitudes (área Comunicación, última local) | `dashboard:view`, `stands:plano`, `solicitudes:review:comunicacion`, `auspicios:view` |
| `cliente` | Empresa exhibidora: reserva, consulta sus solicitudes y paga | `eventos:datos`, `solicitudes:view`, `stands:plano`, `read:reservas`, `write:reservas` |

Matriz completa en `ROLES_PERMISSIONS` (`src/lib/shared/constants.ts:205-235`) y catálogo de
permisos en `ALL_PERMISSIONS` (`:237-273`). El permiso viaja en el JWT; el rol `admin`
siempre pasa (`src/lib/server/auth.ts:106-108`).

> **Nota (limitación)**: `facturacion:view` y `laboratorio:manage` no están asignados a
> ningún rol no-admin en `ROLES_PERMISSIONS`; hoy solo `admin` los ejerce (por bypass).

## Estados globales

| Dominio | Constante | Valores | Archivo |
|---|---|---|---|
| Stand | `ESTADOS_STAND` | `disponible`, `en_evaluacion`, `reservado` | `constants.ts:75-79` |
| Evento | `ESTADOS_EVENTO` | `draft`, `active`, `closed`, `cancelled` | `constants.ts:149-154` |
| Solicitud | `ESTADOS_SOLICITUD` | `pendiente`, `en_proceso`, `aprobado`, `rechazado`, `pendiente_pago`, `pagado` | `constants.ts:423-432` |
| Revisión (por área) | `ESTADOS_REVISION` | `pendiente`, `aprobado`, `rechazado` | `constants.ts:446-452` |
| Re-evaluación | `ESTADOS_REEVALUACION` | `pendiente`, `aprobado`, `rechazado` | `constants.ts:463-469` |
| Facturación | `ESTADOS_FACTURACION` | `pendiente`, `pagado`, `archivado`, `cancelado`* | `constants.ts:387-393` |
| Cuota | `ESTADOS_CUOTA` | `pendiente`, `pagado`, `vencido`* | `constants.ts:395-399` |
| SGC (envío) | `SGC_ESTADO_ENVIO` | `pendiente`, `creado`, `error` | `constants.ts:661-667` |

\* `cancelado` (facturación) y `vencido` (cuota) están declarados pero **no se usan** en
transiciones (ver [04-facturacion.md](./04-facturacion.md)).

## Convención de documentos

Cada módulo documenta:
1. **Propósito** — qué resuelve.
2. **Roles y permisos** — quién puede usarlo.
3. **Rutas y endpoints** — páginas y API.
4. **Flujo funcional** — paso a paso.
5. **Estados y transiciones**.
6. **Reglas de negocio**.
7. **Limitaciones y observaciones** — mocks, código muerto, riesgos funcionales.
