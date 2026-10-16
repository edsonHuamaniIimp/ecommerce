# Integración SGC ↔ ContratosStands — Estado y pedidos

**Para:** equipo del SGC (autores de `APIS_USE_HOOKS` y `API_HOOK_SCENARIOS`).
**De:** equipo de ContratosStands (sistema de separación de stands).
**Fecha:** 15 oct. 2026.
**Referencias:** guía **`APIS_USE_HOOKS (4).md`** y runbook **`API_HOOK_SCENARIOS.md`**.

---

## 1. Estado de la integración (lo que ya cumple el contrato del runbook)

| Regla del runbook | Estado |
|---|---|
| `Authorization: Bearer sgc_…` solo backend (nunca navegador) | ✅ |
| `Idempotency-Key` por intención en **todos** los POST de negocio (creación, documentos, complete, `/resend`) | ✅ |
| Secuencia de documentos en 3 fases (reserve → PUT con headers → complete), checksum SHA-256 | ✅ |
| Reemplazo del principal con la misma `documentId`; anexos con `documentId: null` | ✅ |
| `outcome: rejected` exige nueva reserva | ✅ |
| Devolución interna (`requiresDocumentChange=false`): sin carga ni `/resend` | ✅ |
| Devolución con cambio / rechazo: versión nueva del principal + **un** `/resend` | ✅ |
| Rechazo recuperable (`422` sin versión nueva) | ✅ |
| No rotar la Idempotency-Key tras timeout (outbox con misma clave) | ✅ |
| `429` con backoff | ✅ (jitter: mejora pendiente menor) |
| Webhook HMAC con cuerpo crudo y tolerancia 300 s | ✅ |
| **Dedup por `x-sgc-delivery`** (además de `eventId`) | ✅ |
| QA en `sink` → polling `GET` | ✅ (sync-on-read + cron de reconciliación) |

Pendiente menor nuestro: mover correo/orden de pago fuera del request del webhook (ack < 10 s),
que haremos de forma coordinada.

---

## 2. Pedidos al equipo del SGC

1. **Clave QA vigente.** La clave anterior fue revocada: todas las llamadas responden
   `401 {"error":"No autorizado."}` — incluido `GET /api/integrations/v2/contract-types`.
   Sin clave no podemos probar el alta de expediente (`500 → SGC 401`).
2. **Clave de producción** (actor con rol `contract-manager`) y confirmación de la base
   `https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1`, para el cutover.
3. **Confirmar** que `POST /contracts/{id}/documents` y `POST /document-versions/{id}/complete`
   aceptan/validan `Idempotency-Key` (ya la enviamos en ambas).
4. **Confirmar** que el webhook de producción incluirá el header **`x-sgc-delivery`**
   (lo usamos para deduplicar entregas).
5. **V2 participativa en QA**: con la clave nueva validaremos `routes.client`, `participationPolicy`
   y `eventEditions` para decidir la fase participativa (Portal del Cliente).
6. **Webhooks**: confirmar la suscripción apuntando a nuestro receptor
   (`https://ecommerce.sistemasiimp.org.pe/sgc`) y entregarnos el **secreto HMAC de producción**
   (el de QA ya está configurado de nuestro lado).

---

## 3. Payloads de ejemplo (pruebas del flujo)

**Creación de expediente** — `POST {BASE}/api/integrations/v1/contracts`
```json
{
  "code": "A-042",
  "areaCode": "EVENTOS",
  "contractTypeCode": "AUSPICIO",
  "name": "Separacion de stand - A-042",
  "counterpartyLegalName": "Expositor Minero S.A.C.",
  "counterpartyEmail": "contacto@expositorminero.pe",
  "counterpartyTaxIdentifier": "",
  "processOrigin": "ContratosStands",
  "fields": { "<clave requerida del tipo>": "<valor>" }
}
```
Headers: `Authorization: Bearer sgc_<clave>` · `Idempotency-Key: stands/reserva/<id>`
(`fields` se envía según lo que declare `GET /contract-types` para el tipo).

**Reserva de documento** — `POST /contracts/{contractId}/documents`
```json
{
  "category": "contract",
  "title": "Contrato de separacion de stand v1",
  "fileName": "contrato-stand-A-042.pdf",
  "sizeBytes": 245678,
  "checksumSha256": "<sha256 hex>",
  "declaredMimeType": "application/pdf",
  "replacementReason": "Carga inicial desde ContratosStands",
  "documentId": null
}
```
(Idempotency-Key derivada del contenido; `complete` con `Idempotency-Key: complete/<versionId>`.)

**Reenvío tras corrección** — `POST /contracts/{contractId}/resend`
sin body; `Idempotency-Key: stands/resend/<id>/v<version>`.

---

## 4. Prueba rápida de aceptación sugerida

1. `GET /contract-types` (catálogo + `fields`).
2. Crear expediente (`201`) → subir principal (reserve/PUT/complete `accepted`).
3. `/resend` una vez → observar `workflow.*` (o `GET` si QA está en `sink`).
4. Devolución con `requiresDocumentChange=true` → versión nueva + `/resend` → nueva ronda.
5. Devolución interna (`false`) → sin cargas ni `/resend`.

(La matriz completa de aceptación está en el runbook §11; la usaremos como checklist de cierre.)
