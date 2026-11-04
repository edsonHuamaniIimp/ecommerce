# Propuesta: observaciones del SGC **por documento** (campos opcionales)

> Para el equipo de desarrollo del **SGC**. Objetivo: que la devolución/rechazo indique **qué
> documento** se observó, para que ContratosStands pueda pedirle al cliente exactamente esa
> corrección (y no una ventana genérica). **Todos los campos son opcionales y aditivos**:
> si no se envían, el sistema sigue funcionando como hoy (compatibilidad total).

## 1. Situación actual

| Dato | Hoy | Problema |
|---|---|---|
| `data.reason` (webhook) | texto libre | No se sabe a qué documento aplica |
| `data.requiresDocumentChange` | booleano global | Dice si hay corrección, no cuál |
| Detalle `GET /contracts/{id}` | `documents[]` sin estado por documento | El cliente no puede ver qué corregir |
| Historial | observaciones como texto | Sin vínculo estructurado al documento |

ContratosStands guarda el `documentId` de cada pieza que sube (`POST /contracts/{id}/documents`),
por lo que **con un `documentId` en la observación alcanza** para mapear el documento local exacto.

## 2. Cambios propuestos (aditivos)

### 2.1 Webhook `workflow.observed` / `workflow.rejected`
Agregar `data.observations[]` **sin quitar** los campos actuales:

```json
{
  "eventId": "evt_01J...",
  "eventType": "workflow.observed",
  "resource": { "id": "096c3900-7464-449c-84e0-a35ca231d848", "type": "contract" },
  "data": {
    "strategy": "documentary",
    "destinationStepId": "internal-review",
    "requiresDocumentChange": true,
    "reason": "(resumen libre; se mantiene)",
    "observations": [
      {
        "observationId": "obs_01J9Z...",
        "documentId": "c2ffd115-7634-41df-962d-95866876a7d0",
        "versionId": "b7c1e2... (opcional: version revisada)",
        "versionNumber": 2,
        "category": "annex",
        "title": "Vigencia de Poder (o equivalente) — opcional",
        "severity": "blocking",
        "message": "Adjuntar Vigencia de Poder actualizada (antigüedad máxima 3 meses).",
        "requiresDocumentChange": true,
        "status": "open",
        "createdBy": { "name": "Matias Freundt", "email": "mf@iimp.org.pe" },
        "createdAt": "2026-11-02T21:23:00Z"
      }
    ]
  }
}
```

Casos especiales:
- **Documento faltante**: `"documentId": null`, `"category": "annex"`, `"title": "Ficha RUC"`,
  `"requiresNewDocument": true` (opcional).
- **Contrato observado**: `"documentId"` del contrato + `"category": "contract"`.
- Si no hay observaciones por documento: **omitir** `observations` (o enviarlo como `[]`).

### 2.2 `GET /contracts/{contractId}` (detalle)
```json
"documents": [
  {
    "documentId": "c2ffd115-...",
    "category": "annex",
    "title": "Vigencia de Poder...",
    "currentVersionId": "...",
    "currentVersionNumber": 2,
    "currentFileName": "vigencia-poder-E-118-3f2a91.pdf",
    "status": "observed",
    "observations": [
      { "observationId": "obs_01J9Z...", "message": "...", "severity": "blocking",
        "status": "open", "requiresDocumentChange": true,
        "createdBy": "Matias Freundt", "createdAt": "2026-11-02T21:23:00Z" }
    ]
  }
]
```
- `status` por documento: `pending` | `approved` | `observed` | `rejected`.
- `observations[].status`: `open` | `resolved` (no borrar; resolver).

### 2.3 `GET /documents/{documentId}` (opcional)
Incluir `observations[]` y `currentVersionNumber` para auditoría/historial por pieza.

### 2.4 Respuesta esperada del endpoint de webhooks (ACK) y reintentos
- Su endpoint debe responder **2xx** (200/204) en **≤10 s**. Si el procesamiento interno es
  pesado, confirme el evento y procese en segundo plano.
- **Reintentos**: reenviar con el **mismo `x-sgc-delivery`** y el mismo `eventId`. Nuestro
  sistema deduplica por ambos, así que un reintento no crea observaciones ni notificaciones
  duplicadas.
- **Firma**: `x-sgc-signature: t=<unix>,v1=<hmac>` (HMAC-SHA256 de `<t>.<payload>`, tolerancia
  300 s).
- **Resolución de observaciones**: enviar `status: "resolved"` (no borrarlas). Nuestro lado
  actualiza el estado sin perder el historial.
- **Agrupación**: si en una misma ronda hay varias observaciones, enviarlas en el mismo arreglo
  `observations[]` (no dependemos del orden).
- **Formato**: JSON UTF-8; fechas ISO-8601 en UTC; campos desconocidos se ignoran.

## 3. Reglas de consistencia (clave para el mapeo)

1. `documentId` = el devuelto por `POST /contracts/{contractId}/documents` (estable).
2. `observationId` **inmutable** → dedupe idempotente (webhook reenviado o polling repetido).
3. Fechas ISO-8601 **UTC**.
4. No eliminar observaciones: pasar `status` a `resolved`.
5. `requiresDocumentChange` **por observación** (no solo global).
6. `severity`: `blocking` | `important` | `info` (alineado a su UI).
7. Confirmar la regla de `POST /contracts/{id}/resend`: ¿exige versión nueva del contrato
   siempre, o basta una versión nueva del documento observado? (define si el cliente debe
   volver a firmar cuando solo se observó un anexo).

8. `versionId`/`versionNumber` (**opcionales**): indican la **versión revisada**. Si no vienen,
   la observación aplica al **documento lógico** (suficiente para operar).

## 4. Compatibilidad

- **Todo opcional**: si `observations` no viene, ContratosStands mantiene el flujo actual
  (ventana de documentos genérica + contrato a criterio del Asociado).
- No cambiar nombres/formatos existentes (`reason`, `requiresDocumentChange`, `strategy`, …).
- Los consumidores deben ignorar campos desconocidos (ya lo hacemos).

## 5. Qué hará ContratosStands cuando lleguen las observaciones

1. `documentId` → tabla `sgc_documento` (documento local) → mostrar **solo ese documento**
   observado al cliente, con el mensaje.
2. Notificación al cliente (campana + correo) con el nombre del documento y el motivo.
3. Si el observado es **contrato** (`category: "contract"`) → habilitar al **Asociado/Admin**
   “Regenerar contrato” (nueva versión; el cliente firma y reenvía).
4. Si son **anexos** → el cliente reemplaza los documentos y usa **“Reenviar al SGC”**.
5. Si no vienen las observaciones → flujo genérico actual (sin bloquear operación).

## 6. Casos de prueba que pedimos enviar (fixtures)

1. Observación de **anexo** (documento existente).
2. Observación de **contrato**.
3. **Documento faltante** (`documentId: null`).
4. Observación **resuelta** (`status: resolved`) en una segunda entrega.
5. Dos observaciones en la misma ronda (anexo + contrato).

Con estos ejemplos montamos las pruebas y validamos el mapeo end-to-end.

## 7. Estado de implementación (2026-11-03)

- La guía v6 del SGC ya envía `observations[]` por documento; ContratosStands las
  persiste y las muestra al cliente con el documento y el motivo exactos.
- Se implementó el reemplazo guiado del documento observado, la validación previa al
  reenvío y el estado **"Revisión solicitada"** para evitar reenvíos duplicados.
- Los campos siguen siendo **opcionales**: si no llegan observaciones, el flujo legacy
  se mantiene sin cambios.
