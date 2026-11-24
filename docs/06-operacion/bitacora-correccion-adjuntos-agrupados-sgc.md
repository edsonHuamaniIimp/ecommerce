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

## 9. Continuación 23–24 nov 2026: casos de producción y correcciones

Diagnóstico sobre los 44 expedientes abiertos de prod (solo lectura, BD + API del SGC).

| Caso | Síntoma | Causa raíz | Corrección |
|---|---|---|---|
| MOLY-COP | 6 (luego 12) archivos en la misma pieza; 3 piezas vacías | El modal asignaba un solo `pieceId` a toda la selección múltiple; la 2.ª vez el cliente tenía la página vieja abierta tras el deploy | `c1d2e60`: un botón y un archivo por pieza. El cliente debe recargar (Ctrl+F5) y subir las 3 piezas |
| ULMA | 3 piezas quedaron `reemplazado` | Un "otro documento" sin requisito marcaba como reemplazados todos los anexos sin requisito, incluidas las piezas | `c1d2e60`. Envío controlado del 23-nov: solo contrato + 3 piezas; quedó en `legal-review` |
| SCANIA | Vigencia y DNI volvieron a los originales en la ronda 3 | El original seguía activo junto a la corrección y se reenviaba como versión nueva | `37477fe`. Restaurar requiere «Devolver para corregir» en el SGC (la integración no tiene permiso de corrección administrativa: 403) |
| COMISUB / ESAN / BOART | "Subsanada, puedes reenviar" pero el reenvío falla | El SGC devolvió sin `observations[]`: exige versión nueva del contrato y el cliente no tenía cómo firmar de nuevo | Observación implícita del contrato (ver abajo) |
| Todos | Correos/alertas repetidos (hasta 729 a un usuario) | Se comparaba el mensaje de la observación con el `reason` del webhook | `c1d2e60`: avisar solo por observaciones nuevas (`observationId`) |
| Todos | Estado local desfasado horas/días | Sin webhooks desde el 12-nov; el cron gastaba su presupuesto en los 404 | `c1d2e60`: cron rota también los errores y consulta terminales cada 24 h |
| ULMA (principio) | El reenvío subía anexos no observados | Subía todo lo que el SGC no tenía | `ce6e539`: en subsanación solo se sube lo observado |

### Observación implícita del contrato (24-nov)
- Si el SGC está `observed`/`rejected` sin observaciones abiertas y la devolución no indica
  `requiresDocumentChange: false`, la sincronización agrega una observación del contrato con id
  local `devolucion-sin-obs-v<versión>` y la fecha de la devolución (`updatedAt` del detalle).
- Activa el flujo existente: regeneración del contrato, botón "Firmar contrato corregido" y
  reenvío con la versión nueva del contrato. Se reutiliza mientras dure la devolución y
  desaparece cuando el SGC abre la siguiente ronda.

### Reglas añadidas a la lista de "no repetir"
9. **En una subsanación solo se envía lo observado.** Si falta algo, el SGC lo observa.
10. **Una corrección ya aceptada reserva su documento:** un archivo más antiguo no se sube encima.
11. **Una devolución sin observaciones exige versión nueva del contrato:** el cliente debe poder firmar.
12. **Nunca iniciar sesión con credenciales de usuarios** para operar el SGC; la integración usa su clave y el operador se identifica en `operatorReference`.
13. **Bitácora de intentos:** cada "Solicitar nueva revisión" queda en `sgc_subsanacion_intento`; revisar ahí antes de diagnosticar.

### Devolución sin detalle: el motivo no llega por la API (24-nov, ESAN)
- Legal (SGC) confirmó que en la devolución del 23-nov de ESAN pidió la **Vigencia de Poder**,
  pero la devolvió sin marcar el adjunto: el `GET /contracts/{id}` no trae ninguna observación
  abierta y el historial («Trámite devuelto al área de origen») llega con `detail: null`. El
  motivo solo viaja en `data.reason` del webhook, y los webhooks no llegan desde el 12-nov.
- Con la sola observación implícita del contrato, el cliente solo podía volver a firmar y, por
  la regla "solo lo observado", una Vigencia nueva no se habría enviado.
- Corrección: con la devolución sin detalle (`devolucionSgcSinDetalle`) el cliente ve
  "Subir / reemplazar documentos" y puede reemplazar cualquier documento requerido; en el
  reenvío se envían los anexos subidos **después** de la devolución, además del contrato firmado.
  Lo anterior a la devolución no se reenvía.
- Recomendación al SGC: usar «Devolver para corregir» marcando los adjuntos; así el pedido
  llega por API y el cliente ve exactamente qué corregir.
