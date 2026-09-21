# Eventos, datos del evento y stands

> Fuente: `src/app/(dashboard)/dashboard/{eventos,datos-evento,stands,vinculacion}/**`,
> `src/components/{admin,gess,stands,plano}/**`, `src/app/api/{eventos,gess,maestra,planogess}/**`.

## 1. Propósito

Administrar el catálogo de eventos (padre–versión), consultar los datos/precios del evento,
gestionar la documentación de stands y **vincular los stands importados de GESS a los
bloques del plano 3D**.

## 2. Roles y permisos

| Módulo | Permiso | Quién |
|---|---|---|
| Eventos | `events:manage` | admin |
| Datos del evento | `eventos:datos` | todos los roles |
| Gestión de stands | `stands:manage` | admin, logistica |
| Vinculación | `stands:vinculacion` | admin |

## 3. Módulo Eventos

- Página `/dashboard/eventos`; componente `EventosMantenedor`.
- Modelo **padre–versión**: `EventoPadre` + `Evento`; metadata de visibilidad/plano en `EventoMetadata` (`prisma/schema.prisma:13-69`).
- Lista tarjetas por evento padre con sus versiones; diálogo "Editar metadata" permite **solo dos campos**: `plano` (mapa 3D) y `flg_visible`.
- Regla: un mapa 3D solo puede estar asignado a un evento a la vez (`evento-service.ts:57-67`).
- Presala combina la API externa KB con `evento_metadata` y filtra `active` + vigencia (`presala-service.ts:34-87`).
- Endpoints: `GET /api/eventos/listar[?presala=1&id=]`, `POST /api/eventos/crear`, `PATCH /api/eventos/actualizar`.
- Estados: `ESTADOS_EVENTO` (`draft`, `active`, `closed`, `cancelled`).

## 4. Módulo Datos del Evento

- Página `/dashboard/datos-evento`; componente `DatosEventoManager`. **Solo lectura**.
- Carga paginada `GET /api/gess/listar?eventoId=`; columnas: código, tipo, estado, empresa, bloque, medidas.
- Sin gestión de tarifario: los datos vienen de `gess_stand`.

## 5. Módulo Stands + GESS + Vinculación

### 5.1 Gestión de stands (documentos/imágenes)
- Página `/dashboard/stands`; componente `StandsManager`.
- Sube contrato PDF/DOC/DOCX e imágenes vía `POST /api/upload`; guarda con `PATCH /api/gess/actualizar { id, documentos, imagenes }`.
- Etiquetas de estado desde maestra `stand_estado`.

### 5.2 Vinculación (importar + vincular)
- Página `/dashboard/vinculacion`; componente `GessMantenedor`, flujo en 2 pasos:
  1. **Importar desde API**: `POST /api/planogess/fetch` (o "Generar datos demo" con `POST /api/gess/mockup`), selección de filas y `POST /api/gess/sync`.
  2. **Vincular a bloques 3D**: carga bloques del evento (`GET /api/planos/planos-evento`), y `PATCH /api/gess/actualizar {id, bloqueId}`. Al reasignar, primero desvincula el bloque previo (unicidad `[eventoId, bloqueId]`).

### 5.3 Sincronización API→BD (`GessStand`)
- `sync` extrae `uid`, `tipo`, `status/estado`, `company/empresa`, `pabellon = x,y`, conserva `rawData` y hace upsert por `[eventoId, standApiId]`.
- Cliente externo `planogess-client.ts` hace POST con `{TIPEVCOD, EVENCOD}` y **desactiva la verificación TLS** al llamar.
- Catálogo de tipos/precios **hardcodeado** (`gess-service.ts:6-36`): `Preferencial`, `Estandar A`, `Estandar B/Columna`, `Isla Grande`.

### 5.4 Endpoints

| Método | Ruta | Acción |
|---|---|---|
| `GET` | `/api/gess/listar?eventoId=` \| `?bloqueId=` | Stands del evento / por bloque |
| `PATCH` | `/api/gess/actualizar` | Vincular, documentos, imágenes, estado |
| `POST` | `/api/gess/sync` · `/api/gess/mockup` | Importar / demo |
| `POST` | `/api/planogess/fetch` | Fetch crudo al API externo |
| `GET` | `/api/maestra/listar?tabla=` | Catálogos (`stand_estado`, `stand_tipologia`, …) |
| `GET` | `/api/planos/planos-evento?tipoEvento&codigoEvento` | Bloques del evento (macro + hijos) |

## 6. Estados de stand

`ESTADOS_STAND` (`disponible`, `en_evaluacion`, `reservado`) + etiquetas legacy de GESS/KB
(`Reservado`, `En evaluacion`, `available`, `reserved`). IDs de maestra: 1/2/3.
`TIPOLOGIAS_STAND`: `1` Complejo, `2` Simple, `3` Octanorm simple.

## 7. Limitaciones y observaciones

- **`/api/gess/*` y `/api/planogess/*` sin autenticación** en el middleware (`middleware.ts:51-73`): un anónimo podría modificar stands e importar datos.
- **`events:create`/`events:edit`/`events:toggle` no se aplican**: solo se usa `events:manage`, y la UI no permite crear eventos ni cambiar `estado`.
- **Doble almacenamiento de evento** (`evento` vs `evento_metadata`): la presala y la asignación de planos leen `evento_metadata`; `estado`/`anio` no se propagan a metadata.
- **`medidas` contiene precios**, no dimensiones (`"3000.00 US$"`), y así se etiqueta en la UI.
- **`TipoStand` y `Stand` no se usan** en la aplicación (solo schema y scripts de seed).
- **Baja de usuario de rol probablemente rota**: el cliente envía `DELETE` por querystring, el controlador lee `request.json()`.
- **Alta de usuario con contraseña por defecto `123456`**; sin UI para fijarla.
- Acoplamiento: la vinculación llama `GET /api/planos/planos-evento`, que exige `laboratorio:view`.
- Clientes KB/Planogess **desactivan TLS** temporalmente.
- Sin tests para eventos/gess/roles.
