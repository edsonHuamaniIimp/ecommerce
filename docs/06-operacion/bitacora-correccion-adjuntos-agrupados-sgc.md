# Bitácora — corrección de adjuntos agrupados del SGC

> Fecha: 2026-11-13  
> Caso de referencia: solicitud/stand **520 — PRODIMIN S.A.C.**  
> Objetivo: dejar registro de los intentos, causas raíz y reglas para no repetir los mismos errores.

## 1. Resultado que se busca

El cliente debe poder corregir un grupo de adjuntos del SGC desde **Mis solicitudes** y luego ejecutar **Solicitar nueva revisión** sin:

- errores de asociación en el SGC;
- errores de `Unique constraint` en la base local;
- documentos del grupo apareciendo en “Otros documentos”;
- contadores incorrectos de archivos esperados.

## 2. Caso real QA 520

Datos confirmados directamente contra el SGC de QA:

```text
contractId: 8eaca3b2-c18c-4506-b0f5-b524ca328422
grupo observado: 4651aabc-fc46-441a-948d-4f2c9b3d3654
pieza vigencia: db58f4d4-86a8-413a-97f5-d3a7664a6861
pieza DNI:      e85a5977-4384-4316-bfbd-b8ec44d3c9e0
expectedDocuments: 2
documentsMissing: 2
```

El SGC tenía dos anexos genéricos (`vigencia de poder` y `Documento de Dni`) en estado `pending`, sin `observations` y sin vínculo al grupo. La observación agrupada seguía abierta.

## 3. Causas raíz confirmadas

### 3.1 El sync local perdía el `observationId`

`observacionesDesdeDetalle` copiaba las piezas y los títulos de `missingDocuments`, pero no copiaba `observationId`. Sin ese campo el backend no podía asociar los archivos al grupo.

**Corrección:** conservar `observationId` al mapear `missingDocuments`.

### 3.2 El backend no enviaba las piezas agrupadas correctamente

La subida solo enviaba `observationId` + `pieceId` cuando el documento local ya tenía ambos datos. Los documentos existentes habían quedado sin `observationId`, por lo que se subían como anexos genéricos.

**Corrección:** usar el detalle fresco del SGC, inferir la pieza desde el título cuando falte el vínculo local y enviar `observationId` + `pieceId` al reservar la subida.

### 3.3 El filtro de idempotencia omitía documentos del grupo

Si un anexo genérico del SGC tenía el mismo nombre o título que el archivo local, el proceso lo omitía y nunca lo reenviaba con el vínculo de la pieza.

**Corrección:** para documentos vinculados a una observación, no aplicar el filtro por nombre; reenviarlos para asociarlos correctamente.

### 3.4 Había documentos duplicados para la misma pieza

La base local tenía tres registros activos de `vigencia de poder` para la misma pieza (`db58...`). El backend intentaba subir todos, y al registrar la correlación local se repetía el mismo `documentId`.

Error observado:

```text
Invalid `prisma.sgcDocumento.create()` invocation:
Unique constraint failed on the fields: (document_id)
```

**Corrección:** deduplicar por `observationId + pieceId` usando el archivo más reciente y hacer `upsert` de `sgc_documento` cuando el SGC devuelve un `documentId` ya conocido.

### 3.5 El contador y el modal no reflejaban lo que pedía el SGC

La UI no mostraba la cantidad esperada ni permitía identificar claramente cada pieza. Los archivos vinculados al SGC aparecían como “Otros documentos”.

**Corrección:** mostrar `expectedDocuments`, títulos esperados y estado por pieza; excluir del bloque “Otros documentos” los archivos con vínculo SGC; bloquear el envío hasta cubrir todas las piezas.

## 4. Cronología de intentos

| Commit | Cambio intentado | Resultado / lección |
|---|---|---|
| `1ea0b13` | No reemplazar anexos de faltantes por título | Evitó reemplazos incorrectos, pero no resolvió grupos con varias piezas |
| `ba54fcd` | Distinguir versión corregida de archivo nuevo | Correcto para observaciones individuales |
| `4aaf53c` | Exigir coincidencia de título en faltantes | Mejoró el matching, pero el grupo seguía dependiendo de IDs explícitos |
| `3529492` | Priorizar versión existente sobre faltante | Evitó conflictos de título; no resolvió el `observationId` perdido |
| `859fe6b` | Simplificar modal y controlar documentos agrupados | Mejoró la UI; persistía el problema de asociación |
| `13cbddb` | Convertir “Agregar archivo N de N” en botón y vincular grupos por títulos | Mejoró la UX y el reconocimiento local; el SGC aún necesitaba `pieceId` real |
| `2efee30` | Enviar `observationId` y `pieceId` a grupos; inferir pieza por título | Dirección correcta; faltaba conservar `observationId` al sincronizar |
| `2a435f1` | Conservar `observationId` de `missingDocuments` y consultar detalle fresco del SGC | Corrigió la causa de asociación del grupo |
| `f3fe782` | Deduplicar piezas y hacer `upsert` de `sgc_documento` | Corrige el `Unique constraint` local; pendiente de QA en el momento de esta bitácora |

## 5. Errores que no se deben repetir

1. **No asumir que un grupo del SGC se puede resolver solo por título o fecha.**  
   Un grupo se asocia con `observationId` y, cuando el SGC lo informa, con `pieceId`.

2. **No enviar `observationId` suelto para observaciones individuales.**  
   Las observaciones individuales se corrigen por `documentId`.

3. **No inferir la pieza desde el nombre del archivo.**  
   La fuente de verdad es `missingDocuments[].pieces[]` y `expectedDocumentTitles`.

4. **No subir todos los documentos históricos de la misma pieza.**  
   Elegir el más reciente por `observationId + pieceId`.

5. **No usar `crearDocumento` a ciegas cuando el SGC puede devolver un `documentId` ya registrado.**  
   Usar `upsert` de la correlación local.

6. **No mezclar documentación del grupo con “Otros documentos”.**  
   Todo archivo con `sgcObservationId`, `sgcDocumentId`, `sgcTitle` o `sgcPieceId` pertenece al flujo SGC.

7. **No probar antes de que el deploy de QA termine.**  
   Un push a `qa` no significa que QA ya esté ejecutando ese commit.

8. **No aplicar migraciones manualmente sin verificar el entorno.**  
   La falta de `sgc_piece_id` en una base local produjo errores distintos a los del SGC.

## 6. Flujo correcto de diagnóstico

1. Consultar el expediente real en el SGC:

```text
GET /api/integrations/v1/contracts/{contractId}
```

Revisar:

- `documents[]`;
- `missingDocuments[]`;
- `observationId`;
- `pieces[]`;
- `documentsMissing`;
- `expectedDocumentTitles`.

2. Revisar la base local:

```text
solicitud_documento.sgc_observation_id
solicitud_documento.sgc_piece_id
solicitud_documento.sgc_title
sgc_documento.document_id
```

3. Confirmar que QA ejecuta el commit esperado.

4. Reproducir solo con documentos que tengan vínculo explícito.

5. Ejecutar **Solicitar nueva revisión** y verificar el SGC nuevamente.

## 7. Pruebas de regresión obligatorias

- Grupo v11 con dos `pieces`: se envían `observationId` + `pieceId`.
- Grupo con `expectedDocuments` sin `pieces`: se envía `observationId` según corresponda.
- Documento local sin `pieceId` pero con título igual al de la pieza: se infiere la pieza.
- Tres documentos locales de la misma pieza: se envía solo el más reciente.
- El SGC devuelve un `documentId` ya conocido: el registro local se actualiza, no falla.
- Observación individual: no se envía `observationId`.
- Documento del grupo: no aparece en “Otros documentos”.

Archivos de prueba principales:

- `src/application/sgc-integracion/__tests__/sgc-documentos.test.ts`
- `src/lib/shared/utils/__tests__/solicitud-documentos.test.ts`

## 8. Estado al cierre de esta bitácora

- Código corregido localmente y publicado en `qa` hasta `f3fe782`.
- QA debe esperar el deploy de ese commit antes de volver a probar.
- Los documentos genéricos antiguos pueden permanecer en el SGC como historial; la corrección debe enviar las piezas nuevas asociadas al grupo.
- Si el SGC sigue reportando faltantes después de desplegar `f3fe782`, el siguiente paso es revisar el tráfico real de `POST /contracts/{id}/documents` y confirmar que el payload lleva ambos IDs.
