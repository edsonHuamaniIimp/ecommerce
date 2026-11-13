# Procedimiento excepcional de corrección y reenvío al SGC

> **Uso restringido.** Este procedimiento no reemplaza el flujo normal del cliente.
> Solo se aplica en casos extremos y urgentes, con autorización expresa, cuando el
> cliente no puede ingresar o el plazo operativo exige destrabar el expediente.
> Toda ejecución debe quedar auditada.

## 1. Objetivo

Permitir que un operador autorizado actualice documentos observados en el SGC y
solicite una nueva revisión sin esperar a que el cliente vuelva a ingresar al portal.

La actualización no edita el archivo anterior: el SGC crea una **versión nueva**
sobre el mismo `documentId` y conserva el historial.

## 2. Cuándo se puede usar

Solo si se cumplen todas estas condiciones:

- El expediente está en el SGC en estado `observed` o `rejected`, con etapa de
  corrección (`drafting`).
- Existe una observación abierta que exige cambio documental.
- Se cuenta con los archivos corregidos, válidos y autorizados.
- El reenvío es urgente y el cliente no puede hacerlo por el portal.
- Hay aprobación del responsable del área y se registra el motivo.

## 3. Cuándo NO se puede usar

No se puede modificar ni reenviar un expediente que el SGC ya aprobó o cerró:

| Estado SGC | Significado | ¿Se puede modificar? |
|---|---|---|
| `active` | Vigente / aprobado | No |
| `finalized` | Cerrado / finalizado | No |
| `observed` | Observado, pendiente de corrección | Sí, solo lo observado |
| `rejected` | Rechazado, admite corrección | Sí, siguiendo el flujo de rechazo |
| `archived` / `closed` | Archivado / cerrado | No |
| En validez o con aprobación final | Documento ya emitido | No |

Reglas adicionales:

- No modificar un contrato aprobado, vigente o cerrado.
- No modificar documentos después de la aprobación final.
- No usar este procedimiento para “saltar” una revisión del SGC.
- No inventar ni alterar firmas. Las firmas son digitales y deben ser válidas.
- No asignar documentos históricos a piezas agrupadas por nombre, orden o fecha.

## 4. Qué permite la API del SGC

La API permite:

- Subir una **nueva versión** de un documento existente usando su `documentId`.
- Crear un **documento nuevo** con `documentId: null`.
- Reemplazar la versión de una pieza agrupada usando el mismo documento de la pieza.
- Reabrir el trámite con `POST /contracts/{contractId}/resend`, una sola vez por ronda.

La API no permite:

- Editar el contenido de una versión ya subida.
- Cambiar un expediente `active`, `finalized`, `archived` o `closed`.
- Asignar un archivo a una pieza si el SGC no devolvió el `pieceId` de esa pieza.
- Reemplazar el consentimiento o la firma del cliente.

## 5. Reglas por tipo de observación

### 5.1 Observación individual

- Se corrige con una versión nueva del `documentId` observado.
- **No** se envía `observationId` suelto.
- El SGC valida por `documentId`, no por nombre de archivo.

Ejemplo del caso 519:

- Vigencia de Poder: `documentId 106c63b5-...`
- DNI: `documentId 65a27d9b-...`
- Contrato: `documentId 56f7eab5-...`
- Faltante: se sube como anexo nuevo, sin `documentId`.

### 5.2 Observación agrupada v11

- El SGC devuelve `pieces[]` con `id`, `title` y, si existe, `acceptedDocumentId`.
- Cada archivo se reserva con `observationId` **y** `pieceId`.
- El reemplazo de una pieza usa el mismo documento de esa pieza.
- No se habilita el reenvío mientras haya piezas pendientes.

### 5.3 Observación agrupada antigua sin `pieces[]`

- No se puede reconstruir la relación archivo-pieza desde nuestro lado.
- No se debe adivinar ni reutilizar un archivo histórico como si fuera una pieza.
- Salida permitida:
  1. Pedir al SGC que reemita la observación con `pieces[]`.
  2. Usar corrección administrativa, solo si el estado y la política del SGC lo permiten.
  3. Si no es posible, detener el proceso y escalar.

## 6. Requisito sobre los archivos

Para que el reenvío interno los envíe como anexos del cliente, los archivos deben
quedar registrados como documentos del cliente (`user_id` no nulo).

Si el archivo se registra como documento administrativo (`user_id` nulo), el sistema
lo puede usar como contrato, pero **no** lo enviará como anexo del cliente.

Por eso, antes de reenviar, verificar:

- que el archivo esté asociado al cliente correcto;
- que sea la versión vigente;
- que corresponda a la observación o pieza solicitada;
- que el contrato corregido, si fue observado, esté firmado por el cliente.

## 7. Procedimiento operativo

1. **Autorizar**
   - Registrar ticket, motivo de urgencia, responsable que autoriza y hora.
   - Confirmar que el caso no está aprobado, vigente, cerrado, finalizado ni archivado.

2. **Sincronizar**
   - Abrir el detalle del expediente y ejecutar la sincronización con el SGC.
   - Confirmar `lifecycleStatus`, `stage`, `observations[]`, `missingDocuments[]` y,
     si existe, `pieces[]`.

3. **Identificar la corrección**
   - Individual: obtener el `documentId` observado.
   - Agrupada: obtener `observationId`, `pieceId` y `acceptedDocumentId`.
   - Faltante: confirmar que va como documento nuevo (`documentId: null`).

4. **Cargar los archivos**
   - Cargar el archivo corregido como documento vigente del cliente.
   - No reutilizar un archivo histórico sin vínculo explícito.
   - No subir un archivo administrativo esperando que se envíe como anexo del cliente.

5. **Reenviar**
   - Usar el endpoint interno de reenvío (`POST /api/sgc/reenviar`), no llamadas
     manuales aisladas contra el SGC.
   - El reenvío sube las versiones necesarias y ejecuta `/resend` una sola vez.
   - No repetir el reenvío si ya existe una ronda activa.

6. **Verificar**
   - Confirmar la respuesta del SGC.
   - Sincronizar nuevamente el expediente.
   - Verificar que las observaciones pasaron a `resolved` o que el expediente avanzó.
   - Adjuntar la evidencia al ticket de urgencia.

## 8. Auditoría mínima

Registrar por cada ejecución:

- solicitud y `contractId`;
- estado SGC antes y después;
- observaciones y piezas corregidas;
- `documentId` versionados y documentos nuevos;
- archivos usados, origen y quién los proporcionó;
- operador que ejecutó el reenvío;
- autorizador y motivo de urgencia;
- respuesta del SGC y resultado del `/resend`;
- fecha y hora.

## 9. Señales de alerta

Detener el procedimiento si:

- el SGC devuelve `400` por `observationId`/`pieceId` inválidos;
- el SGC devuelve `409` por revisión en curso o pieza ajena;
- el SGC devuelve `422` por archivos faltantes;
- el expediente está `active`, `finalized`, `archived` o `closed`;
- no se puede identificar la pieza exacta;
- el archivo no está asociado al cliente;
- el contrato observado no tiene firma válida del cliente.

## 10. Referencias

- Contrato SGC v11: `APIS_USE_HOOKS (11).md`, secciones 8.3, 8.4 y 8.5.
- Escenarios: `API_HOOK_SCENARIOS (2).md`.
- Integración interna: `docs/05-integraciones/integracion-sgc.md`.
- Implementación: `src/application/sgc-integracion/sgc-integracion-service.ts`.
- Estado de corrección: `src/lib/shared/utils/solicitud-documentos.ts`.
- Carga del cliente: `src/components/solicitudes/cliente-upload-modal.tsx`.
