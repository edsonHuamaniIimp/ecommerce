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
| `solicitudes:view` | `SOLICITUDES_VIEW` | staff: admin, asociado, legal (bandeja) |
| `mis-reservas:view` | `MIS_RESERVAS_VIEW` | cliente (sus propias solicitudes; el proxy acepta este permiso para `/api/solicitudes`) |
| `solicitudes:review:asociado` | `SOLICITUDES_REVIEW_ASOCIADO` | admin, asociado (nivel "Asociado", previo a Legal; RF-14/15) |
| `solicitudes:review:legal` | `SOLICITUDES_REVIEW_LEGAL` | admin, legal (legacy) |
| `solicitudes:notify` | `SOLICITUDES_NOTIFY` | admin |
| `solicitudes:upload` | `SOLICITUDES_UPLOAD` | admin |

La observación de documentos se detalla en
[12-observacion-documentos.md](./12-observacion-documentos.md).

## 3. Pantallas

| Página | Componente | Para quién | Datos |
|---|---|---|---|
| `/dashboard/solicitudes` | `SolicitudesManager` | Admin y áreas (bandeja) | `GET /api/solicitudes/listar?eventoId=` |
| `/dashboard/mis-solicitudes` | `MisSolicitudesManager` | Cliente | mismo endpoint con `userId` propio |
| `/dashboard/reservas` | `ReservasManager` | Vista informativa (legacy) | `GET /api/gess/listar?estado=en_evaluacion` |

`/dashboard/reservas` lista **stands GESS**, no solicitudes; es distinta de la bandeja.

## 4. Flujo de revisión

Pipeline local: **Asociado → Legal (SGC)**. "Asociado" **unifica Logística + Comunicación**
(RF-14/15). La revisión **Legal no es local**: se delega al SGC como su `internal-review`.

1. **Creación** (desde el plano): se crea la revisión `pendiente` del nivel local (Asociado) y se alerta a los revisores (`reserva-service.ts:84-95`).
2. **Asociado** responde (`POST /api/solicitudes/revisar` con `{solicitudId, area, estado, comentario?}`):
   - Aprueba → se **crea el expediente en el SGC y se envía automáticamente** (contrato + anexos → revisión, `solicitudes-service.ts` → `enviarExpedienteAlSgc`) y se alerta al admin ("Revisión completada"). Best-effort: si el SGC falla, el cron reintenta.
   - Rechaza → se alerta al admin; no se crea expediente SGC.
3. **Legal (SGC)**: se ejecuta en el sistema externo; el webhook actualiza la correlación local (ver [08-integraciones.md](./08-integraciones.md)). Al **aprobar** (contrato Vigente o cerrado) la solicitud pasa **automáticamente a `pendiente_pago`** con su orden/facturación (webhook, sincronización al abrir el detalle o cron; idempotente). Si el SGC **rechaza**, el admin declara la indicación y el modo (contrato nuevo o el mismo): con contrato corregido **generado** el cliente puede **firmar digitalmente** desde Mis solicitudes, con un **PDF personalizado** descarga y adjunta su firmado; luego el admin reenvía al SGC.
4. **Estado de la solicitud** se calcula según las revisiones (ver §5).
5. **Orden de pago**: "Generar orden de pago" (o el pase automático desde el SGC) deja la solicitud en `pendiente_pago` y crea `Facturacion` (`solicitudes-repository.ts:378-400`). El **Bypass admin** mantiene la aprobación manual de Legal (SGC) sin esperar al SGC.
6. **Pago**: al confirmarse todas las cuotas, la solicitud pasa a `pagado` (ver [04-facturacion.md](./04-facturacion.md)).

Navegación **lineal**: no se avanza de paso si el anterior sigue `pendiente` (`solicitud-review.tsx:153-161`). El stepper muestra un paso extra **"Legal (SGC)"** no clickeable.

### 4.1 Re-evaluación (cliente)

- Visible si la solicitud está `rechazado`, activa y sin re-evaluación pendiente (`mis-solicitudes-manager.tsx:35-39`).
- `POST /api/solicitudes/reevaluar` crea `Reevaluacion { pendiente, motivo, documentos }` (409 si ya existe una pendiente).
- **Atender (admin, `solicitudes:notify`)** (`POST /api/solicitudes/atender-reevaluacion`, `{reevaluacionId, accion}`):
  - `aprobar`: archiva historial, resetea todas las revisiones a `pendiente`, copia documentos.
  - `rechazar`: marca la re-evaluación `rechazado`, libera los stands a `disponible` y **elimina las revisiones**.

### 4.2 Notificación al cliente

`POST /api/solicitudes/notificar` exige `solicitudes:notify` + `hasDBPermission` y **bloquea con 409 si alguna área local sigue pendiente** (`solicitudes.controller.ts:48-85`). Construye el correo con `buildRevisionEmail` (modo automático o personalizado).

### 4.3 Observación de documentos (Asociado)

- El revisor **Asociado** puede observar uno o varios documentos **vigentes subidos por el cliente**, con justificación obligatoria. El contrato del administrador es solo lectura y no se observa.
- La solicitud pasa a `observado`; el cliente ve el motivo y subsana desde Mis solicitudes subiendo nuevas versiones o firmando el contrato corregido.
- `POST /api/solicitudes/reenviar-observacion` exige que **todos** los observados tengan reemplazo vigente y, si se observó el firmado, uno posterior al contrato vigente del administrador.
- El ciclo puede repetirse N veces. Solo la **iteración actual** permite dar de baja documentos; las versiones anteriores quedan como historial y nunca se envían al SGC.
- Detalle completo: [12-observacion-documentos.md](./12-observacion-documentos.md).

## 5. Estados y transiciones

`ESTADOS_SOLICITUD` (`constants.ts:423-432`). El estado se **calcula al vuelo** desde las revisiones, salvo `pendiente_pago` y `pagado` que se persisten (`solicitudes-repository.ts:47-62,153`).

| De | A | Disparador | Quién |
|---|---|---|---|
| `disponible` (stand) | `en_evaluacion` | Crear solicitud | Cliente |
| `pendiente` | `en_proceso` | Primera revisión | Área |
| `en_proceso` | `aprobado` | Todas aprueban | Áreas |
| `en_proceso` | `observado` | Asociado observa documentos del cliente | Asociado |
| `observado` | `en_proceso` | Cliente reenvía tras subsanar | Cliente |
| `en_proceso` | `rechazado` | Alguna rechaza | Áreas |
| `rechazado` | `pendiente` (reset) | Re-evaluación aprobada | Admin |
| `rechazado` | `disponible` (stand) | Re-evaluación rechazada | Admin |
| `rechazado` | baja lógica | Dar de baja | Admin |
| `aprobado` | `pendiente_pago` | Generar orden de pago | Admin |
| `pendiente_pago` | `pagado` | Confirmación de pago | Facturación |

Estados de documento (`solicitud_documento.estado`): `activo`, `observado`, `reemplazado`
y `baja`. Solo `activo` cuenta para la revisión y para el envío al SGC; los estados son
lógicos y nunca eliminan el archivo ni la fila.

## 6. Endpoints

| Método | Ruta | Acción |
|---|---|---|
| `GET` | `/api/solicitudes/listar` | Lista paginada (`eventoId`, `page`, `per_page`, `search`, `userId`) |
| `GET` | `/api/solicitudes/detalle?id=` | Detalle |
| `GET` | `/api/solicitudes/historial?id=` | Historial de revisiones |
| `POST` | `/api/solicitudes/revisar` | Registrar revisión de área; body incluye `documentosObservados[]` si `estado=observado` |
| `POST` | `/api/solicitudes/reenviar-observacion` | Cliente reenvía la solicitud tras subsanar |
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

- **Permisos de revisión validados en el borde HTTP**: `POST /api/solicitudes/revisar` exige el permiso del área (`REVISION_AREA_PERMISSIONS`) o `admin:full`.
- **Scoping de dueño implementado**: `listar`, `detalle` e `historial` limitan al cliente a sus solicitudes; `upload-doc`, `eliminar-doc` y `reenviar-observacion` validan titularidad en el servicio. Staff con `solicitudes:gestion`/`notify`/`admin:full` puede ver todas.
- **`reevaluar` valida titular** y `orden-pago` exige `facturacion:view`, `solicitudes:notify` o `admin:full`.
- **Contrato del admin no observable**: la observación aplica solo a documentos del cliente (`user_id` no nulo); las correcciones del contrato las hace el admin.
- **Documentos legacy del JSON `solicitud.documentos`** no tienen ID de fila y no se pueden observar individualmente; se conservan por compatibilidad.
- **Dashboard desconectado del pipeline**: `dashboard/page.tsx:49,53` pasa `reservas={[]}`; la card "Flujo de Aprobaciones" usa el modelo legacy `Reserva`/`Aprobacion` y siempre sale vacía.
- **Notificación no automática al aprobar**: el endpoint lo permite, pero la UI solo muestra el botón en estado `rechazado` (`solicitudes-manager.tsx:443`).
- **`POST /api/solicitudes/modificar` sin uso** en el frontend (legacy).
- **Strings no constantizados** en `motivo` de `RevisionHistorial` (`solicitudes-repository.ts:248,333`), contra la regla `constants-first`.
- **`darDeBaja` no cambia `estado`**; solo `flgActivo`.
