# API Requerida por el Sistema de Montaje (Contrato de Integración)

> Estado: contrato de consumo — el Sistema de Montaje consume datos de ContratosStands.
> Este documento es el **backlog** para la IA/equipo de ContratosStands: cada endpoint declarado aquí es lo que el SM espera consumir.
> Origen: `montaje-iimp` (`docs/integracion-ecosistema.md`, `docs/analisis-brechas.md`).

## 1. Ecosistema: 3 sistemas, 2 interconectados hoy

| Sistema | Responsabilidad | Interconectado con Montaje |
|---|---|---|
| **Sistema de Montaje** | Ejecución y cumplimiento SSOMA (expediente técnico, empresa, trabajadores, habilitación, puerta) | — |
| **ContratosStands** | Solicitudes de **alquiler de stands** por empresas exhibidoras (stands, reservas, aprobaciones por área) | ✅ Sí (hoy) |
| **Sistema de Contratos** | Temas **jurídicos** generales: emite y gestiona el estado legal del contrato | ⏳ Futuro (solo estado por webhook) |

> El **estado de contrato** legal (FIRMADO_Y_VIGENTE, RESCINDIDO, etc.) pertenece al **Sistema de Contratos** (3er sistema). Hasta que se integre, el SM usa un mock local.

## 1.1 PROPIEDAD DE DATOS — Stands y tipología son de ContratosStands (INNEGOCIABLE)

> **El catálogo de stands y la tipología técnica del stand (Tipo 1/2/3) pertenecen a ContratosStands.**
> El Sistema de Montaje **NUNCA** crea, edita ni almacena stands como catálogo: solo los **consume** (consulta en vivo o cachea la referencia `stand_ref` para la puerta offline-first) y les **cuelga su expediente técnico** (documentos, no el stand).

| Dato | Dueño | ContratosStands lo provee | El SM... |
|---|---|---|---|
| Empresas exhibidoras | ContratosStands | `GET /api/exhibidoras` | La vincula a la montajista por PK compartida (`id_empresa`) |
| Stands por exhibidora/evento | ContratosStands | `GET /api/stands/exhibidora` | Los lista en la ficha (en vivo), los cachea como `stand_ref` |
| **Tipología del stand (1/2/3)** | **ContratosStands** | **`tipologia_stand` en la respuesta del stand (NUEVO — requerido)** | La consume para exigir la matriz documental del expediente técnico |
| Estado/solicitud del stand | ContratosStands | `GET /api/stands/contrato` | Lo refleja como contexto del stand |

**Reglas para este repo (ContratosStands):**
1. El campo `tipologia_stand` (`1`=Complejo, `2`=Simple, `3`=Octanorm) **debe existir en la respuesta de cada stand** — se define en el contrato del stand con la exhibidora (no en el SM).
2. Los cambios de stand/tipología se reflejan vía el endpoint (el SM re-sincroniza por polling).
3. ContratosStands **nunca** recibe planos/memorias del expediente técnico (eso vive en el SM, colgado del `stand_api_id` que ContratosStands entrega).

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
| 1 | **Documentos Comerciales y Legales** | Sistema de Gestión de Contratos (SGC = ContratosStands) | Contrato Comercial de Stand/Convenio (formaliza la adquisición del espacio), Anexos Comerciales y Comprobantes de Pago (metraje y pagos/garantías), Cláusula de Requerimiento de Póliza RC (monto mínimo asegurado) | Solo referencia — integración pendiente (icono en la ficha del expediente) |
| 2 | **Documentos Técnicos de Stands** (Expediente Técnico) | Sistema de Montaje (bandejas Arq/Est/Elec) | Arquitectura: planos de distribución, plantas, cortes, elevaciones, renders 3D, acabados, alturas máximas de pabellón · Estructuras: memoria de cálculo, planos metálicas/madera, anclajes/rigging, colegiatura Ing. Civil · Electricidad: unifilares, cuadro de cargas (kW), cables ignífugos, pozo a tierra | Bandeja en construcción (NF-07) |
| 3 | **Expediente General / Empresa Montajista** (homologación SSOMA) | Sistema de Montaje (sube la montajista) | Certificado de Homologación, Póliza de RC (vigencia activa), Plan SSOMA/Matriz IPERC, Cronograma de Implementación y Desmontaje, Declaraciones Juradas, Ficha RUC y Datos Legales | ✅ Operativo por exhibidora vinculada |
| 4 | **Documentos de Trabajadores** (acreditación y personal) | Sistema de Montaje (sube la montajista) | DNI/Pasaporte/CE, SCTR Salud y Pensión, Seguro de Salud Regular, Pensión Regular (AFP/ONP), CUL, Aptitud Médica (EMO), Inducción SST, Permisos de Alto Riesgo (altura/caliente/eléctrico), Anexos Operativos de Campo (ATS, EPPs) | ✅ Operativo en el módulo de trabajadores |

> Regla de UI: la ficha del expediente de la empresa montajista muestra 1 icono por contexto documental (⚖️ comerciales/legales → 📐 técnicos → 🛡️ expediente general/SSOMA) por cada exhibidora vinculada. Los trabajadores (contexto 4) se gestionan en su propio módulo, no en la ficha.

## 3. Convenciones

- **Formato**: `{ success: boolean, data: T }` (mismo que el resto de la API de ContratosStands).
- **Autenticación**: endpoints de integración con **clave M2M** — el SM envía el header `x-api-key` con la clave compartida (`INTEGRACION_API_KEY`); en desarrollo local se permite consumo directo.
- **Llaves**: `id_empresa` = PK compartida de empresa; `stand_api_id` = identificador del stand (coincide con el payload del plano).
- **Evento**: la llave de evento compartida entre sistemas es el par **`tipoEvento` + `codigoEvento`** (NO el UUID local de evento, que difiere entre sistemas).
- **Tiempos**: el SM sincroniza por polling/reconciliación (botón manual + cron futuro).

## 4. Endpoints requeridos (solo datos de referencia de ContratosStands)

### 4.1 Listar empresas exhibidoras — `GET /api/exhibidoras`
- **Query**: `q?` (filtro por razón social o código).
- **Respuesta** (`data`):
```json
[{ "id_empresa": "E0000000779", "razon_social": "TELEFONICA MOVILES S.A" }]
```
- **Para qué**: el SM busca exhibidoras para que la **empresa montajista las vincule** (relación por PK compartida, sin duplicar maestro).
- **Estado**: implementado ✅.

### 4.2 Stands de una empresa exhibidora — `GET /api/stands/exhibidora`
- **Query**: `empresaId` (PK de empresa, obligatorio), `tipoEvento?`, `codigoEvento?` (filtro por evento compartido).
- **Respuesta** (`data`):
```json
[{
  "stand_api_id": "10",
  "stand_numero": "10",
  "tipo_stand": "PREFERENCIAL",
  "estado": "en_evaluacion",
  "pabellon": "762.00,344.00",
  "empresa": "TELEFONICA MOVILES S.A",
  "evento_id": "3cc3f9b8-...",
  "tipo_evento": 14,
  "codigo_evento": 1,
  "mapa": "pab-a"
}]
```
- **`evento_id` / `tipo_evento` / `codigo_evento`**: contexto transversal de evento. `tipo_evento`+`codigo_evento` es la **llave compartida** (el SM la usa para relacionar con su propio catálogo de eventos); `evento_id` es el UUID local de ContratosStands (referencia interna). Cuando la query no filtra por evento, cada stand puede venir de un evento distinto — por eso va por fila.
- **`mapa`**: código del mapa 3D (plano) al que pertenece el stand vía `bloqueId`. En un evento macro corresponde al plano del **pabellón** (plano hijo); en un evento simple, al plano del evento. `null` si el stand no está vinculado a un bloque.
- **`tipo_stand`**: clasificación comercial del stand (PREFERENCIAL / ESTANDAR_01 / ESTANDAR_02 / ISLAS, etc.). La tipología técnica (1/2/3) **NO se expone por esta API** — se define en el Sistema de Montaje según su propio criterio del expediente técnico.
- **Debe incluir**: stands **en proceso** (solicitudes activas/inactivas del usuario de la exhibidora, vía `solicitud.gessStandId` y `solicitud_stand`), además de los confirmados/reservados.
- **Para qué**: el SM muestra en la ficha de la montajista los stands de sus exhibidoras vinculadas (incluye "en proceso"), los asigna a la montajista y evalúa la habilitación.
- **Estado**: ruta **creada** en el repo de ContratosStands pero el **servidor en ejecución responde 404** — pendiente reiniciar/desplegar para que esté disponible. Validado contra datos reales (TELEFONICA → 12 stands en evaluación) cuando corrió la versión anterior.
- **Ajuste requerido**: el filtro de evento debe usar `tipoEvento`/`codigoEvento` (par compartido), no `eventoId` local.

### 4.3 Estado de contrato/solicitud por stand — `GET /api/stands/contrato`
- **Query**: `tipoEvento?`, `codigoEvento?` (ajuste requerido — hoy recibe `eventoId` local).
- **Respuesta** (`data`) según el repo actual de ContratosStands:
```json
[{
  "stand_api_id": "10",
  "estado_solicitud": "pendiente_pago | en_evaluacion | aprobada | ...",
  "estado_contrato": "FIRMADO_Y_VIGENTE | EN_REVISION | OBSERVADO | PENDIENTE_FIRMA | RESCINDIDO",
  "fecha_aprobacion": "2026-08-04T23:39:24.213Z",
  "id_contrato": "381ea720-..."
}]
```
- **Para qué**: el SM refleja el estado del stand ("en proceso" / habilitado) en la ficha de la montajista y lo usará en el Motor de Habilitación (rescisión → revocación).
- **Nota**: `estado_contrato` deriva de la solicitud (`mapearEstadoContrato`); el estado legal definitivo pertenece al Sistema de Contratos (3er sistema, integración futura).
- **Estado**: ruta **creada** en el repo de ContratosStands; **pendiente de ejecutar** (404 en el server actual) y de ajustar el filtro de evento.

### 4.4 Eventos — `GET /api/eventos` / `/api/eventos/presala`
- Ya consumidos por el SM (tipos y versiones de evento, con `tipo_evento`/`codigo_evento` y `eventoId` local).
- **Para qué**: filtrar stands/solicitudes por la **versión de evento** seleccionada en la sesión del SM.
- **Estado**: implementado ✅.

## 5. Fuera del alcance de ContratosStands (no crear aquí)

- ❌ **Estado de contrato legal** (FIRMADO_Y_VIGENTE, RESCINDIDO...): Sistema de Contratos (3er sistema).
- ❌ **Expediente técnico del stand** (planos/memorias por Arq/Est/Elec): proceso de montaje, se sube/revisa **en el SM**.
- ❌ Documentos SSOMA de empresas/trabajadores: proceso de montaje.
- ❌ Webhooks de documentos técnicos: no aplica.

## 6. Cómo se consume (implementación en el SM)

1. **Cliente server-side**: `src/backend/infrastructure/external/integracion-clients.ts` — fetch con `CONTRATOS_STANDS_URL`, header `x-api-key` (`INTEGRACION_API_KEY`), cache `no-store`.
2. **Sincronización** (`POST /api/integracion/stands-sync`): upsert de `stand_ref` por evento (botón manual + reconciliación futura por cron).
3. **Estado de contrato (futuro)**: webhook `POST /api/integracion/contratos-webhook` en el SM, emitido por el **Sistema de Contratos** — mientras tanto el SM usa mock local.
4. **Puerta / Motor de Habilitación**: lee **solo pivotes locales** (nunca a ContratosStands en el path del escaneo) — latencia < 500ms y offline-first.

## 7. Backlog pendiente para ContratosStands

- [ ] **PONER EN EJECUCIÓN las rutas de integración** — verificado: los 4 endpoints (`/api/exhibidoras`, `/api/stands/exhibidora`, `/api/stands/contrato`, `/api/stands/expedientes-tecnicos`) responden **404 en el server de ContratosStands**, aunque los archivos existen en el repo. Los archivos de ruta están en `src/app/api/stands/{exhibidora,contrato,expedientes-tecnicos}/route.ts` y `src/app/api/exhibidoras/route.ts`. El SM llama a `http://localhost:3001` (config correcta del lado del SM) — el 404 es del server de ContratosStands (build/reinicio pendiente), NO de la configuración del SM.
- ~~**Incluir `tipologia_stand` (`1`/`2`/`3`) en `GET /api/stands/exhibidora`**~~ — **DESCARTADO (cambio de plan)**: la tipología técnica del stand no se define desde el lado comercial de ContratosStands. El SM la determina según su propio criterio del expediente técnico. La API de ContratosStands NO expone esta propiedad.
- [ ] Ajustar `GET /api/stands/exhibidora` y `GET /api/stands/contrato` para filtrar por `tipoEvento`/`codigoEvento` (par compartido) en vez de `eventoId` local.
- [ ] Confirmar si el estado de la solicitud (`pendiente_pago`, `en_evaluacion`, etc.) debe reflejarse en el SM como "en proceso" del stand.
- [ ] Definir paginación/límites para eventos con cientos de stands.
- [ ] (Futuro) Contrato de integración con el **Sistema de Contratos** para el estado legal definitivo.
