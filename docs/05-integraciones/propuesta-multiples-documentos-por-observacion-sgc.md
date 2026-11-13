# Propuesta: varios documentos adjuntos por una observación del SGC

> Para el equipo de desarrollo del **SGC**. Objetivo: permitir que una observación
> documental pueda exigir y recibir **más de un archivo**, sin romper el flujo actual.

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
