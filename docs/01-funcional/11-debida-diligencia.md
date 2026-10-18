# Debida Diligencia (DD) — Documento funcional

> **Estado:** implementado y verificado en el repositorio.
> **Módulo:** Debida Diligencia (DD), separado del resto de módulos por permisos `dd:*`.
> **Diseño de referencia:** [`10-debida-diligencia-stitch.md`](./10-debida-diligencia-stitch.md).
> **Fuente de verdad técnica:** `src/lib/shared/constants.ts`, `src/application/debida-diligencia/`, `src/infrastructure/persistence/debida-diligencia-repository.ts` y `docs/04-api/openapi.yaml`.

---

## 1. Propósito

Registrar y evaluar la debida diligencia de las empresas que participan en un evento
del IIMP. El módulo cubre:

- consentimiento de tratamiento de datos personales y derechos ARCO;
- consentimiento de debida diligencia reforzada;
- datos de la empresa, representante legal y beneficiarios finales con 10% o más de
  participación;
- carga de documentos de sustento;
- revisión de Logística;
- revisión reputacional de Comunicaciones;
- vigencia de seis meses y panel de control por evento.

La debida diligencia aplica a empresas. La debida diligencia básica para personas
naturales pertenece a otros procesos del IIMP y no forma parte de este módulo.

---

## 2. Actores y permisos

Los permisos del módulo están aislados con el prefijo `dd:`. El rol `admin` siempre
pasa por `admin:full`; los demás roles requieren el permiso explícito.

| Rol | Permisos DD | Uso |
|---|---|---|
| `admin` | todos (`admin:full`) | Acceso total y configuración |
| `cliente` | `dd:formulario` | Completa el wizard de su empresa y consulta su estado |
| `logistica` | `dd:ver`, `dd:panel`, `dd:revision` | Revisa documentos, resuelve expedientes y deriva nombres |
| `comunicacion` | `dd:ver`, `dd:reputacion` | Revisión reputacional de nombres y sitios web |
| `legal` | `dd:ver`, `dd:legal` | Revisa expedientes derivados, adjunta informe legal y resuelve |
| `asociado` | — | No participa en este módulo |

Constantes: `PERMISSIONS.DD_*` y `ROLES_PERMISSIONS` en
`src/lib/shared/constants.ts`.

---

## 3. Rutas y pantallas

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/dashboard/debida-diligencia` | Landing según rol: panel, bandeja, reputación o “Mi debida diligencia” | Autenticado |
| `/dashboard/debida-diligencia/formulario` | Wizard de 4 pasos | `dd:formulario` |
| `/dashboard/debida-diligencia/bandeja` | Bandeja de revisión de Logística | `dd:revision` |
| `/dashboard/debida-diligencia/reputacion` | Revisión reputacional de Comunicaciones | `dd:reputacion` |

El sidebar muestra las opciones del módulo dentro de la sección **Debida Diligencia**.
El cliente solo ve **Mi debida diligencia**. Logística ve **Panel DD** y
**Bandeja DD**. Comunicaciones ve **Revisión reputacional**.

---

## 4. Flujo funcional

### 4.1 Cliente (Portal del Expositor)

1. Ingresa con su cuenta y un evento activo.
2. Si su cuenta no está vinculada a una empresa, el sistema lo envía al perfil.
3. Si no tiene expediente en el evento, se crea un borrador con código
   `DD-AAAA-NNNN`.
4. Completa el wizard:
   - **Paso 1 — Consentimientos:** datos personales/ARCO y debida diligencia
     reforzada. Ambos son obligatorios.
   - **Paso 2 — Empresa:** tipo de relación comercial, razón social y RUC
     prellenados, país de constitución, actividad económica, sitio web y correo del
     representante legal.
   - **Paso 3 — Representante y beneficiarios:** nombre, tipo y número de
     documento, nacionalidad y beneficiarios con 10% o más.
   - **Paso 4 — Documentos:** ficha RUC, vigencia de poderes, documento de
     identidad del representante y declaración jurada firmada. Formatos PDF, JPG o
     PNG; máximo 10 MB por archivo. Cada documento cargado se puede previsualizar
     antes de enviarlo y también después, desde el estado del cliente. La tarjeta del
     documento muestra su historial de versiones con archivo, fecha y acceso a cada
     versión.
5. Puede guardar borrador en cualquier paso.
6. Al enviar, se validan consentimientos, datos, documentos y declaración jurada.
   Si todo está completo, el expediente pasa a `en_revision` y se envía un correo al
   contacto declarado.
7. Si Logística observa el expediente, el cliente recibe las observaciones. Al abrir
   el formulario, el wizard inicia directamente en el paso 4, resalta los documentos
   observados y el botón cambia a “Subir nueva versión”. Luego solicita una nueva
   evaluación.

### 4.2 Logística

1. Abre la bandeja y filtra por estado, texto o empresa. La columna **Reputación**
   resume los casos derivados y sus resultados; el detalle muestra `1 sin hallazgos`,
   `1 pendiente`, etc.
2. Revisa el expediente, los documentos, las observaciones previas y la pestaña
   **Reputación**, que contiene la respuesta de Comunicaciones por cada nombre
   derivado: estado, resultado, comentario, revisor y fechas.
3. Decide:
   - **Aprobar:** marca los documentos como aprobados, registra la aprobación y
     calcula la vigencia de seis meses. Si el expediente ya está aprobado, no se
     puede volver a aprobar ni observar: la única acción disponible es **Derivar a
     Legal**.
   - **Observar:** registra una observación general o marca documentos
     específicos. Los documentos marcados quedan observados; si no se marca
     ninguno, la observación es general y el cliente corrige la información.
   - **Derivar a Legal:** registra el motivo y envía el expediente a Legal en estado
     `en_legal`. El cliente no es notificado en este paso.
4. Si marca “Derivar nombres a Comunicaciones”, se crean casos reputacionales para la
   empresa, el representante y los beneficiarios. No se duplican si ya existen.
5. Cada decisión queda en auditoría y dispara el correo correspondiente.

### 4.3 Comunicaciones

1. Recibe los nombres derivados por Logística.
2. Evalúa únicamente el nombre y el sitio web remitidos. No accede a la ficha
   completa del cliente.
3. Registra uno de estos resultados:
   - sin hallazgos;
   - con hallazgos;
   - requiere información adicional.
4. Puede guardar el resultado o cerrar el caso. Al notificar, Logística recibe una
   alerta en la campana del sistema.

### 4.4 Legal

1. Recibe en su bandeja los expedientes que Logística derivó con estado `en_legal`.
2. Revisa la solicitud completa: empresa, representante, documentos, observaciones
   de Logística y resultados de Comunicaciones.
3. Si va a **rechazar**, adjunta obligatoriamente el **informe legal en PDF**. Si
   aprueba, el informe es opcional.
4. Registra su decisión:
   - **Aprobar:** el expediente vuelve a Logística en estado `en_revision`;
     Logística debe registrar la decisión final (aprobar, observar o rechazar).
   - **Rechazar:** el expediente pasa a `rechazada` y recién en ese momento se
     notifica al cliente.
5. Toda decisión legal queda en auditoría con revisor, fecha, motivo e informe.
6. Si Legal aprueba y Logística rechaza después, el rechazo es final y se notifica
   al cliente; no se vuelve a derivar a Legal.

### 4.5 Panel del módulo

Muestra KPIs, estado por vínculo, vigencia y matriz de empresas. La matriz es
server-side y permite buscar, filtrar por estado DD y vínculo, cambiar `perPage`,
recargar y exportar el resultado filtrado.

---

## 5. Diagrama de actividades (UML con swimlanes)

Diagrama de actividades UML con **columnas por actor** y actividades ordenadas por filas
(estilo Bizagi). Modela el proceso completo: cliente, sistema, Logística y
Comunicaciones.

Mermaid no tiene notación nativa de swimlanes/BPMN; para el diagrama de actividades se
usa PlantUML, igual que el diagrama de actividades existente en
`docs/05-integraciones/diagramas/actividades-uml.puml`.

**Versiones renderizadas:** [SVG](./diagramas/debida-diligencia-actividades-uml.svg) · [PNG](./diagramas/debida-diligencia-actividades-uml.png)
**Fuente PlantUML:** [.puml](./diagramas/debida-diligencia-actividades-uml.puml)

![Diagrama de actividades de Debida Diligencia con swimlanes](./diagramas/debida-diligencia-actividades-uml.png)

---

## 6. Estados y transiciones

### 6.1 Expediente

| Estado | Significado | Transiciones |
|---|---|---|
| `borrador` | Creado por el cliente, aún no enviado | → `en_revision` |
| `en_revision` | Enviado y pendiente de Logística | → `aprobada`, `observada`, `rechazada` |
| `observada` | Logística solicitó correcciones | → `en_revision` al reenviar |
| `aprobada` | Aprobada con vigencia de 6 meses | Estado final del flujo actual |
| `en_legal` | Derivado por Log�stica para revisi�n legal |  `aprobada` o `rechazada` por Legal |
| `rechazada` | Rechazo definitivo | Estado final; informe legal |

Constantes: `DD_ESTADOS` y `DD_ESTADO_LABELS`.

### 6.2 Documentos

`pendiente` → `cargado` → `observado` / `aprobado` / `rechazado`.

Un documento observado conserva la observación mientras el cliente no suba una nueva
versión con una URL distinta.

### 6.3 Revisión reputacional

| Estado | Significado |
|---|---|
| `por_revisar` | Derivado por Logística, pendiente de Comunicaciones |
| `en_analisis` | En evaluación |
| `sin_hallazgos` | Resultado sin hallazgos |
| `con_hallazgos` | Resultado con hallazgos |
| `requiere_informacion` | Comunicaciones solicita más información |
| `cerrada` | Caso cerrado |

Constantes: `DD_REPUTACION_ESTADOS` y `DD_REPUTACION_RESULTADO_A_ESTADO`.

---

## 7. Reglas de negocio

- La vigencia de una debida diligencia aprobada es de **6 meses**.
- Se considera **por vencer** cuando faltan **30 días o menos**.
- Una empresa pendiente puede reservar un stand, pero no debe avanzar en
  aprobaciones hasta quedar aprobada. Esta regla se muestra en la UI; el bloqueo
  automático del flujo de reservas/solicitudes queda como integración pendiente.
- Un expediente solo se puede editar en `borrador` u `observada`.
- El envío exige ambos consentimientos, datos completos, representante, declaración
  jurada y los cuatro documentos obligatorios.
- La carga de documentos se valida en backend, no solo en el frontend: sesión y permiso
  `dd:formulario`, tipo de documento permitido, extensión, tamaño máximo de 10 MB y
  firma binaria real (PDF/JPG/PNG). `guardar` y `enviar` revalidan que el archivo exista
  en el almacenamiento y que su contenido siga siendo válido.
- Los beneficiarios declarados deben tener al menos **10%** de participación; el
  máximo es 100%.
- Logística puede derivar nombres a Comunicaciones al resolver el expediente. Los
  casos se crean una sola vez por nombre.
- Comunicaciones no recibe la ficha completa: solo el nombre visible de la empresa,
  el nombre a evaluar, el sitio web y metadatos del caso; no RUC, correo ni
  documentos.
- Al rechazar, Log�stica deriva a Legal y no notifica al cliente. La notificaci�n
  definitiva se env�a cuando Legal rechaza; Legal debe adjuntar su informe en PDF.
- Las observaciones se envían al correo declarado del representante legal o, si no
  existe, al contacto de la empresa.
- Una observación de Logística debe estar asociada a al menos un documento; el backend
  rechaza la revisión si no se selecciona documento. El cliente solo ve “Subir nueva
  versión” en los documentos observados.
- Toda acción relevante se registra en `audit_log` con tipo `debida_diligencia`.

---

## 8. API

Todas las rutas viven bajo `/api/debida-diligencia` y requieren sesión.

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/mi-expediente` | `dd:formulario` | Expediente de la empresa del usuario |
| POST | `/guardar` | `dd:formulario` | Guarda el wizard o corrección |
| POST | `/enviar` | `dd:formulario` | Envía a revisión |
| GET | `/detalle?id=` | Dueño, `dd:ver`, `dd:revision`, `dd:reputacion` o `dd:panel` | Detalle del expediente |
| GET | `/clientes` | `dd:ver` | Clientes con resultado (APTO, APTO CON OBSERVACIONES, NO APTO, PENDIENTE) y vigencia |
| GET | `/bandeja` | `dd:revision` | Bandeja paginada de Logística |
| POST | `/revisar` | `dd:revision` | Aprobar, observar o derivar a Legal |
| GET | `/panel` | `dd:panel` | KPIs, vínculos y vigencia |
| GET | `/matriz` | `dd:panel` | Matriz paginada de empresas |
| GET | `/legal/bandeja` | `dd:legal` | Bandeja de expedientes derivados a Legal |
| POST | `/legal/resolver` | `dd:legal` | Decisi�n final de Legal con informe adjunto |
| POST | `/legal/informe` | `dd:legal` | Carga del informe legal en PDF |
| GET | `/reputacion/listar` | `dd:reputacion` | Bandeja reputacional |
| POST | `/reputacion/resolver` | `dd:reputacion` | Guardar resultado y cerrar caso |
| GET | `/declaracion-jurada` | `dd:formulario` | PDF del formato vigente |

Los contratos están documentados en
[`docs/04-api/openapi.yaml`](../04-api/openapi.yaml).

Parámetros de paginación y filtros:

- `page`: página desde 1.
- `perPage`: 10, 15 o 50 en bandejas; hasta 500 en la matriz/exportación.
- `search`: razón social, RUC, código o nombre según la bandeja.
- `estado`: estado del expediente, estado reputacional o `sin_iniciar` en la matriz.
- `vinculo`: tipo de relación comercial en la matriz.
- En `/clientes`: `ruc`, `resultado` (`apto`, `apto_con_observaciones`,
  `no_apto`, `pendiente`) y `estadoEvaluacion` (`vigente`,
  `requiere_nueva_evaluacion`).

`/clientes` devuelve el expediente completo y los campos calculados:

- `resultado`: `APTO` para una evaluación aprobada sin observaciones abiertas;
  `APTO CON OBSERVACIONES` para una aprobación que conserva observaciones;
  `NO APTO` para rechazada; `PENDIENTE` para borrador, pendiente, en revisión u
  observada.
- `estadoEvaluacion`: `VIGENTE` si la aprobación no superó los 6 meses;
  `REQUIERE NUEVA EVALUACIÓN` si venció, está observada o fue rechazada.
- `aptoParaContratar`: verdadero solo si el resultado es apto, la evaluación está
  vigente y existe declaración jurada firmada.
- `alcance`: `general` para `APTO` y `vinculo_especifico` para
  `APTO CON OBSERVACIONES`.

---

## 9. Persistencia

| Tabla | Modelo Prisma | Propósito |
|---|---|---|
| `debida_diligencia` | `DebidaDiligencia` | Expediente principal |
| `debida_diligencia_beneficiario` | `DebidaDiligenciaBeneficiario` | Beneficiarios finales |
| `debida_diligencia_documento` | `DebidaDiligenciaDocumento` | Documentos de sustento |
| `debida_diligencia_documento_version` | `DebidaDiligenciaDocumentoVersion` | Historial de archivos por documento |
| `debida_diligencia_observacion` | `DebidaDiligenciaObservacion` | Observaciones de revisión |
| `debida_diligencia_reputacion` | `DebidaDiligenciaReputacion` | Casos reputacionales |

Restricciones principales:

- un expediente por empresa y evento: `@@unique([empresaId, eventoId])`;
- un documento por tipo y expediente: `@@unique([expedienteId, tipo])`;
- un caso reputacional por nombre y expediente:
  `@@unique([expedienteId, nombreARevisar])`;
- baja lógica no implementada para DD: las tablas conservan el historial y la
  auditoría.

---

## 10. Correos y notificaciones

Plantillas:

- `dd-recibida`;
- `dd-observada`;
- `dd-aprobada`;
- `dd-rechazada`.

El envío usa `enviarEmailPlantilla` (Resend) a través del puerto
`IDebidaDiligenciaNotificacionPort`. Si `RESEND_API_KEY` no está configurada, el
correo se omite sin bloquear la operación. La alerta de revisión reputacional se
guarda en la campana interna del usuario de Logística que derivó el caso.

---

## 11. Limitaciones y pendientes

- **Renovación:** no existe aún un flujo automático para renovar una DD aprobada antes
  de su vencimiento; el estado “vencida” se calcula, pero no hay endpoint de
  renovación.
- **Bloqueo de aprobaciones:** la regla “puede reservar, pero no avanzar” se comunica
  en la UI; no está conectada al pipeline de stands/solicitudes.
- **Legal:** no tiene una bandeja propia. El rechazo crea una observación de Legal y
  el rechazo definitivo se comunica por informe legal.
- **Correo:** requiere `RESEND_API_KEY` para envío real.
- **Código correlativo:** `DD-AAAA-NNNN` se calcula por año; una concurrencia extrema
  podría chocar y la restricción única lo rechazaría.
- **Documentos:** no se valida la antigüedad real de la ficha RUC o de los poderes; la
  regla se muestra como ayuda, pero la valida Logística manualmente.
- **Panel:** los KPIs se calculan sobre el evento activo. La matriz incluye empresas
  activas; no hay selector de evento dentro del panel.

---

## 12. Verificación

Comandos usados para validar la implementación:

```bash
npx tsc --noEmit
npx eslint
npm test
npx prisma validate
```

Resultado: TypeScript sin errores, ESLint sin errores (solo un warning preexistente en
`src/infrastructure/external/sgc-client.ts`), tests del proyecto aprobados y esquema
Prisma válido.
