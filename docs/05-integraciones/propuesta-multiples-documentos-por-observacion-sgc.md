# Propuesta: varios documentos adjuntos por una observación del SGC

> Para el equipo de desarrollo del **SGC**. Objetivo: permitir que una observación
> documental pueda exigir y recibir **más de un archivo**, sin romper el flujo actual.

## Resumen ejecutivo para el equipo SGC

El SGC debe hacer uno de estos dos cambios:

1. **Dividir el faltante en observaciones separadas** (recomendado y más simple):
   una observación por archivo, cada una con su `observationId`, `title` y
   `requiresNewDocument: true`.
2. **Permitir una observación agrupada**: agregar `expectedDocuments` y
   `expectedDocumentTitles`, aceptar `observationId` en
   `POST /contracts/{contractId}/documents`, asociar N documentos al mismo
   `observationId` y resolverla solo cuando lleguen los N.

Además, para que el IIMP pueda corregir sin depender del cliente, el SGC debe
permitir una **corrección administrativa antes de la aprobación final** (sección 8).
No debe permitir modificaciones si el expediente ya está `active`, `finalized`,
`validity`, `closed` o `archived`.

Sin alguno de estos cambios, ContratosStands no puede garantizar que dos archivos
queden asociados a la misma observación ni que el reenvío sea válido.

## 0. Estado en la guía `APIS_USE_HOOKS (10)`

La versión más reciente de la guía **todavía no** describe varios archivos por una
misma observación. Al contrario:

- §8.3 dice explícitamente: **“Una observación = un archivo.”**
- Los archivos faltantes se envían como adjuntos nuevos, **uno por cada archivo
  pedido**.
- `/resend` espera `N` archivos nuevos si se pidieron `N` faltantes.
- `observations[]` sigue siendo un elemento por documento.
- No existen `expectedDocuments` ni un `observationId` en
  `POST /contracts/{id}/documents`.

Esta guía sí permite **varios anexos** en general, pero como piezas documentales
separadas (`documentId` distinto), no como varios archivos bajo una sola
observación. Este documento es la solicitud para agregar ese caso.

### Por qué el soporte actual de “varios adjuntos” no resuelve este caso

La guía v10 permite subir varios adjuntos sueltos:

```text
POST /contracts/{id}/documents  documentId:null  -> anexo nuevo 1
POST /contracts/{id}/documents  documentId:null  -> anexo nuevo 2
```

Pero no permite saber que ambos pertenecen a **una misma observación**:

- `observations[]` trae **un elemento por documento**.
- La regla publicada es **“una observación = un archivo”**.
- No hay `expectedDocuments` ni un grupo de archivos por `observationId`.
- El detalle no expone cuántos archivos espera una observación agrupada.
- `/resend` puede pedir “N archivos nuevos”, pero el cliente no sabe a qué
  observación pertenece cada uno ni cuándo el grupo está completo.

En el caso 519, el SGC devolvió **una sola observación** cuyo texto pide dos
documentos. Con la guía v10, ContratosStands solo puede interpretar “un archivo
para esa observación”; el segundo queda sin vínculo explícito.

### Cambio mínimo que necesitamos del servicio SGC

Hay dos alternativas; cualquiera de las dos resuelve el caso:

1. **Recomendada:** dividir los faltantes en observaciones separadas.
   - Dos `observationId` distintos, cada uno con su `title` y un archivo.
   - No requiere campos nuevos; es la opción más compatible.

2. **Grupo explícito:** mantener una observación con varios documentos.
   - Agregar `expectedDocuments` y `expectedDocumentTitles` a la observación.
   - Aceptar `observationId` en `POST /contracts/{id}/documents`.
   - Asociar N documentos al mismo `observationId`.
   - Resolver la observación solo cuando lleguen los N.

Si el equipo del SGC considera que “no hace falta cambiar nada”, debe indicar
cuál de estas dos opciones ya está implementada y cómo ContratosStands obtiene:

- cuántos archivos espera la observación;
- qué títulos corresponden a cada archivo;
- qué `documentId` quedó asociado a cada uno;
- cuándo el grupo está completo y la observación pasa a `resolved`.

Con la documentación v10 actual, esos cuatro datos no están disponibles. Por eso
sí se requiere un cambio de contrato de API o la separación en dos observaciones.

## Diferencia clave: documentos del catálogo vs documentos adjuntos

No es lo mismo pedir “N documentos” que pedir “N documentos adjuntos”.

- **Documentos del catálogo:** Ficha RUC, Vigencia de Poder y DNI o Pasaporte del
  Representante Legal. Cada uno es una observación independiente y se corrige con
  **un archivo**.
- **Documentos adjuntos:** una observación genérica de `category: "annex"` que
  puede pedir **varios archivos** bajo el mismo `observationId`. No son “N
  vigencias de poder” ni “N DNI” del catálogo; son N adjuntos genéricos.

El caso “Falta agregar vigencia de otro representante legal y otra pdf de DNI”
pertenece al segundo grupo: ContratosStands debe enviar **varios documentos
adjuntos**, no crear varias observaciones de los documentos estándar.

`expectedDocuments` aplica solo a esta observación genérica de adjuntos. Nunca
debe aplicarse a Ficha RUC, Vigencia de Poder o DNI del catálogo.

## 1. Caso real

En el expediente de PRODIMIN, el SGC devolvió una observación con este texto:

```json
{
  "observationId": "ejemplo-observacion",
  "documentId": null,
  "category": "annex",
  "title": "Falta agregar vigencia de otro representante legal y otra pdf de DNI",
  "message": "Falta adjuntar: Falta agregar vigencia de otro representante legal y otra pdf de DNI.",
  "requiresNewDocument": true,
  "requiresDocumentChange": true,
  "status": "open"
}
```

El texto pide **dos documentos**, pero la observación no indica cuántos archivos
espera ni cuáles son sus títulos. ContratosStands solo puede asociar un archivo
a esa observación, por lo que el segundo archivo queda huérfano o no se envía.

En ContratosStands estos documentos se muestran como **Documentos anexos**. En el
SGC corresponden a `category: "annex"` / **Documentos adjuntos**. La propuesta usa
esa misma categoría y agrega metadatos de grupo para una observación con varios
archivos.

| ContratosStands | SGC |
| --- | --- |
| Documentos anexos | `category: "annex"` / Documentos adjuntos |
| Observación de anexos | `data.observations[]` o `documents[].observations[]` |
| Varios archivos de una observación | `expectedDocuments` + un `observationId` compartido |

## 2. Regla actual

La integración actual trabaja con:

- un `documentId` = un documento lógico con una versión vigente;
- una observación = un archivo de corrección;
- `missingDocuments[]` = un documento faltante por elemento.

Eso funciona para observaciones de un solo archivo, pero no para casos como el
expuesto, donde una observación funciona como un **grupo de documentos adjuntos**.

## 3. Cambios solicitados

Todos los campos nuevos deben ser **opcionales y aditivos**. Si no se envían,
ContratosStands sigue operando con la regla actual de un archivo por observación.

### 3.1 Observación con cantidad esperada

Agregar a `data.observations[]` y a `documents[].observations[]`:

```json
{
  "observationId": "obs_01J9Z...",
  "documentId": null,
  "category": "annex",
  "title": "Falta agregar vigencia de otro representante legal y otra pdf de DNI",
  "message": "Falta adjuntar: ...",
  "requiresNewDocument": true,
  "expectedDocuments": 2,
  "expectedDocumentTitles": [
    "Vigencia de poder del otro representante legal",
    "DNI del otro representante legal"
  ],
  "status": "open"
}
```

- `expectedDocuments`: entero >= 1. Default: `1`.
- `expectedDocumentTitles`: opcional, mismo tamaño que `expectedDocuments`.
  Sirve para que la UI muestre exactamente qué archivo falta.
- `documentId` sigue siendo `null` si son documentos nuevos.

### 3.2 Asociar cada archivo a la observación

En `POST /contracts/{contractId}/documents`, aceptar:

```json
{
  "category": "annex",
  "title": "Vigencia de poder del otro representante legal",
  "fileName": "vigencia-otro-representante.pdf",
  "sizeBytes": 123456,
  "checksumSha256": "...",
  "declaredMimeType": "application/pdf",
  "observationId": "obs_01J9Z...",
  "requiresNewDocument": true
}
```

Reglas:

- `observationId` es opcional; si viene, el documento queda asociado a esa
  observación.
- Se permiten **varias llamadas** con el mismo `observationId`.
- Cada llamada crea un `documentId` distinto si no se envía `documentId`.
- Si se envía `documentId`, se crea una nueva versión de ese documento.
- La observación solo pasa a `resolved` cuando existen al menos
  `expectedDocuments` documentos/versiones asociados.
- Mientras falten archivos, `GET /contracts/{id}` debe devolver la observación
  con `status: "open"` y `documentsMissing: N`.

### 3.2.1 Secuencia que enviará ContratosStands

Para una observación con `expectedDocuments: 2`, ContratosStands hará **dos
llamadas separadas** a `POST /contracts/{contractId}/documents`, una por archivo,
con el mismo `observationId`:

```text
POST /contracts/{id}/documents  -> observationId=obs_01J9Z..., title="Vigencia..."
POST /contracts/{id}/documents  -> observationId=obs_01J9Z..., title="DNI..."
```

No enviaremos un ZIP ni un PDF consolidado. Cada archivo conserva su propio
`fileName`, checksum y título. En la UI del cliente el botón **Agregar otro**
permite sumar archivos uno por uno a la misma observación; **Enviar documentos**
hace la secuencia completa.

Esto **no aplica** a las observaciones normales de Ficha RUC, Vigencia de Poder o
DNI: cada una de esas es una observación independiente y se resuelve con un solo
archivo.

### 3.3 Detalle del expediente

En `GET /contracts/{contractId}`:

```json
{
  "observationId": "obs_01J9Z...",
  "title": "Falta agregar vigencia de otro representante legal y otra pdf de DNI",
  "expectedDocuments": 2,
  "documentIds": [
    "nuevo-document-id-1",
    "nuevo-document-id-2"
  ],
  "documentsMissing": 0,
  "status": "resolved"
}
```

`documentIds` y `documentsMissing` son opcionales para clientes antiguos.

### 3.4 `missingDocuments[]`

Si el SGC prefiere no cambiar `observations[]`, puede resolver el caso enviando
dos elementos separados en `missingDocuments[]`, cada uno con su propio
`observationId` y `title`. Es la alternativa más simple y compatible.

## 4. Compatibilidad

- Sin `expectedDocuments`, cada observación sigue exigiendo un archivo.
- Sin `observationId` en la subida, el archivo se trata como documento nuevo
  normal.
- Los clientes actuales ignoran los campos desconocidos.
- No cambiar el significado de `documentId`, `requiresNewDocument`,
  `requiresDocumentChange`, `status`, `resolvedAt` ni `versionId`.

## 5. Criterios de aceptación

1. Una observación con `expectedDocuments: 2` y un solo documento adjunto sigue
   `open` y reporta `documentsMissing: 1`.
2. Al adjuntar el segundo documento con el mismo `observationId`, la observación
   queda `resolved` y aparecen ambos `documentId`.
3. Dos documentos con el mismo `observationId` no se tratan como duplicados.
4. Una observación sin `expectedDocuments` mantiene el comportamiento actual:
   un archivo la resuelve.
5. Un reintento con la misma `Idempotency-Key` no crea documentos duplicados.
6. Si se adjunta más de `expectedDocuments`, el SGC debe aceptar o rechazar
   explícitamente; no debe dejarlos huérfanos.
7. El caso PRODIMIN debe permitir subir la vigencia y el DNI en la misma
   observación.

## 6. Impacto en ContratosStands

Del lado de ContratosStands ya se preparó el modelo local para que varios
documentos compartan el mismo `sgcObservationId`. La UI permite agregar archivos
uno por uno con **Agregar otro** y enviarlos juntos. El adaptador HTTP ya envía
`observationId` en cada `POST /contracts/{contractId}/documents` cuando el
documento local tiene ese vínculo.

Falta del lado SGC:

- aceptar y persistir `observationId` en la reserva de subida;
- aceptar `expectedDocuments` y devolverlo en el detalle;
- asociar varias llamadas con el mismo `observationId` a una sola observación;
- resolver la observación cuando se complete la cantidad esperada.

Mientras el SGC no acepte `observationId`, ese campo debe mantenerse desplegado
solo cuando el SGC confirme la nueva versión de la API.

## 7. Alternativa inmediata

Si el SGC no puede cambiar el modelo a corto plazo:

- devolver **dos observaciones faltantes separadas** para este caso; o
- documentar que el cliente debe subir **un único PDF consolidado**.

La primera opción es la recomendada porque evita PDFs combinados y permite
trazabilidad por documento.

## 8. Requerimiento adicional: corrección administrativa sin esperar devolución

ContratosStands necesita que el IIMP pueda corregir y reenviar sin depender de
que el cliente lo haga y sin esperar a que el expediente esté devuelto/rechazado.

La guía v10 actual **no lo permite**: durante la revisión, `POST
/contracts/{id}/documents` responde `409` y los cambios solo se aceptan cuando el
expediente está en elaboración, devuelto o rechazado.

### Cambio solicitado

Agregar una operación privilegiada de **corrección administrativa**, solo para el
actor de integración con rol `contract-manager`/administrador:

1. Abrir una sesión de corrección:
   `POST /contracts/{contractId}/administrative-correction`
   - `expectedVersion` obligatorio para control de concurrencia.
   - `reason` obligatorio.
   - Permitida solo **antes de la aprobación final**: `drafting`, `internal-review`,
     `legal-review` o `approval` con aprobación final pendiente.
   - Prohibida si el expediente ya está **aprobado/vigente/cerrado/archivado**:
     `lifecycleStatus: "active"` o `"finalized"`, `stage: "validity"` o
     `"closed"`, o después de `workflow.completed`/`contract.closed`.
   - Si ya existe aprobación final, debe responder `409` y no modificar contrato,
     documentos ni versiones.
   - Devuelve `correctionId` y `expiresAt`.

2. Subir los documentos corregidos usando la misma API de 3 fases:
   - versiones nuevas sobre el mismo `documentId`;
   - archivos nuevos con `documentId: null`;
   - varios archivos con el mismo `observationId`, según la sección 3.

3. Finalizar:
   `POST /contracts/{contractId}/administrative-correction/{correctionId}/send`
   - crea una ronda nueva;
   - invalida las aprobaciones pendientes de la ronda anterior;
   - conserva historial y versiones;
   - notifica a Legal/Gerencia;
   - devuelve `{ round, version, status: "resent" }`.

### Reglas

- La operación debe ser idempotente por `Idempotency-Key`.
- Debe auditar quién corrigió, cuándo, motivo y versión esperada.
- Si Legal ya aprobó, debe definir si la corrección reinicia Legal o solo
  invalida la etapa afectada; no puede quedar una aprobación vieja sobre un
  documento nuevo.
- El cliente no debe firmar ni subir nada en este flujo; la corrección y el
  reenvío los ejecuta el sistema autorizado.
- La operación no debe permitirse sobre expedientes cerrados, archivados o
  finalizados.

Sin esta operación, ContratosStands puede regenerar el contrato localmente, pero
el SGC seguirá rechazando la subida mientras el expediente esté en revisión.
