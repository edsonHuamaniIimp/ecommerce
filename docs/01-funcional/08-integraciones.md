# Integraciones externas y API de servicios

> Fuente: `src/app/api/{sgc,integracion,kbservicios,entidades,reniec,sunat,exhibidoras,stands,health,errors,upload}/**`,
> `src/application/sgc-integracion/**`, `src/application/stands-integracion/**`,
> `src/infrastructure/external/**`, `src/middleware.ts`.

## 1. Integración SGC (Sistema de Gestión de Contratos)

**Rol de ContratosStands**: consumidor/cliente. Crea expedientes, empuja documentos y
consume el estado del workflow jurídico.

- Puertos: `ISgcClient`, `ISgcRepository`, `ISgcWebhookRepository`.
- Servicios: `SgcIntegracionApplicationService`, `SgcWebhookApplicationService`.
- **Disparo**: al aprobar **Comunicación** (primera vez) se crea el expediente (`solicitudes-service.ts:43-45`; `SGC_TRIGGER_REVISION_AREA = COMUNICACION`).
- **Idempotencia**: `Idempotency-Key` determinista `stands/reserva/{solicitudId}`; inbox `SgcWebhookEvento.eventId @unique`.
- **Firma webhook**: `x-sgc-signature` = `t=<unix>,v1=<HMAC_SHA256(secret, timestamp.cuerpo_crudo)>`, tolerancia 300 s, comparación en tiempo constante.
- **Eventos**: `workflow.started` (no-op), `workflow.advanced` (stage), `workflow.returned` (observed), `workflow.approved` (active/finalized), `workflow.rejected` (rejected), `contract.closed` (finalized).

### Endpoints propios

| Método | Ruta | Auth |
|---|---|---|
| `GET` | `/api/sgc/detalle?solicitudId=` | sesión + `solicitudes:view` |
| `GET` | `/api/sgc/descarga?solicitudId=` | sesión + `solicitudes:view` |
| `POST` | `/api/sgc/sincronizar` | sesión + `solicitudes:view` |
| `POST` | `/api/sgc/subsanar` | sesión + `solicitudes:view` |
| `POST` | `/api/sgc/subir-contrato?solicitudId=` | sesión + `solicitudes:view` |
| `POST` | `/api/sgc/subir-anexos?solicitudId=` | sesión + `solicitudes:view` |
| `POST` | `/api/sgc/subir-documento` (`category`, `title`, `url`, `documentId?`) | sesión + `solicitudes:view` |
| `POST` | `/api/integracion/sgc/webhook` | **público** (firma HMAC) |

Estados locales: `SGC_ESTADO_ENVIO` (`pendiente|creado|error`), `SGC_DOCUMENTO_ESTADO`
(`reservado|subido|confirmado|rechazado`), stages (`drafting|internal-review|approval|validity|closed`).

> **Estado del adaptador**: existe adaptador HTTP real (`external/sgc-client.ts`, Bearer +
> `Idempotency-Key`); `services.ts` elige real/mock segun `SGC_MODE`. Con `SGC_ENABLED=0`
> (default) la integracion queda dormida. **Contrato v1** = documento del admin y **anexos**
> = documentos del cliente (`POST /api/sgc/subir-contrato` · `/api/sgc/subir-anexos`).
> Las tablas Prisma `sgc_*` existen (`schema.prisma:640-701`).

## 2. API consumida por el Sistema de Montaje (M2M)

Autenticación por header `x-api-key` contra `INTEGRACION_API_KEY` (**bypass si `NODE_ENV !== "production"`**).

| Método | Ruta | Respuesta |
|---|---|---|
| `GET` | `/api/exhibidoras?q=` | `[{ id_empresa, razon_social }]` |
| `GET` | `/api/stands/exhibidora?empresaId=&tipoEvento=&codigoEvento=` | `StandExhibidoraDTO[]` |
| `GET` | `/api/stands/contrato?tipoEvento=&codigoEvento=` | `ContratoStandDTO[]` |

- Envuelto en `{ success: true, data }`.
- `estado_contrato` derivado: aprobado/pagado → `FIRMADO_Y_VIGENTE`, rechazado → `RESCINDIDO`, pendiente_pago → `PENDIENTE_FIRMA`, resto → `EN_REVISION`.
- `tipologia_stand` **no se expone** (decisión de negocio).

## 3. Servicio persona/entidades, RENIEC/SUNAT y KBServicios

| Método | Ruta | Upstream |
|---|---|---|
| `POST` | `/api/entidades/persona` `{documento?, nombre?}` | `${ENTIDADES_API_URL ?? KBSERVICIOS_URL}/rest/searchpersonv00` |
| `POST` | `/api/entidades/empresa` `{nroDocument?, razonSocial?}` | `.../rest/searchempresa` |
| `GET` | `/api/reniec/dni?numero=` (8 dígitos) | `https://api.apis.net.pe/v2/reniec/dni` |
| `GET` | `/api/sunat/ruc?numero=` (11 dígitos) | `.../sunat/ruc/full` (Bearer `SUNAT_API_TOKEN`) |
| `POST` | `/api/kbservicios/events` | `${KBSERVICIOS_URL}/rest/events` |
| `POST` | `/api/kbservicios/event-types` | `${KBSERVICIOS_URL}/rest/listeventtype` |

- KBServicios alimenta la presala (tipos y eventos) y auspicios.
- **Divergencia documental (dudoso)**: `docs/05-integraciones/guia-consumo-servicio-persona.md` describe otro servicio (`/servicio-persona/api`, Bearer) que **no coincide** con el cliente implementado (`/rest/searchpersonv00`).

## 4. Otras integraciones

- **Planogess/GESS**: `PLANOGESS_API_URL` con `{TIPEVCOD, EVENCOD}`; base de la sincronización de stands.
- **Niubiz**: pagos (ver [04-facturacion.md](./04-facturacion.md)).
- **Storage**: `POST /api/upload` guarda en `public/uploads/` (local) o S3 según `STORAGE_PROVIDER`.
- **Operación**: `GET /api/health`, `POST /api/errors/log`.

## 5. Rutas públicas vs. protegidas (middleware)

- **Públicas**: `/`, `/presala`, `/auth/login`, `/403`; prefijos `/api/auth/`, `/api/maestra/`; exactas `/api/exhibidoras`, `/api/stands/exhibidora`, `/api/stands/contrato`, `/api/planos/publico`, `/api/integracion/sgc/webhook`; caso `POST /api/eventos/listar?presala=1`.
- **Protegidas** (prefijo → permiso): `/dashboard/vinculacion` → `stands:vinculacion`; `/dashboard/datos-evento` → `eventos:datos`; `/dashboard/solicitudes|mis-solicitudes`, `/api/solicitudes`, `/api/sgc` → `solicitudes:view`; `/dashboard/stands` → `stands:manage`; `/dashboard/reservas` → `read:reservas`; `/dashboard/auspicios`, `/api/auspicios` → `auspicios:view`; `/dashboard/facturacion`, `/api/facturacion` → `facturacion:view`; `/dashboard/laboratorio`, `/api/planos` → `laboratorio:view`; `/dashboard/roles`, `/api/roles` → `roles:manage`; `/dashboard/eventos`, `/api/eventos` → `events:manage`; `/plano`, `/mapa` → `stands:plano`.
- **Sin cobertura** (pasan sin token): `/api/kbservicios/**`, `/api/reniec/**`, `/api/sunat/**`, `/api/upload`, `/api/errors/log`, `/api/health`, `/api/gess/**`, `/api/planogess/**`, `/api/facturacion/niubizz/**`.

## 6. Limitaciones y observaciones

- **SGC desactivado por defecto** (`SGC_ENABLED=0`); `SGC_MODE=real` usa `SGC_API_URL`/`SGC_API_KEY` (adaptador real existente).
- **Anexos/contrato SGC** ya tienen caller: `POST /api/sgc/subir-contrato` y `/api/sgc/subir-anexos` (botones en el panel SGC).
- **`validators/sgc.validator.ts` no existe** (validacion inline en controllers; pendiente Zod).
- **Constantes muertas**: `SGC_DOCUMENTO_ESTADO.SUBIDO`, `SGC_WEBHOOK_DELIVERY_HEADER`.
- **Webhook sin reproceso**: fallos de negocio se registran y responden 2xx (sin reintento del SGC); del lado saliente sí hay **outbox** (`sgc_outbox`) con backoff para contrato/anexos/subsanación.
- **Reconciliación programada**: `POST /api/cron/sgc-reconciliar` (header `x-cron-secret`) vía `.github/workflows/sgc-reconciliar.yml`; además `POST /api/sgc/sincronizar` manual. Reintenta expedientes en `estadoEnvio=error`.
- **M2M sin clave en local**.
- **Endpoints sensibles sin auth de handler** (`/api/upload`, RENIEC, SUNAT, KBServicios).
- **TLS deshabilitado globalmente** en clientes KBServicios y Planogess.
- **Payload SGC incompleto**: `counterpartyTaxIdentifier` vacío; `currency`/`totalMinorUnits` sin poblar.
