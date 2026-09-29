# API de integración con el Sistema de Montaje (contrato)

> Estado: **contrato acordado** con el Sistema de Montaje (SM) e implementado en ContratosStands.
> El SM consume datos de **referencia** de ContratosStands (no crea ni edita stands).
> Este documento describe lo que ContratosStands expone; el detalle de consumo vive en `montaje-iimp`.
> Última alineación: estado comercial, `estado_solicitud`, `pabellon` (sección del macro), `zona`, `x`/`y`,
> `mapa`, y `tipoEvento`/`codigoEvento` requeridos.

## 1. Ecosistema: 3 sistemas, 2 interconectados hoy

| Sistema | Responsabilidad | Interconectado con Montaje |
|---|---|---|
| **Sistema de Montaje (SM)** | Ejecución y cumplimiento SSOMA (expediente técnico, empresa, trabajadores, habilitación, puerta) | — |
| **ContratosStands** | Solicitudes de **alquiler de stands** por empresas exhibidoras (stands, reservas, aprobaciones por área) | Sí (hoy) |
| **Sistema de Contratos** | Temas **jurídicos** generales: emite y gestiona el estado legal del contrato | Futuro (solo estado por webhook) |

> El **estado de contrato legal** (FIRMADO_Y_VIGENTE, RESCINDIDO, etc.) pertenece al **Sistema de Contratos** (3er sistema). Hasta que se integre, el SM usa un mock local.

## 1.1 Propiedad de datos — Stands y tipología son de ContratosStands

> **El catálogo de stands y la tipología técnica del stand (Tipo 1/2/3) pertenecen a ContratosStands.**
> El Sistema de Montaje **nunca** crea, edita ni almacena stands como catálogo: solo los **consume** (consulta en vivo o cachea la referencia `stand_ref` para la puerta offline-first) y les **cuelga su expediente técnico** (documentos, no el stand).

| Dato | Dueño | ContratosStands lo provee | El SM... |
|---|---|---|---|
| Empresas exhibidoras | ContratosStands | `GET /api/exhibidoras` | La vincula a la montajista por PK compartida (`id_empresa`) |
| Stands por exhibidora/evento | ContratosStands | `GET /api/stands/exhibidora` | Los lista en la ficha (en vivo) y los cachea como `stand_ref` |
| Tipología del stand (1/2/3) | Sistema de Montaje | **No aplica** (descartado) | La determina el SM según su propio criterio del expediente técnico |
| Estado/solicitud del stand | ContratosStands | `GET /api/stands/exhibidora` (`estado`, `estado_solicitud`) y `GET /api/stands/contrato` | Lo refleja como contexto del stand |

**Reglas para ContratosStands:**
1. La API **no** expone la tipología técnica (1/2/3); el SM la define.
2. Los cambios de stand se reflejan vía el endpoint (el SM re-sincroniza por polling).
3. ContratosStands **nunca** recibe planos/memorias del expediente técnico (eso vive en el SM, colgado del `stand_api_id`).

## 2. Matriz de responsabilidades por contexto de proceso

| Contexto | Sistema dueño | Procesos | Documentos |
|---|---|---|---|
| **Solicitudes y stands** | ContratosStands | Solicitudes de alquiler, aprobaciones por área, reservas de stands | Contrato de alquiler del stand |
| **Jurídico general** | Sistema de Contratos (3er sistema) | Contratos en sentido amplio, firmas, rescisiones | Contratos legales |
| **Ejecución / SSOMA** | Sistema de Montaje | Expediente técnico del stand (Arq/Est/Elec), expediente de la empresa, trabajadores, habilitación, puerta | Planos, memorias, SSOMA, SCTR, CUL, EMO, permisos |

Regla: ContratosStands **nunca** recibe documentos técnicos de montaje; el Montaje **nunca** sube documentos a ContratosStands (solo consulta datos de referencia).

## 2.1 Contexto documental del evento (4 orígenes, UI del SM)

| # | Grupo | Origen | Documentos | Estado en SM |
|---|---|---|---|---|
| 1 | **Documentos Comerciales y Legales** | Sistema de Gestión de Contratos (SGC = ContratosStands) | Contrato Comercial de Stand/Convenio, Anexos Comerciales y Comprobantes de Pago, Cláusula de Requerimiento de Póliza RC | Solo referencia — integración pendiente |
| 2 | **Documentos Técnicos de Stands** (Expediente Técnico) | Sistema de Montaje (bandejas Arq/Est/Elec) | Arquitectura, Estructuras, Electricidad | Bandeja en construcción |
| 3 | **Expediente General / Empresa Montajista** (homologación SSOMA) | Sistema de Montaje | Certificado de Homologación, Póliza RC, Plan SSOMA/IPERC, Cronograma, Declaraciones Juradas, Ficha RUC | Operativo por exhibidora vinculada |
| 4 | **Documentos de Trabajadores** | Sistema de Montaje | DNI/CE, SCTR, Seguros, CUL, EMO, Inducción SST, Permisos de Alto Riesgo, ATS/EPPs | Operativo en el módulo de trabajadores |

## 3. Convenciones

- **Formato**: `{ success: boolean, data: T }` (igual que el resto de la API).
- **Autenticación**: endpoints de integración con **clave M2M** — el SM envía el header `x-api-key` con la clave compartida (`INTEGRACION_API_KEY`). En desarrollo local se permite consumo directo.
- **Llaves**: `id_empresa` = PK compartida de empresa; `stand_api_id` = identificador del stand.
- **Evento**: la llave compartida es el par **`tipoEvento` + `codigoEvento`** (NO el UUID local `evento_id`).
- **Tiempos**: el SM sincroniza por polling/reconciliación.

## 4. Endpoints

### 4.1 Listar empresas exhibidoras — `GET /api/exhibidoras`

- **Query**: `q?` (filtro por razón social o código).
- **Respuesta** (`data`):
```json
[{ "id_empresa": "E0000000779", "razon_social": "TELEFONICA MOVILES S.A" }]
```
- **Para qué**: el SM busca exhibidoras para que la **empresa montajista las vincule** (PK compartida).
- **Estado**: implementado y desplegado.

### 4.2 Stands de una empresa exhibidora — `GET /api/stands/exhibidora`

- **Query**:
  - `empresaId` (**requerido**): PK de empresa (SIE).
  - `tipoEvento` (**requerido**): número.
  - `codigoEvento` (**requerido**): número.
  - Si falta cualquiera de los tres → **400** (`empresaId requerido` / `tipoEvento y codigoEvento requeridos`).
  - Con `tipoEvento`+`codigoEvento` la respuesta queda acotada a ese evento (evita mezclar stands de otros eventos).
- **Respuesta** (`data`), por stand:

| Campo | Tipo | Descripción |
|---|---|---|
| `stand_api_id` | string | Identificador del stand (`gess_stand.standApiId`, fallback `id`). |
| `stand_numero` | string | Código visible del stand (ej. `BLOQUE-06`). |
| `tipo_stand` | string \| null | Clasificación comercial real: `PREFERENCIAL`, `ESTANDAR_01`, `ESTANDAR_02`, `ISLAS`, … (no se cambia). |
| `estado` | string \| null | **Estado comercial**: `disponible` \| `en_evaluacion` \| `reservado`. |
| `estado_solicitud` | string \| null | Estado crudo de la solicitud asociada (`pendiente`, `en_proceso`, `aprobado`, `pendiente_pago`, `pagado`, `rechazado`). Trazabilidad. |
| `pabellon` | string \| null | **Nombre legible del pabellón** (sección del macro que enlaza al plano del stand). `null` si el plano no cuelga de un macro. **Nunca coordenadas.** |
| `zona` | string \| null | Zona/sector. Hoy `null` (sin fuente definida). |
| `x` | number \| null | Coordenada X (parseada de `gess_stand.pabellon`). |
| `y` | number \| null | Coordenada Y (parseada de `gess_stand.pabellon`). |
| `mapa` | string \| null | Código del plano (ej. `gess`, `perumin-pab`). |
| `empresa` | string \| null | Nombre de empresa del stand (puede ser `null`; el SM consulta por `empresaId`). |
| `evento_id` | string | UUID local del evento (referencia interna). |
| `tipo_evento` / `codigo_evento` | number | Llave compartida del evento. |

Ejemplo:
```json
{
  "stand_api_id": "BLOQUE-06",
  "stand_numero": "BLOQUE-06",
  "tipo_stand": "ESTANDAR_01",
  "estado": "reservado",
  "estado_solicitud": "pagado",
  "pabellon": "Pabellon D",
  "zona": null,
  "x": 8.5,
  "y": 9.25,
  "mapa": "perumin-pab",
  "empresa": null,
  "evento_id": "3cc3f9b8-...",
  "tipo_evento": 2,
  "codigo_evento": 19
}
```

**Reglas de `estado` (comercial)**

| Estado | Regla |
|---|---|
| `disponible` | Sin solicitud activa, o solicitud `rechazado`. |
| `en_evaluacion` | Solicitud activa en revisión (`pendiente` / `en_proceso`). Es **comercial**, no evaluación técnica del layout. |
| `reservado` | Solicitud `aprobado`, `pendiente_pago` o `pagado`. |

- Se toma la **solicitud activa más avanzada** del stand (un stand se reserva una sola vez, sin importar qué empresa consulta).
- Etiquetas legacy toleradas por el SM: `available`, `reserved`, `Reservado`, `En evaluacion`.

**Reglas de `pabellon`**
- Fuente: en el **Laboratorio 3D**, los pabellones son las **secciones de un mapa macro** que enlazan a un mapa hijo (plano) donde viven los stands. `pabellon` = `plano_seccion.nombre` de la sección del macro que apunta al plano del stand (ej. `"Pabellon D"`), administrable desde el laboratorio.
- Si el plano del stand **no** cuelga de un macro → `null`.
- El nombre del plano va en `mapa`, **nunca** en `pabellon`.

- **Debe incluir**: stands **en proceso** (solicitudes activas del usuario de la exhibidora, vía `solicitud.gessStandId` y `solicitud_stand`), además de los confirmados/reservados.
- **Estado**: implementado y desplegado.

### 4.3 Estado de contrato/solicitud por stand — `GET /api/stands/contrato`

- **Query**: `tipoEvento?`, `codigoEvento?`.
- **Respuesta** (`data`):
```json
[{
  "stand_api_id": "10",
  "estado_solicitud": "pendiente_pago",
  "estado_contrato": "FIRMADO_Y_VIGENTE | EN_REVISION | OBSERVADO | PENDIENTE_FIRMA | RESCINDIDO",
  "fecha_aprobacion": "2026-08-04T23:39:24.213Z",
  "id_contrato": "381ea720-..."
}]
```
- **Para qué**: el SM refleja el estado del stand en la ficha de la montajista y lo usa en el Motor de Habilitación (rescisión → revocación).
- **Nota**: `estado_contrato` deriva de la solicitud (`mapearEstadoContrato`); el estado legal definitivo pertenece al Sistema de Contratos (integración futura).
- **Estado**: implementado y desplegado.

### 4.4 Eventos — `GET /api/eventos`

- Ya consumido por el SM (tipos y versiones de evento con `tipo_evento`/`codigo_evento`).
- **Estado**: implementado.

## 5. Fuera del alcance de ContratosStands (no crear aquí)

- Estado de contrato legal (FIRMADO_Y_VIGENTE, RESCINDIDO...): Sistema de Contratos (3er sistema).
- Expediente técnico del stand (planos/memorias por Arq/Est/Elec): proceso de montaje (se sube/revisa **en el SM**).
- Documentos SSOMA de empresas/trabajadores: proceso de montaje.
- Webhooks de documentos técnicos: no aplica.

## 6. Cómo se consume (implementación en el SM)

1. **Cliente server-side**: fetch con `CONTRATOS_STANDS_URL`, header `x-api-key` (`INTEGRACION_API_KEY`), cache `no-store`.
2. **Sincronización**: upsert de `stand_ref` por evento (botón manual + reconciliación por cron).
3. **Estado de contrato (futuro)**: webhook del **Sistema de Contratos**; mientras tanto el SM usa mock local.
4. **Puerta / Motor de Habilitación**: lee **solo pivotes locales** (nunca a ContratosStands en el path del escaneo) — latencia < 500 ms y offline-first.

## 7. Backlog / pendientes

- [x] Rutas de integración en ejecución (`/api/exhibidoras`, `/api/stands/exhibidora`, `/api/stands/contrato`).
- [x] `GET /api/stands/exhibidora` filtra por `tipoEvento`/`codigoEvento` y **los requiere** (400 si faltan).
- [x] `estado` comercial + `estado_solicitud` en `GET /api/stands/exhibidora`.
- [x] `pabellon` legible (sección del macro) + `x`/`y` (coordenadas aparte) + `mapa`.
- [ ] **`zona`**: definir fuente/formato (hoy `null`).
- [ ] `tipo_stand_label` legible: opcional (el SM lo acepta, no es obligatorio).
- [ ] Paginación/límites para eventos con cientos de stands.
- [ ] (Futuro) Contrato de integración con el **Sistema de Contratos** para el estado legal definitivo.
