# Portal público, plano y reserva

> Fuente: `src/app/(public)/**`, `src/app/presala/page.tsx`, `src/app/auth/login/page.tsx`,
> `src/components/plano/**`, `src/app/api/{planos,gess,planogess,reservas,auth}/**`.

## 1. Propósito

Permitir que una empresa exhibidora **seleccione un evento, vea el plano de stands y
reserve uno o varios stands**, adjuntando los datos comerciales y la documentación. El
registro crea la solicitud que luego recorren las áreas.

## 2. Rutas y acceso

| Ruta | Página | Acceso |
|---|---|---|
| `/` | Home pública: eventos vigentes y selección de versión | Público (`constants.ts:16-21`) |
| `/presala` | Selección formal de evento/versión | Público |
| `/auth/login` | Ingreso | Público |
| `/403` | Acceso denegado | Público |
| `/plano` | Plano isométrico 3D (registro en código) | `stands:plano` + `eventoId` (`middleware.ts:34`) |
| `/mapa` | Plano dinámico: `macro` (pabellones) o `simple` (3D desde BD) | `stands:plano` + `eventoId` (`middleware.ts:35`) |
| `/plano-grid` | Reconstrucción 2D de 52 bloques (**maqueta**) | `stands:plano` (capturado por `/plano`) |

> El grupo `(public)` **no implica acceso público**: `/plano`, `/mapa` y `/plano-grid`
> siguen protegidos por `src/middleware.ts`. Sin `eventoId` (y no admin) redirige a `/presala`.

## 3. Flujo funcional

### 3.1 Selección de evento
1. `/` o `/presala` listan versiones de evento (`GET /api/eventos/listar?presala=1`, público con `presala=1`).
2. La vertical se deriva del código de evento: `2→perumin`, `5→proexplo`, `7/13→wmc`, `14→gess`, fallback `eventos` (`presala-service.ts:6-12`).
3. Sin sesión: guarda `VERTICAL` y `EVENTO_PUBLICO` en localStorage, aplica theming y va a login (`presala/page.tsx:83-99`).
4. Con sesión: `POST /api/auth/seleccionar-evento` reemite el JWT con `eventoId` y navega (`auth-service.ts:52-78`).

### 3.2 Carga del plano
- `/plano`: resuelve el código de plano del evento y renderiza `PlanoIsometrico` (hardcodea `requirePlano("gess")`, `plano-isometrico.tsx:244`).
- `/mapa`: `GET /api/planos/publico`; si `payload.tipo === "macro"` → `MacroMapaView`, si no → `PlanoDinamico` (`mapa/page.tsx:92-116`).
- `PlanoDinamico` intenta `GET /api/planos/publico?codigo=…` y cae al registro en código (`registry.ts:96-128`).
- Si la BD no tiene stands, se dispara `gessService.sync` contra el API externo.

### 3.3 Selección múltiple
- Estado `selectedIds` por plano (`plano-isometrico.tsx:391-398`, `plano-dinamico.tsx:406-413`).
- Clic en bloque reservado → reemplaza la selección por ese bloque; si está libre → agrega/quita.
- El botón **Reservar** se deshabilita si hay bloques reservados (y en `/mapa`, si hay bloques sin stand vinculado).
- Sin sesión: guarda `PLANO_SELECCION` en localStorage y va a login con `returnTo` que reabre el modal.
- Bloques sin `dbId` (sin `GessStand` vinculado) no son reservables en `/mapa` (badge "sin stand").

### 3.4 Modal de reserva — 3 pasos
Definidos en `RESERVA_STEPS` (`constants.ts:514-520`): `DATOS`, `DOCUMENTOS`, `CONFIRMACION`.
Lógica en `src/components/plano/reserva/use-reserva-form.ts`.

1. **DATOS** (`step-datos.tsx`): comprobante desde maestra `comprobante_tipo`; factura → RUC (11) + razón social, boleta → DNI (8). Autocompleta con SUNAT/RENIEC; teléfono `/^9\d{8}$/`, email y dirección obligatorios.
2. **DOCUMENTOS** (`step-documentos.tsx`):
   - **1 stand**: obligatorio adjuntar contrato firmado (PDF/JPG/PNG/DOCX, 10 MB declarado); descarga los formatos del stand.
   - **N stands**: sin documentos; el admin sube el contrato y el cliente lo adjunta después (ver [02-solicitudes-y-aprobaciones.md](./02-solicitudes-y-aprobaciones.md)).
3. **CONFIRMACION** (`step-confirmacion.tsx`): resumen + checkbox obligatorio de términos y condiciones.

El borrador se guarda en IndexedDB por conjunto de IDs y se borra tras el envío (`use-reserva-form.ts:10-84`).

### 3.5 Registro
- `POST /api/reservas/crear` con `{ standIds[], documentos?, datos? }` (`reserva.validator.ts:3-12`).
- Backend (`reserva-service.ts:15-113`): valida que los stands estén `disponible`; los pasa a `en_evaluacion`; crea `Solicitud` + `Revision` iniciales; genera alertas (a Logística y, si multi-stand, al cliente y al admin) y envía correos.
- Post-envío: 1 stand muestra toast; N stands muestra modal con el flujo de 5 pasos.

## 4. Endpoints del módulo

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/eventos/listar?presala=1` | Listar versiones de evento (público) |
| `POST` | `/api/auth/login` · `GET /api/auth/session` · `POST /api/auth/seleccionar-evento` | Sesión |
| `GET` | `/api/planos/publico?codigo=` \| `?tipoEvento&codigoEvento&eventoId` | Definición del plano (+ ocupación en macro) |
| `GET` | `/api/gess/listar?eventoId=` \| `?bloqueId=` | Stands del evento / por bloque |
| `POST` | `/api/gess/sync` · `/api/gess/mockup` | Importar stands desde API externa / generar demo |
| `PATCH` | `/api/gess/actualizar` | Vincular bloque, documentos, imágenes, estado |
| `POST` | `/api/planogess/fetch` | Fetch crudo al API externo de stands |
| `POST` | `/api/reservas/crear` | Crear la solicitud |
| `POST` | `/api/upload` | Subir archivos |
| `GET` | `/api/maestra/listar?tabla=` | Catálogos (comprobantes, estados) |
| `GET` | `/api/sunat/ruc` · `/api/reniec/dni` | Autocompletado de documento |

## 5. Estados

- **Stand**: `disponible` → `en_evaluacion` (al registrar) → `reservado` (al aprobar/facturar). También se reconocen etiquetas legacy (`Reservado`, `En evaluacion`, `available`, `reserved`).
- **Evento**: solo `active` + `flgActivo` + `flgVisible` + fecha vigente aparecen en presala.
- **Reserva/Solicitud**: ver [02-solicitudes-y-aprobaciones.md](./02-solicitudes-y-aprobaciones.md).

## 6. Reglas de negocio

- Un stand reservado no se puede volver a reservar; al seleccionarlo se aisla la selección.
- Selección múltiple (1 o N) en una sola operación.
- 1 stand → documento obligatorio; N stands → sin documento (flujo posterior).
- Documento según comprobante: factura → RUC 11, boleta → DNI 8.
- Un bloque sin stand GESS vinculado no es reservable en `/mapa`.
- Un plano `simple` puede pertenecer a un solo `macro`.

## 7. Limitaciones y observaciones

- **`/plano-grid` es maqueta**: botones de descarga/adjunto sin acción y sin conexión a GESS (`plano-grid-2d.tsx:206-222`).
- **`/plano` hardcodea el plano `gess`** (`plano-isometrico.tsx:244`); solo `/mapa` resuelve el plano real.
- **`POST /api/reservas/crear`, `/api/gess/*` y `/api/planogess/*` no validan sesión en el middleware**; pueden invocarse sin token (riesgo, ver [../07-seguridad](../07-seguridad)).
- **Sin transacción**: si hay conflicto de stands, la respuesta es 409 pero los stands ya actualizados quedan en `en_evaluacion` (`reserva-service.ts:27-47`).
- Precios/tipos hardcodeados en el servicio GESS (`gess-service.ts:6-36`).
- Clientes hacia KB/Planogess **desactivan la verificación TLS** temporalmente.
- `NEXT_PUBLIC_API_MOCK=1` activa la fachada mock (solo servicios de fachada, no los `fetch` directos).
