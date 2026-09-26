# IntegraciÃ³n con el SGC (Sistema de GestiÃ³n de Contratos)

> Estado: **implementado y desplegado** (la app apunta al SGC **QA**). Ver la
> "ActualizaciÃ³n guÃ­a v2" mÃ¡s abajo. Rol de ContratosStands: **cliente (consumidor)** de la
> API de integraciÃ³n del SGC. Documento guÃ­a de referencia: `APIS_USE_HOOKS.md`
> (provisto por el equipo del SGC); referencia tÃ©cnica canÃ³nica del SGC:
> `docs/INTEGRATIONS.md` (en el repo del SGC).
>
> Avance: **Fases 0, 1 y 2 completadas**.
> Fase 0: constantes SGC_*, contratos de la API externa en `src/domain/models/sgc.ts`,
> puertos, adaptador mock, config de env, wiring y tests.
> Fase 1: modelos Prisma `SgcExpediente`/`SgcDocumento`, repositorio, mapper
> (`src/lib/shared/mappers/sgc.ts`), servicio `SgcIntegracionApplicationService` y disparo
> al aprobar **ComunicaciÃ³n** (`SolicitudApplicationService.revisar`; la revisiÃ³n Legal se
> delega al SGC). Best-effort: un fallo del SGC se registra (`estadoEnvio=error`) y nunca
> bloquea la aprobaciÃ³n. Dormido hasta `SGC_ENABLED=1`.
> Fase 2: subida en 3 fases (`reservar â†’ transferir â†’ confirmar`) con checksum SHA-256,
> puerto `IDocumentoOrigen` + adaptador (`documento-origen.ts`) y `subirAnexosDeSolicitud`.
> El origen del **contrato v1** (categorÃ­a `contract`) aÃºn no estÃ¡ definido (decisiÃ³n Â§13.5);
> `subirPiezaDocumental`/`subirDocumentoDesdeUrl` quedan listos para conectarlo.
> Fase 3: `consultarExpediente` (sincroniza stage/lifecycle/version) + `GET /api/sgc/detalle`
> (protegido con `solicitudes:view`), fachada `sgcService`, hook `useSgcExpediente` y panel
> `SgcExpedientePanel` (stepper + historial) en el detalle de la solicitud.
> Fase 4: webhooks â€” `POST /api/integracion/sgc/webhook` (pÃºblico, runtime Node) con
> verificaciÃ³n HMAC-SHA256 (`timingSafeEqual` propio + ventana de tolerancia), inbox
> idempotente `SgcWebhookEvento`, procesamiento por tipo de evento y `reconciliar()` /
> `POST /api/sgc/sincronizar` como fallback de polling.
> Fase 5: `obtenerDescargaContrato` (`GET /api/sgc/descarga`) con botÃ³n en el panel,
> y `subsanarContrato` (`POST /api/sgc/subsanar`) que reemplaza la versiÃ³n sobre el mismo
> `documentId`.
> Fase 6: documentaciÃ³n (`docs/04-api/openapi.yaml` con los endpoints SGC, `docs/03-arquitectura/modelo-datos.md`
> con `sgc_expediente`/`sgc_documento`/`sgc_webhook_evento`), revisiÃ³n de seguridad y
> checklist pre-merge. Se corrigiÃ³ ademÃ¡s una indentaciÃ³n YAML preexistente en `openapi.yaml`.
> Estado del repo: `npx tsc --noEmit` y `npx eslint` en **0 errores** (regla innegociable).
> Pendiente materializar tablas: `npm run db:push` (o `db:migrate`).
> Los contratos de la API externa viven en `src/domain/models/sgc.ts` (mismo patrÃ³n que
> `kbservicios-client.ts`); los DTOs en `types/dto/` se reservan para endpoints propios (Fase 3+).

## ActualizaciÃ³n guÃ­a v2 (`APIS_USE_HOOKS.md`, 2026-09-25)

El equipo del SGC publicÃ³ una versiÃ³n nueva de la guÃ­a (responde a `pedido-al-sgc.md`).
Cambios y estado en este repo:

| Cambio en la guÃ­a v2 | Estado en ContratosStands |
|---|---|
| `POST /contracts` responde `contractTypeCode` + **`route`** (`frozen`, `steps[]`) + `routeError` | âœ… `SgcCrearExpedienteResult` extendido (`SgcRutaExpediente`/`SgcRutaStep`) |
| **Â§3.2 `fields`**: campos propios del tipo (`required`, `kind`, `options`, `apiSupported`) a enviar en la creaciÃ³n | âš ï¸ DTO listo (`SgcCrearExpedienteInput.fields`, `SgcCampoTipo`). **QA aÃºn NO lo soporta**: `/contract-types` no devuelve `fields` y `POST /contracts` con `fields` responde `400 "Campos no admitidos: fields."` |
| `areaCode` y `contractTypeCode` **obligatorios** | âœ… ya se envÃ­an (400 si faltan) |
| CÃ³digos: `areaCode` / `contractTypeCode` | âœ… prod (task `:9`): `COMUNICACIONES` + `AUSPICIO` (verificados `201`). âš ï¸ `ALQUILER_STANDS` **no existe**; el template `STANDS_PERUMIN` apunta a **`PRUEBA_IIMP_1`**, pero ese tipo **falla la creaciÃ³n (`422`)** â†’ bug del SGC. Tipos que sÃ­ crean: `PROVEEDOR, ARRENDAMIENTO, SERVICIOS, AUSPICIO` |
| `GET /contract-types` (tipos, Ã¡reas y ruta vigente) | âœ… cliente `listarTiposContrato()` |
| `GET /templates` y `GET /templates/{code}` + descarga de archivo | âœ… cliente `listarTemplates()` / `obtenerTemplate()` + `TEMPLATE_FILE_DOWNLOAD` |
| **`POST /contracts/{id}/resend`** (reabrir el trÃ¡mite tras subsanar, con `Idempotency-Key`) | âœ… `subsanarContrato` ahora sube la versiÃ³n **y** llama `/resend` |
| `workflow.returned` trae `data.reason` + `observations` | âœ… el inbox de webhooks lo persiste |
| Carga: mÃ¡x **25 MB**/archivo; PDF, DOCX, XLSX, PNG, JPG | âœ… validado en la carga (`SGC_UPLOAD_MAX_BYTES` / `SGC_UPLOAD_ALLOWED_EXTENSIONS` en el step Legal SGC) |
| `category: "annex"` = el mismo "Adjuntos" del panel humano | âœ… ya se usa |

> La **autenticaciÃ³n con `Bearer sgc_<clave>` funciona** (el "401" inicial era un typo en la
> clave: `0` vs `O`). Pendiente de producto: registrar la URL real del webhook en el SGC y, para
> contratos reales, usar la **clave del SGC de producciÃ³n** (hoy se apunta a QA).

## 1. Contexto y decisiÃ³n

El ecosistema tiene tres sistemas:

| Sistema | Responsabilidad | Rol en esta integraciÃ³n |
|---|---|---|
| **ContratosStands** (este repo) | Solicitudes y reserva de stands, aprobaciones por Ã¡rea, facturaciÃ³n | **Cliente** â€” crea expedientes y sube documentos al SGC |
| **SGC** (Sistema de GestiÃ³n de Contratos) | Ciclo de vida jurÃ­dico del contrato: etapas, revisiones, firmas, vigencia, cierre | **Proveedor** â€” expone `/api/integrations/v1/*` y webhooks |
| **Sistema de Montaje** (SM) | EjecuciÃ³n/SSOMA del stand | Fuera de alcance aquÃ­ |

DecisiÃ³n: **no** implementamos el lado SGC en este repo. ContratosStands actÃºa como
sistema origen que empuja el contrato del stand al SGC y consume su estado para el
sidebar de seguimiento.

### TerminologÃ­a (importante)

`docs/05-integraciones/api-sistema-montaje.md:48` rotula "SGC = ContratosStands". Esa equivalencia
**ya no aplica** para esta integraciÃ³n: el SGC que describe `APIS_USE_HOOKS.md` es un
sistema externo con workflow de expedientes, versionado documental y webhooks HMAC
que este repo no implementa. Pendiente corregir esa lÃ­nea del doc del SM.

## 2. Alcance

**Entra:**
- Crear expediente en el SGC al aprobarse una solicitud de stand.
- Subir contrato v1 + anexos (flujo de 3 fases).
- Consultar estado/detalle para el sidebar.
- Recibir y verificar webhooks (HMAC-SHA256) cuando exista host pÃºblico.
- Subsanar (reenviar versiÃ³n corregida) y descargar el archivo final firmado.

**No entra:**
- Implementar endpoints `/contracts` (eso es del SGC).
- Enviar el contrato final al cliente por correo (hoy es acciÃ³n manual de la UI del SGC).
- Webhooks en local sin tÃºnel (ver Â§8.4).

## 3. Flujo end-to-end mapeado al dominio actual

| Paso SGC | Disparador en ContratosStands | Entidad local |
|---|---|---|
| `POST /contracts` | **RevisiÃ³n ComunicaciÃ³n aprobada** â€” Ãºltima Ã¡rea local; Legal se delega (ver Â§3.1) | `Solicitud` |
| Reservar/subir/confirmar documento | **Contrato v1** = documento del **admin** (`SolicitudDocumento.userId === null`); **anexos** = documentos del **cliente** (`userId` no nulo) | `SolicitudDocumento` |
| `GET /contracts/{contractId}` | Usuario abre el sidebar del stand | `Solicitud` + correlaciÃ³n `SgcExpediente` |
| `workflow.returned` | El SGC devuelve â†’ estado observado | `SgcWebhookEvento` â†’ `SgcExpediente` |
| `workflow.approved` + finalization `active` | Descargar contrato firmado | `SgcDocumento` |
| `contract.closed` | Cierre formal | `SgcExpediente` |

### 3.1 Punto de disparo (RESUELTO): revisiÃ³n ComunicaciÃ³n â†’ SGC

El pipeline local de solicitudes es `logistica â†’ comunicacion` (`REVISION_AREA_ORDER`
ya **no incluye Legal**). **La revisiÃ³n Legal deja de existir en local y se delega al SGC**
(es precisamente su `internal-review` "RevisiÃ³n legal interna"), por lo que **ComunicaciÃ³n
es la Ãºltima Ã¡rea local** y al aprobarla el trÃ¡mite pasa al SGC.

Ese es el punto de integraciÃ³n. **Equivale al `workflow.started` del SGC** ("se enviÃ³ el
trÃ¡mite"): tras la aprobaciÃ³n de **ComunicaciÃ³n**, ContratosStands crea el expediente en el
SGC y empuja el contrato v1; el SGC corre entonces **sus propias etapas**
(`internal-review` â†’ `approval`), que incluyen la revisiÃ³n legal y la aprobaciÃ³n de Gerencia.

> El disparo vive en la constante `SGC_TRIGGER_REVISION_AREA`
> (`constants.ts`) = `REVISION_AREAS.COMUNICACION`. Cambiarla a `REVISION_AREAS.LEGAL`
> revierte al disparo por revisiÃ³n Legal si el negocio lo pidiera.

**Compatibilidad lÃ³gico + visual (`src/lib/shared/utils/revision-areas.ts`).**
Las Ã¡reas locales se resuelven con `areasRevisionLocal(revisiones)`:
- Solicitudes **nuevas**: `[logistica, comunicacion]` â†’ Legal la cubre el SGC
  (`legalDelegadaAlSgc = true`); el UI muestra el paso **"Legal (SGC)"**.
- Solicitudes **legacy** (con revisiÃ³n Legal persistida): `[logistica, comunicacion, legal]`
  â†’ se sigue exigiendo/visualizando Legal local; **no** se muestra el paso SGC.
El mismo criterio se aplica al cÃ¡lculo de estado (`computeEstadoSolicitud`), al gating de
`notificar`/`modificar` y a los steps de `solicitud-review`, `solicitudes-manager` y
`mis-solicitudes-manager`. El rol `legal` y su permiso se conservan por compatibilidad.

CondiciÃ³n exacta del disparo (todas deben cumplirse):
- `data.area === SGC_TRIGGER_REVISION_AREA` (= `comunicacion`)
- `data.estado === RESULTADOS_APROBACION.APROBADO`
- `revision.fuePrimeraRevision === true` (evita re-disparar al editar el comentario)
- La solicitud no tiene ya un `SgcExpediente` con `estadoEnvio = "creado"` (idempotente)
- `SGC_ENABLED=1`

DÃ³nde se cablea (respetando `strict-boundaries`): el controller ya delega en el servicio;
la orquestaciÃ³n vive en `SolicitudApplicationService.revisar()` llamando al nuevo
`SgcIntegracionApplicationService.crearExpedienteDesdeSolicitud(solicitudId)`, **fuera del
request crÃ­tico** (best-effort + registro en `SgcExpediente.estadoEnvio = error` y reintento),
para que un fallo del SGC **nunca** bloquee la aprobaciÃ³n Legal.

> Nota: el resto de etapas del SGC (revisiÃ³n jurÃ­dica, gerencia, firma) son **internas del
> SGC** y no deben mapearse a las Ã¡reas locales (`logistica/comunicacion/legal`). La
> re-evaluaciÃ³n local (`atenderReevaluacionAprobacion`) NO vuelve a crear expediente: genera
> una versiÃ³n corregida sobre el mismo `documentId` (Â§9, subsanaciÃ³n).

## 4. Arquitectura (hexagonal)

Se respetan los patrones de `.opencode/reglas/api-design-patterns` y el
`strict-boundaries` (el frontend nunca importa de domain/application/infrastructure).

```
src/
â”œâ”€â”€ domain/
â”‚   â”œâ”€â”€ models/sgc.ts                      â† entidades puras del dominio SGC
â”‚   â””â”€â”€ ports/
â”‚       â”œâ”€â”€ sgc-client.ts                  â† I SgcClient (contrato HTTP)
â”‚       â””â”€â”€ sgc-repository.ts              â† ISgcRepository (correlaciÃ³n en BD)
â”‚
â”œâ”€â”€ application/sgc-integracion/
â”‚   â”œâ”€â”€ sgc-integracion-service.ts         â† orquesta casos de uso
â”‚   â”œâ”€â”€ sgc-webhook-service.ts             â† verifica firma + procesa inbox
â”‚   â””â”€â”€ __tests__/
â”‚
â”œâ”€â”€ infrastructure/
â”‚   â”œâ”€â”€ external/sgc-client.ts             â† adaptador fetch (Bearer + Idempotency-Key)
â”‚   â”œâ”€â”€ external/sgc-client.mock.ts        â† adaptador en memoria (Fase 0)
â”‚   â””â”€â”€ persistence/sgc-repository.ts      â† Prisma
â”‚
â”œâ”€â”€ controllers/
â”‚   â”œâ”€â”€ sgc.controller.ts                  â† endpoints internos (createRouter)
â”‚   â””â”€â”€ sgc-webhook.controller.ts          â† receptor pÃºblico del webhook
â”‚
â”œâ”€â”€ validators/sgc.validator.ts            â† Zod (request de webhook y endpoints)
â”‚
â”œâ”€â”€ lib/
â”‚   â”œâ”€â”€ shared/utils/sgc.ts                â† helpers puros (Idempotency-Key)
â”‚   â”œâ”€â”€ shared/mappers/sgc.ts              â† Solicitud/Documento â†” payload SGC
â”‚   â”œâ”€â”€ shared/constants.ts                â† + secciÃ³n SGC_* (ver Â§6)
â”‚   â”œâ”€â”€ server/sgc-config.ts               â† lectura tipada de env SGC_*
â”‚   â””â”€â”€ server/services.ts                 â† + wiring del cliente y servicio
â”‚
â””â”€â”€ app/api/
    â”œâ”€â”€ integracion/sgc/webhook/route.ts   â† POST (pÃºblico, verificado por HMAC)
    â””â”€â”€ sgc/[...slug]/route.ts             â† GET/POST internos (createRouter)
                                              detalle | listar | reintentar | sincronizar
```

Fachada frontend: `src/lib/client/api/services/sgc.ts` (nada de `fetch` en componentes).

### Puerto `ISgcClient`

```ts
export interface ISgcClient {
  crearExpediente(req: CrearExpedienteRequestDTO, idempotencyKey: string): Promise<CrearExpedienteResponseDTO>;
  actualizarExpediente(contractId: string, req: ActualizarExpedienteRequestDTO): Promise<void>;
  consultarExpediente(contractId: string): Promise<ExpedienteDetalleDTO>;
  listarExpedientes(filtros: ListarExpedientesFiltrosDTO): Promise<PaginaExpedientesDTO>;

  reservarSubida(contractId: string, req: ReservarSubidaRequestDTO): Promise<ReservarSubidaResponseDTO>;
  transferirArchivo(uploadUrl: string, headers: Record<string, string>, binario: Uint8Array): Promise<void>;
  confirmarSubida(versionId: string): Promise<ConfirmarSubidaResponseDTO>;

  consultarDocumento(documentId: string): Promise<DocumentoDetalleDTO>;
  resolverVersion(versionId: string): Promise<VersionResueltaDTO>;
  obtenerUrlDescarga(versionId: string): Promise<UrlDescargaDTO>;
}
```

## 5. Modelo de correlaciÃ³n en BD

Se agregan 3 modelos (el 4Âº es opcional) siguiendo la convenciÃ³n Prisma del repo
(camelCase en cÃ³digo, `@@map` snake_case, PK uuid, auditorÃ­a, Ã­ndices, JSDoc).

```prisma
/// CorrelaciÃ³n 1:1 entre una solicitud de stand y su expediente en el SGC.
model SgcExpediente {
  id               String    @id @default(uuid())
  solicitudId      String    @unique @map("solicitud_id")
  code             String    @unique @db.VarChar(50)   // code de negocio (Legal)
  contractId       String?   @unique @map("contract_id") @db.VarChar(64) // UUID interno SGC
  estadoEnvio      String    @default("pendiente") @map("estado_envio") @db.VarChar(20) // pendiente|creado|error
  stage            String?   @db.VarChar(40)
  lifecycleStatus  String?   @map("lifecycle_status") @db.VarChar(20)
  version          Int?
  areaCode         String    @map("area_code") @db.VarChar(40)
  contractTypeCode String    @map("contract_type_code") @db.VarChar(40)
  lastSyncedAt     DateTime? @map("last_synced_at")
  lastError        String?   @map("last_error") @db.VarChar(500)

  solicitud        Solicitud    @relation(fields: [solicitudId], references: [id])
  documentos       SgcDocumento[]

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([estadoEnvio])
  @@index([stage])
  @@map("sgc_expediente")
}

/// CorrelaciÃ³n de cada pieza documental empujada al SGC.
model SgcDocumento {
  id               String   @id @default(uuid())
  sgcExpedienteId  String   @map("sgc_expediente_id")
  documentId       String   @unique @map("document_id") @db.VarChar(64)
  currentVersionId String?  @map("current_version_id") @db.VarChar(64)
  category         String   @db.VarChar(20)   // contract | annex
  title            String   @db.VarChar(200)
  fileName         String   @map("file_name") @db.VarChar(255)
  checksumSha256   String?  @map("checksum_sha256") @db.VarChar(64)
  sizeBytes        Int?     @map("size_bytes")
  estado           String   @default("reservado") @db.VarChar(20) // reservado|subido|confirmado|rechazado

  sgcExpediente    SgcExpediente @relation(fields: [sgcExpedienteId], references: [id])

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([sgcExpedienteId])
  @@map("sgc_documento")
}

/// Inbox de webhooks â€” idempotencia por eventId + bitÃ¡cora de procesamiento.
model SgcWebhookEvento {
  id           String    @id @default(uuid())
  eventId      String    @unique @map("event_id") @db.VarChar(64)
  eventType    String    @map("event_type") @db.VarChar(40)
  resourceId   String?   @map("resource_id") @db.VarChar(64)
  resourceCode String?   @map("resource_code") @db.VarChar(50)
  payload      Json
  procesadoAt  DateTime? @map("procesado_at")
  error        String?   @db.VarChar(500)

  createdAt DateTime @default(now()) @map("created_at")

  @@index([eventType])
  @@index([resourceId])
  @@map("sgc_webhook_evento")
}
```

En `Solicitud` se agrega la relaciÃ³n inversa: `sgcExpediente SgcExpediente?`.

**Outbox (implementado):** `SgcOutbox` (`operacion`, `idempotencyKey @unique`, `payload`,
`estado`, `intentos`, `ultimoError`, `programadoAt`). `SgcOutboxApplicationService.encolar`
encola subidas de contrato/anexos y subsanaciones cuando fallan; el cron ejecuta
`despachar()` con **backoff exponencial** (base 60 s, tope 1 h, mÃ¡x. 6 intentos).
`estadoEnvio=error` del expediente se reintenta ademÃ¡s vÃ­a `sincronizarCron()`.

> Reflejar estos modelos en `docs/03-arquitectura/modelo-datos.md` (regla `lineamientos-bd`).

## 6. Constantes (`src/lib/shared/constants.ts`)

Nada de strings hardcodeados (regla `constants-first`). Nueva secciÃ³n:

```ts
export const SGC_EVENT_TYPES = {
  WORKFLOW_STARTED: "workflow.started",
  WORKFLOW_ADVANCED: "workflow.advanced",
  WORKFLOW_RETURNED: "workflow.returned",
  WORKFLOW_APPROVED: "workflow.approved",
  WORKFLOW_REJECTED: "workflow.rejected",
  CONTRACT_CLOSED: "contract.closed",
} as const;

export const SGC_DOCUMENT_CATEGORIES = {
  CONTRACT: "contract",
  ANNEX: "annex",
} as const;

export const SGC_LIFECYCLE_STATUSES = {
  ACTIVE: "active",
  FINALIZED: "finalized",
  OBSERVED: "observed",
  REJECTED: "rejected",
} as const;

export const SGC_APPROVAL_MARKS = {
  ACKNOWLEDGEMENT: "acknowledgement",
  VISA: "visa",
  NORMAL_SIGNATURE: "normal-signature",
  STAMP: "stamp",
} as const;

export const SGC_FINALIZATION = { ACTIVE: "active", FINALIZED: "finalized" } as const;

export const SGC_ESTADO_ENVIO = {
  PENDIENTE: "pendiente",
  CREADO: "creado",
  ERROR: "error",
} as const;

export const SGC_API_VERSION = "2026-09-01";
export const SGC_IDEMPOTENCY_PREFIX = "stands/reserva";
export const SGC_WEBHOOK_TOLERANCE_SECONDS = 300;
```

## 7. Cliente HTTP (`sgc-client.ts`)

- **Auth**: `Authorization: Bearer ${SGC_API_KEY}` en toda llamada (excepto el `PUT` al
  `uploadUrl`, que solo lleva los headers que devuelve el SGC).
- **Idempotencia**: `Idempotency-Key: ${SGC_IDEMPOTENCY_PREFIX}/${solicitudId}` determinista.
- **Timeout**: `AbortController` con `SGC_TIMEOUT_MS`. Copiar headers de seguridad de
  otros clientes (`kbservicios-client.ts`) sin el `NODE_TLS_REJECT_UNAUTHORIZED` salvo
  que el host del SGC lo exija (confirmar).
- **Errores**: mapear `4xx/5xx` a un error tipado de dominio (`SgcApiError` con status,
  code, message); nunca strings sueltos. `422` en confirmaciÃ³n â‰  rechazo del expediente:
  marcar la versiÃ³n como rechazada y reintentar.
- **Checksum**: SHA-256 en hex minÃºscula calculado localmente antes de reservar y
  reenviado en el header `x-amz-meta-checksum-sha256`.

## 8. Webhooks

### 8.1 Receptor
`POST /api/integracion/sgc/webhook` (pÃºblico; agregar a `PUBLIC_API_ROUTES`). Debe correr
en **runtime Node** (usa `crypto`). Responde 2xx rÃ¡pido (<10s) y procesa asÃ­ncrono.

### 8.2 VerificaciÃ³n de firma
```
firma_esperada = HMAC_SHA256(secreto, `${timestamp}.${cuerpo_exacto}`)
```
- Comparar con `timingSafeEqual` (nunca `===`).
- Rechazar si `|now - timestamp| > SGC_WEBHOOK_TOLERANCE_SECONDS`.
- Leer el cuerpo **crudo** (no re-serializar el JSON) para que el HMAC cuadre.

### 8.3 Idempotencia
Antes de procesar, insertar en `SgcWebhookEvento` por `eventId` Ãºnico; si ya existe,
responder 2xx y salir.

### 8.4 Local vs producciÃ³n
El SGC **no entrega a localhost/IP privada**. Mientras no exista host HTTPS pÃºblico:
- **Fase intermedia**: polling con `GET /contracts/{contractId}` (botÃ³n de refresco en el
  sidebar) + **cron de reconciliaciÃ³n** `POST /api/cron/sgc-reconciliar` (header
  `x-cron-secret`), disparado por `.github/workflows/sgc-reconciliar.yml` cada 10 min.
  Ese cron refresca/reintenta expedientes en `estadoEnvio = error` **y despacha el outbox**
  (contrato/anexos/subsanaciÃ³n) con backoff.
- **Pruebas reales**: tÃºnel (ngrok) y registrar la URL temporal al equipo del SGC.

## 9. Frontend

- Fachada tipada en `src/lib/client/api/services/sgc.ts`, consumida por un hook
  (`src/hooks/useSgcExpediente.ts`) y el sidebar de seguimiento.
- El sidebar pinta directo `steps` (stepper: `completed|current|pending`) y `history`
  (timeline ya redactada). `totalMinorUnits` se divide entre 100 (usar servicio
  utilitario de formato, regla `utility-services`).

## 10. ConfiguraciÃ³n (`env`)

Agregar a `.env.example` y a los ambientes de despliegue:

```
SGC_API_URL=https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1   # base del SGC (confirmada)
SGC_API_KEY=            # Bearer sgc_<clave>  (actor con rol contract-manager)
SGC_AREA_CODE=          # p.ej. EVENTOS   (lo define el SGC)
SGC_CONTRACT_TYPE_CODE= # p.ej. AUSPICIO  (lo define el SGC)
SGC_WEBHOOK_SECRET=     # secreto HMAC (solo cuando haya webhooks)
SGC_ENABLED=0           # 1 = integraciÃ³n activa
SGC_MODE=mock           # mock | real
SGC_TIMEOUT_MS=10000
```

## 11. Plan por fases

| Fase | Entregable | VerificaciÃ³n |
|---|---|---|
| **0** | Env + constantes SGC + DTOs + puerto + adaptador mock | `tsc --noEmit`, `eslint`, tests de contrato |
| **1** | Crear expediente al aprobar solicitud + correlaciÃ³n + idempotencia | test servicio con fake client/repo; reintento no duplica |
| **2** | Subida 3 fases (contrato + anexos) con checksum | test reservaâ†’transferâ†’confirm; caso `rejected` |
| **3** | `GET` detalle + endpoint interno + fachada + sidebar | test mapper/view-model; verificaciÃ³n en navegador |
| **4** | Webhooks (receptor, HMAC, inbox, procesamiento) + reconciliaciÃ³n | tests de firma (vÃ¡lida/expirada/falsa) e idempotencia |
| **5** | SubsanaciÃ³n (mismo `documentId`) + descarga del firmado | test flujo returnedâ†’reenvÃ­oâ†’approvedâ†’download |
| **6** | Docs (`docs/04-api/openapi.yaml`, `docs/03-arquitectura/modelo-datos.md`, este doc), seguridad, pre-merge | checklist `pre-merge` |

Cada fase sigue `code-production-process` + `test-driven-development` y cierra con
`verification-before-completion`.

## 12. Riesgos

| Riesgo | MitigaciÃ³n |
|---|---|
| TerminologÃ­a SGC confusa entre docs | Corregir `api-sistema-montaje.md:48` |
| Webhooks no alcanzan local | Polling + tÃºnel; diseÃ±ar desacoplado del webhook |
| `areaCode`/`contractTypeCode` inexistentes | Bloqueante de Fase 1 (pedir al SGC) |
| Reintentos duplican expedientes | `Idempotency-Key` determinista + Ã­ndice Ãºnico |
| Firma mal verificada | Cuerpo crudo + `timingSafeEqual` + tolerancia (tests) |

## 13. Decisiones abiertas (bloqueos)

1. ~~**Punto de disparo**~~ â€” **RESUELTO**: aprobaciÃ³n de la revisiÃ³n **ComunicaciÃ³n** (Ãºltima Ã¡rea local); la revisiÃ³n **Legal** se delega al SGC (Â§3.1).
2. **`areaCode` / `contractTypeCode`** reales para "separaciÃ³n de stands" (los define el SGC).
3. **Datos para el expediente**: `counterpartyLegalName` se toma hoy de `GessStand.empresa`
   (fallback `standCode`). **Pendiente**: `counterpartyTaxIdentifier` va vacÃ­o â€” hay que
   definirlo (Â¿`Reserva.datosFacturacion` no estÃ¡ ligado a `Solicitud` hoy?). `currency`/
   `totalMinorUnits` (Â¿`Facturacion`?) quedan para cuando se empujen documentos (Fase 2).
4. **`code` de negocio**: Â¿usar el cÃ³digo de stand/solicitud existente o un correlativo
   nuevo `STAND-<aÃ±o>-<seq>`?
5. ~~**Documentos a empujar**~~ â€” **RESUELTO** (fuente en `docs/00-inicio/flujos.md` Â§1.2 y
   `docs/01-funcional/02-solicitudes-y-aprobaciones.md` Â§4/Â§7): **contrato v1 = documento del
   admin** (`SolicitudDocumento.userId === null`) y **anexos = documentos del cliente**.
   Implementado en `subirContratoDeSolicitud` / `subirAnexosDeSolicitud` (endpoints
   `POST /api/sgc/subir-contrato` y `/api/sgc/subir-anexos`) y en el panel SGC.
6. **Credencial** `sgc_<clave>`. Host ya confirmado y probado:
   `https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1` (Next.js + Auth.js
   detrÃ¡s de CloudFront). La API responde **401 `{"error":"No autorizado."}`** sin clave
   vÃ¡lida, por lo que la credencial es imprescindible. Mientras no exista: `SGC_MODE=mock`.

## Anexo A. Flujo completo (happy path)

Prueba automatizada equivalente:
`src/application/sgc-integracion/__tests__/sgc-flujo-completo.test.ts` (usa el adaptador
real `SgcClientMock` + repositorios en memoria y recorre los 10 pasos de abajo).

### A.1 Secuencia end-to-end

```mermaid
sequenceDiagram
    autonumber
    actor Area as Ãreas (Log/Com/Legal)
    participant UI as Dashboard ContratosStands
    participant API as API ContratosStands
    participant Svc as SgcIntegracionService
    participant DB as sgc_expediente / sgc_documento
    participant SGC as SGC (/api/integrations/v1)
    participant WH as /api/integracion/sgc/webhook

    Area->>UI: Aprueba revisiÃ³n (logÃ­stica â†’ comunicaciÃ³n; Legal se delega al SGC)
    UI->>API: POST /api/solicitudes/revisar (area=comunicacion, aprobado)
    API->>Svc: crearExpedienteDesdeSolicitud(solicitudId)
    Svc->>DB: busca correlaciÃ³n (idempotencia)
    Svc->>SGC: POST /contracts (Idempotency-Key: stands/reserva/{id})
    SGC-->>Svc: { contractId, status: created }
    Svc->>DB: guarda contractId (estadoEnvio=creado)
    API-->>UI: revisiÃ³n OK (SGC best-effort, no bloquea)

    Svc->>SGC: POST /contracts/{contractId}/documents (reservar + checksum SHA-256)
    SGC-->>Svc: { uploadUrl, documentId, versionId }
    Svc->>SGC: PUT uploadUrl (binario + headers del SGC)
    Svc->>SGC: POST /document-versions/{versionId}/complete
    SGC-->>Svc: { outcome: accepted }
    Svc->>DB: guarda documentId / currentVersionId

    UI->>API: GET /api/sgc/detalle?solicitudId
    API->>SGC: GET /contracts/{contractId}
    SGC-->>API: stepper (steps) + history + documents
    API-->>UI: detalle para el sidebar

    SGC->>WH: POST webhook workflow.advanced (x-sgc-signature)
    WH->>WH: verifica HMAC (timing-safe) + inbox idempotente
    WH->>DB: stage = approval
    SGC->>WH: POST webhook workflow.approved (finalization=active)
    WH->>DB: lifecycleStatus = active

    UI->>API: GET /api/sgc/descarga?solicitudId
    API->>SGC: GET /document-versions/{versionId}/download
    SGC-->>API: { url, expiresInSeconds: 60 }
    API-->>UI: enlace de vida corta
    SGC->>WH: POST webhook contract.closed
    WH->>DB: lifecycleStatus = finalized
```

### A.2 Estados y decisiones

```mermaid
flowchart TD
    A[Solicitud creada: revisiones locales logÃ­stica/comunicaciÃ³n] --> B{LogÃ­stica y ComunicaciÃ³n aprueban?}
    B -- No --> B1[Rechazo / re-evaluaciÃ³n local - sin SGC]
    B -- SÃ­ --> C[Delegar al SGC: crear expediente + contrato v1]
    C --> D[Carga 3 fases: reservar â†’ PUT â†’ confirmar]
    D --> E[El SGC ejecuta su workflow: internal-review Legal â†’ approval Gerencia]
    E --> F{Evento del SGC}
    F -- workflow.returned --> G[Subsanar: nueva versiÃ³n, mismo documentId]
    G --> E
    F -- workflow.approved active --> H[Contrato VIGENTE]
    F -- workflow.rejected --> I[Cierre: RECHAZADO]
    H --> J[GET /sgc/descarga â†’ contrato firmado]
    J --> K[contract.closed â†’ FINALIZED]
    E -. sin webhook pÃºblico (local) .-> P[Fallback: GET detalle / POST /sgc/sincronizar]
```

## Actualización guía v4 (2026-09-25)

- **§3 counterpartyEmail es obligatorio**: el mapper ahora lo envía (correo del cliente de la
  solicitud). Al terminar el trámite, el SGC **envía automáticamente** la copia final firmada a
  ese correo (una vez por expediente). Si la solicitud no tiene email, la creación responderá 400.
- **§8.2 el rechazo es subsanable** con el **mismo flujo** de §8 + §8.1 (subir versión corregida
  con la **misma documentId** + POST /contracts/{id}/resend): se crea una **ronda nueva** que
  recorre otra vez la ruta congelada. **No hay endpoint nuevo** → implementado en
  SgcIntegracionApplicationService.reenviarCorreccionAlSgc.
- **Rondas auditables**: tabla sgc_subsanacion (ronda, motivo, declaradoPor/At, estado,
  reenviadoPor/At, documentId/versionId) → **N rechazos trazables**.
- **Stepper**: steps[].status puede venir "rejected" → agregado a SGC_STEP_STATUSES.
- **Regla de reenvío**: exige al menos **una versión nueva** del documento principal; si se envía
  el mismo contenido responde 422 ("Carga una versión nueva…"). El historial de la ronda
  rechazada se conserva.
