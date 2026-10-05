# Integración API de stands del IIMP (liststand) — Vinculación

> Estado: **implementada** (cliente, sincronización, UI de Vinculación y pruebas).
> El servicio del IIMP es de **solo lectura**: lista los stands de un evento agrupados por
> pabellón y tipo, con número, área, precio y estado (`LIBRE`/`RESERVADO`). No reserva ni
> modifica nada del lado del IIMP; todo lo que se escribe queda en la BD local.
> Última alineación: `TipEvCod`/`EvenCod` como parámetros obligatorios, protección de datos
> locales en re-importación, filtro por pabellón y carga completa de registros (>1000).

## 1. Contexto y alcance

La página `/dashboard/vinculacion` (componente `GessMantenedor`) permite al administrador:

1. **Importar** los stands reales del evento desde el API del IIMP hacia la tabla local
   `gess_stand` (Paso 1 — Importar desde API).
2. **Vincular** cada registro de la BD con un bloque del plano 3D del evento
   (Paso 2 — Vincular a bloques 3D).

La integración reemplazó a los "datos demo" del mantenedor. El API de stands del IIMP
(`liststand`) entrega la fuente de verdad de pabellones, tipos, precios y disponibilidad.

```
IIMP (liststand, solo lectura)          ContratosStands
┌─────────────────────────┐   filas   ┌──────────────────────────┐
│ /auth/login             │ ────────► │ POST /api/planogess/fetch│  preview en pantalla
│ /stands/liststand       │           │ POST /api/gess/sync      │  upsert gess_stand
└─────────────────────────┘           └──────────────────────────┘
        token 30 min                        PATCH /api/gess/actualizar (bloqueId)
```

## 2. Resolución del evento versión

El API externo se consulta con dos códigos del **evento versión**:

| Parámetro API | Descripción | Origen en ContratosStands |
|---|---|---|
| `TipEvCod` | Tipo de evento (mismos códigos de `/ventas/voucher`) | `evento.tipoEvento` |
| `EvenCod` | Evento dentro de ese tipo | `evento.codigoEvento` |

La página de Vinculación resuelve la versión del evento activo de la sesión con
`GET /api/eventos/listar?id=<eventoId>` (fachada `eventosServiceClient.obtener`), toma
`tipoEvento`/`codigoEvento` de esa respuesta y los muestra en el encabezado:
`Evento versión: <nombre> (TipEvCod X / EvenCod Y)`. Si la versión no tiene códigos
válidos, el mantenedor no se renderiza (evita consultas `0/0`). El plano por defecto del
evento también se resuelve con esa versión.

## 3. API externa

Base de ambientes (doc del IIMP `API-LISTSTAND-INTEGRACION.md`):

| Ambiente | URL base |
|---|---|
| Pruebas | `https://secure2.iimp.org:8443/servicio-eventos-pruebas/api` |
| Producción | `https://secure2.iimp.org:8443/servicio-eventos/api` |

### 3.1 Autenticación

`POST /auth/login` con `{ "usuario", "clave" }` (cuenta técnica con acceso **VTA**,
la misma de `listtype` y `/ventas/voucher`). Devuelve `{ token, expiraEnSegundos }`;
el token dura **30 minutos y no tiene refresco**. El cliente lo cachea en memoria del
proceso y renueva/re-loguea al vencer (margen de 60 s antes de expirar).

### 3.2 Listado de stands

`POST /stands/liststand` con cabecera `Authorization: Bearer <token>` y body:

```json
{ "TipEvCod": 2, "EvenCod": 19, "Estado": "TODOS" }
```

- `Estado` es opcional: `TODOS` (por defecto), `LIBRE` o `RESERVADO` (no distingue mayúsculas).
- La respuesta agrupa `Pabellones[] → Tipos[] → Stands[]` con
  `Numero` (único en el evento), `Orden`, `Area`, `Precio`, `Moneda`, `Estado`.
- `Totales` cuenta todos los stands del evento sin importar el filtro.
- Un evento sin stands devuelve `Pabellones: []` (no es error).

El cliente `src/infrastructure/external/liststand-client.ts` aplana esa respuesta a filas:

| Fila aplanada | Origen |
|---|---|
| `stand` | `Numero` |
| `pabellon` / `pabellonCodigo` | `Pabellon.Nombre` / `Codigo` |
| `tipo` / `tipoCodigo` | `Tipo.Nombre` / `Codigo` |
| `area`, `precio`, `moneda`, `estado` | campos del stand |
| `orden` | `Orden` (para ordenamiento estable del IIMP) |

### 3.3 Errores del IIMP

| HTTP | Código | Significado | Manejo en la UI |
|---|---|---|---|
| 400 | `SOLICITUD_INVALIDA` / `JSON_INVALIDO` | Body/códigos inválidos | Mensaje del API |
| 401 | `NO_AUTORIZADO` | Token ausente/vencido | El cliente re-loguea automáticamente |
| 403 | `PROHIBIDO` | Cuenta sin acceso **VTA** | Mensaje del API (pedir VTA al IIMP) |
| 404 | `NO_ENCONTRADO` | No existe el evento `TipEvCod`/`EvenCod` | "Este evento no existe en el API de stands del IIMP." |
| 500 | `ERROR_INTERNO` | Error del IIMP (trae `identificador`) | Mensaje del API |

## 4. Flujo por dentro

### 4.1 Preview — `POST /api/planogess/fetch`

Recibe `{ tipoEvento, codigoEvento }`, llama al cliente liststand y devuelve las filas
aplanadas. La UI las muestra en una tabla con selección por fila y marca
**Nuevo** / **Ya importado** comparando `stand` contra los `standApiId` de la BD local.

### 4.2 Importación — `POST /api/gess/sync`

Recibe `{ eventoId, tipoEvento, codigoEvento, seleccionadas? }`. Si `seleccionadas` viene
vacío, consulta el API completo. Por cada fila:

- `uid = stand` (número único) → `standApiId` y `standCode`.
- `tipo` → `tipoStand`; `precio` + `moneda` → `medidas` (formato `"15000.00 USD"`).
- `estado`: `LIBRE` → `disponible`, `RESERVADO` → `reservado`.
- `pabellon` → `pabellon`; la fila original completa se conserva en `rawData`.
- **Upsert** por `(eventoId, standApiId)` (unique en BD): si existe actualiza, si no crea.
  Un re-import no genera duplicados.
- Devuelve `{ creados, actualizados, total }`, que la UI muestra como
  `Importado: N nuevos, M actualizados de T`.

### 4.3 Re-importación y datos protegidos

La re-importación refresca `tipoStand`, `medidas`, `pabellon` y `rawData`, pero **no pisa
datos locales de negocio**:

- **Estado**: si el stand está en estado gestionado por el portal
  (`en_evaluacion` o `reservado`) y el API aún lo reporta `LIBRE`, se conserva el local.
  Si el API reporta `RESERVADO`, ese valor sí se aplica (la venta del IIMP manda).
- **Empresa**: solo se escribe si el API la trae; una respuesta sin empresa no borra la local.
- **Vínculo 3D** (`bloqueId`), documentos e imágenes: el update es parcial y no los toca.

En la UI, las filas **Ya importado** tienen el checkbox deshabilitado, "Seleccionar todo"
solo toma las nuevas y el botón dice `Importar N nuevos a BD`. El import sigue siendo una
acción manual del administrador: nada se sincroniza solo.

### 4.4 Carga completa en la UI

La fachada `gessService.all()`/`listAll()` recorre **todas las páginas** del listado local
(`per_page=1000` + páginas restantes). Antes se truncaba en 1000 filas y los últimos
stands (p. ej. `M-*`) aparecían como "Nuevos". El evento PERUMIN 38 tiene 967 stands.

## 5. UI de Vinculación (`/dashboard/vinculacion`)

- **Paso 1 — Importar desde API**: "Cargar datos del API", tabla con columnas del API,
  selección de nuevas, "Importar N nuevos a BD". Muestra contador
  `N de M nuevos · X ya importados`.
- **Paso 2 — Vincular a bloques 3D**: carga los bloques de los planos del evento
  (`GET /api/planos/planos-evento`, macro + pabellones hijos), **filtro por pabellón**
  ("Todos los pabellones" + cada plano con bloques), búsqueda por stand/empresa/tipo,
  paginación y vínculo por combobox (`PATCH /api/gess/actualizar { id, bloqueId }`, con
  desvinculación previa del bloque para respetar la unicidad `[eventoId, bloqueId]`).

## 6. Configuración (.env)

```bash
# Pruebas (por defecto en .env.example)
LISTSTAND_API_URL="https://secure2.iimp.org:8443/servicio-eventos-pruebas/api"
# Producción (usada mientras Pruebas no tenga stands cargados)
# LISTSTAND_API_URL="https://secure2.iimp.org:8443/servicio-eventos/api"
LISTSTAND_USUARIO="<cuenta tecnica con acceso VTA>"
LISTSTAND_CLAVE="<clave>"
```

Sin `LISTSTAND_USUARIO`/`LISTSTAND_CLAVE` la llamada falla con un mensaje de configuración.
Variables solo de servidor (el cliente corre en el backend, en `src/infrastructure/external`).

## 7. Operación y notas

- **Solo lectura** del lado del IIMP; se puede llamar las veces que haga falta.
- La disponibilidad cambia en vivo: no cachear; consultar antes de mostrar/importar.
- El token dura 30 min y se renueva solo (cache en memoria del proceso).
- El certificado de `secure2.iimp.org:8443` es self-signed: el cliente desactiva
  temporalmente la verificación TLS durante la llamada y la restaura al terminar.
- Pruebas vs producción (estado actual): Pruebas responde `Totales.Stands = 0`
  (`Pabellones: []`); Producción devuelve los 967 stands de PERUMIN 38. Mientras el IIMP
  valide los casos, se usa el ambiente de Producción cambiando una línea del `.env`.

## 8. Pruebas

- `src/infrastructure/external/__tests__/liststand-client.test.ts` — login + caché de token,
  aplanado de la respuesta, error 403 y re-login ante 401.
- `src/application/gess/__tests__/gess-service.test.ts` — mapeo del API, upsert sin duplicar,
  protección de estado/empresa en re-importación y `RESERVADO` del API sobre estado local.

## 9. Referencias

- Doc del IIMP: `API-LISTSTAND-INTEGRACION.md` (entregada por el IIMP).
- Funcional: `docs/01-funcional/06-eventos-datos-y-stands.md` (§5 Vinculación).
- Inventario de endpoints: `docs/04-api/api-inventario.md` (§3.4 GESS, §3.6 Planogess).
- OpenAPI: `docs/04-api/openapi.yaml` (tag `Gess`, `/gess/sync`, `/planogess/fetch`).
- Código: `src/infrastructure/external/liststand-client.ts`,
  `src/application/gess/gess-service.ts`, `src/components/gess/gess-mantenedor.tsx`,
  `src/app/(dashboard)/dashboard/vinculacion/page.tsx`.
