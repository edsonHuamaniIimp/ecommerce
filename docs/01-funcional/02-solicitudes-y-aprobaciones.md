# Solicitudes de alquiler y aprobaciones

> Fuente: `src/app/(dashboard)/dashboard/{solicitudes,mis-solicitudes,reservas}/**`,
> `src/components/solicitudes/**`, `src/app/api/solicitudes/**`, `src/application/solicitudes/**`,
> `src/infrastructure/persistence/solicitudes-repository.ts`.

## 1. Propósito

Gestionar el ciclo de vida de una reserva: bandeja de revisión por áreas, re-evaluación
del cliente, notificación y orden de pago. La unidad de datos es `Solicitud`, con
`Revision`, `RevisionHistorial`, `Reevaluacion`, `SolicitudDocumento`, `SolicitudStand` y
`Facturacion` (`prisma/schema.prisma:218-508`).

## 2. Roles y permisos

| Permiso | Constante | Quién |
|---|---|---|
| `solicitudes:view` | `SOLICITUDES_VIEW` | todos los roles |
| `solicitudes:review:logistica` | `SOLICITUDES_REVIEW_LOGISTICA` | admin, logistica |
| `solicitudes:review:comunicacion` | `SOLICITUDES_REVIEW_COMUNICACION` | admin, comunicacion |
| `solicitudes:review:legal` | `SOLICITUDES_REVIEW_LEGAL` | admin, legal (legacy) |
| `solicitudes:notify` | `SOLICITUDES_NOTIFY` | admin |
| `solicitudes:upload` | `SOLICITUDES_UPLOAD` | admin |

## 3. Pantallas

| Página | Componente | Para quién | Datos |
|---|---|---|---|
| `/dashboard/solicitudes` | `SolicitudesManager` | Admin y áreas (bandeja) | `GET /api/solicitudes/listar?eventoId=` |
| `/dashboard/mis-solicitudes` | `MisSolicitudesManager` | Cliente | mismo endpoint con `userId` propio |
| `/dashboard/reservas` | `ReservasManager` | Vista informativa (legacy) | `GET /api/gess/listar?estado=en_evaluacion` |

`/dashboard/reservas` lista **stands GESS**, no solicitudes; es distinta de la bandeja.

## 4. Flujo de revisión

Orden local vigente: **Logística → Comunicación**. La revisión **Legal ya no es local**:
se delega al SGC como su `internal-review` (`constants.ts:346-376,684-688`).

1. **Creación** (desde el plano): se crean revisiones `pendiente` por área local y se alerta a Logística (`reserva-service.ts:57-68`).
2. **Logística** responde (`POST /api/solicitudes/revisar` con `{solicitudId, area, estado, comentario?}`). Al finalizar, se alerta al siguiente rol (Comunicación).
3. **Comunicación** (última área local):
   - Aprueba → se **crea el expediente en el SGC** (`solicitudes-service.ts:43-45`) y se alerta al admin ("Revisión completada").
   - Rechaza → se alerta al admin; no se crea expediente SGC.
4. **Legal (SGC)**: se ejecuta en el sistema externo; el webhook actualiza la correlación local (ver [08-integraciones.md](./08-integraciones.md)).
5. **Estado de la solicitud** se calcula según las revisiones (ver §5).
6. **Orden de pago**: con todo aprobado, "Generar orden de pago" pasa la solicitud a `pendiente_pago` y crea `Facturacion` (`solicitudes-repository.ts:378-400`).
7. **Pago**: al confirmarse todas las cuotas, la solicitud pasa a `pagado` (ver [04-facturacion.md](./04-facturacion.md)).

Navegación **lineal**: no se avanza de paso si el anterior sigue `pendiente` (`solicitud-review.tsx:153-161`). El stepper muestra un paso extra **"Legal (SGC)"** no clickeable.

### 4.1 Re-evaluación (cliente)

- Visible si la solicitud está `rechazado`, activa y sin re-evaluación pendiente (`mis-solicitudes-manager.tsx:35-39`).
- `POST /api/solicitudes/reevaluar` crea `Reevaluacion { pendiente, motivo, documentos }` (409 si ya existe una pendiente).
- **Atender (admin, `solicitudes:notify`)** (`POST /api/solicitudes/atender-reevaluacion`, `{reevaluacionId, accion}`):
  - `aprobar`: archiva historial, resetea todas las revisiones a `pendiente`, copia documentos.
  - `rechazar`: marca la re-evaluación `rechazado`, libera los stands a `disponible` y **elimina las revisiones**.

### 4.2 Notificación al cliente

`POST /api/solicitudes/notificar` exige `solicitudes:notify` + `hasDBPermission` y **bloquea con 409 si alguna área local sigue pendiente** (`solicitudes.controller.ts:48-85`). Construye el correo con `buildRevisionEmail` (modo automático o personalizado).

## 5. Estados y transiciones

`ESTADOS_SOLICITUD` (`constants.ts:423-432`). El estado se **calcula al vuelo** desde las revisiones, salvo `pendiente_pago` y `pagado` que se persisten (`solicitudes-repository.ts:47-62,153`).

| De | A | Disparador | Quién |
|---|---|---|---|
| `disponible` (stand) | `en_evaluacion` | Crear solicitud | Cliente |
| `pendiente` | `en_proceso` | Primera revisión | Área |
| `en_proceso` | `aprobado` | Todas aprueban | Áreas |
| `en_proceso` | `rechazado` | Alguna rechaza | Áreas |
| `rechazado` | `pendiente` (reset) | Re-evaluación aprobada | Admin |
| `rechazado` | `disponible` (stand) | Re-evaluación rechazada | Admin |
| `rechazado` | baja lógica | Dar de baja | Admin |
| `aprobado` | `pendiente_pago` | Generar orden de pago | Admin |
| `pendiente_pago` | `pagado` | Confirmación de pago | Facturación |

## 6. Endpoints

| Método | Ruta | Acción |
|---|---|---|
| `GET` | `/api/solicitudes/listar` | Lista paginada (`eventoId`, `page`, `per_page`, `search`, `userId`) |
| `GET` | `/api/solicitudes/detalle?id=` | Detalle |
| `GET` | `/api/solicitudes/historial?id=` | Historial de revisiones |
| `POST` | `/api/solicitudes/revisar` | Registrar revisión de área |
| `POST` | `/api/solicitudes/notificar` | Correo al cliente (`solicitudes:notify` + BD) |
| `POST` | `/api/solicitudes/reevaluar` | Crear re-evaluación |
| `POST` | `/api/solicitudes/atender-reevaluacion` | Aprobar/rechazar re-evaluación |
| `POST` | `/api/solicitudes/baja` | Baja lógica |
| `POST` | `/api/solicitudes/orden-pago` | Generar facturación + `pendiente_pago` |
| `POST` | `/api/solicitudes/modificar` | Resetear revisiones (**sin uso en el cliente**) |
| `POST` | `/api/solicitudes/upload-doc` · `/eliminar-doc` | Documentos de la solicitud |

Alertas (campana): `GET /api/alertas/listar`, `POST /api/alertas/marcar-leida`, `POST /api/alertas/marcar-todas-leidas`. Se generan al crear la solicitud, al completar una revisión (siguiente rol) y al terminar todas (admin). Polling cada 30 s.

## 7. Reglas de negocio

- Revisión lineal; "Siguiente" se habilita cuando el área actual ya no está pendiente.
- Rechazo exige justificación (UI).
- Multi-stand exige documento del admin **y** del cliente para habilitar la revisión (`solicitudes-manager.tsx:32-36`).
- Notificación bloqueada mientras haya revisiones locales pendientes.
- Dar de baja = baja lógica (`flgActivo=false`) + libera stands.

## 8. Limitaciones y observaciones

- **Permisos de revisión solo en UI**: `POST /api/solicitudes/revisar` solo exige sesión (`solicitudes.controller.ts:41-46`), no `solicitudes:review:*`. Corroborado por `../07-seguridad` (run 1).
- **Sin scoping de dueño**: `detalle`/`historial` no validan propietario; un `cliente` con `solicitudes:view` podría leer solicitudes ajenas.
- **`orden-pago`, `reevaluar` y `upload-doc` sin permiso específico** (solo sesión).
- **Dashboard desconectado del pipeline**: `dashboard/page.tsx:49,53` pasa `reservas={[]}`; la card "Flujo de Aprobaciones" usa el modelo legacy `Reserva`/`Aprobacion` y siempre sale vacía.
- **Notificación no automática al aprobar**: el endpoint lo permite, pero la UI solo muestra el botón en estado `rechazado` (`solicitudes-manager.tsx:443`).
- **`POST /api/solicitudes/modificar` sin uso** en el frontend (legacy).
- **Strings no constantizados** en `motivo` de `RevisionHistorial` (`solicitudes-repository.ts:248,333`), contra la regla `constants-first`.
- **`darDeBaja` no cambia `estado`**; solo `flgActivo`.
