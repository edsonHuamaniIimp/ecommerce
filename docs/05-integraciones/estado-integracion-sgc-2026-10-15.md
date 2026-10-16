# Estado de la integración SGC — avance según guía nueva (2026-10-15)

Referencias: `APIS_USE_HOOKS (4).md` (guía actualizada) y `API_HOOK_SCENARIOS.md` (runbook de
escenarios y reglas de integración). Este documento resume **qué de la integración ya cumple,
qué se ajustó y qué falta**, para coordinación con el equipo del SGC.

## 1. Lo que ya cumple el contrato del runbook

| Regla del runbook | Estado en ContratosStands |
|---|---|
| `Authorization: Bearer sgc_…` solo en backend (nunca navegador) | ✅ |
| `Idempotency-Key` por intención (creación y `/resend`) | ✅ |
| **Idempotency-Key en TODO POST de negocio** | ✅ Ajustado: reserva de documentos (clave derivada del contenido: `docs/<contractId>/<documentId\|nuevo>-<sha256:16>`) y `complete` (`complete/<versionId>`) |
| Secuencia de documentos en 3 pasos (reserve → PUT con headers → complete) | ✅ |
| Reemplazo del principal: misma `documentId`; anexo: `documentId: null` | ✅ |
| Subida rechazada (`outcome: rejected`) exige nueva reserva | ✅ |
| Devolución interna (`requiresDocumentChange=false`): no subir ni `/resend` | ✅ (solo reconciliación y stepper) |
| Devolución con cambio / rechazo: versión nueva del principal + **un** `/resend` | ✅ |
| Rechazo es recuperable (`422` si no hay versión nueva) | ✅ |
| No rotar la Idempotency-Key tras timeout (misma clave en reintentos) | ✅ (outbox con la misma clave) |
| 429 con backoff | ✅ (outbox con backoff; jitter pendiente menor) |
| Webhook: verificación HMAC con cuerpo crudo y tolerancia 300 s | ✅ |
| Webhook: **dedup por `x-sgc-delivery`** además de `eventId` | ✅ Implementado (columna `delivery_id` + chequeo previo) |
| Webhooks QA en `sink` → usar polling GET | ✅ (sync-on-read + cron de reconciliación) |

## 2. Pendientes de nuestro lado

1. **Ack del webhook < 10 s**: hoy el correo y la orden de pago se ejecutan dentro del request.
   Se moverán fuera (post-respuesta) **en cambio coordinado** para no alterar verificaciones
   existentes; hoy no hay riesgo real (QA no entrega webhooks y producción SGC aún no está conectada).
2. **429 con jitter** en el outbox (mejora menor).
3. **Migración local**: aplicar `npx prisma migrate deploy` (columna `delivery_id`).

## 3. Lo que necesitamos del equipo del SGC

1. **Clave QA vigente**: la anterior fue revocada (todas las llamadas responden `401 No autorizado`,
   incluido `GET /api/integrations/v2/contract-types`). Sin clave no se puede probar el alta de
   expediente en local (hoy devuelve `500 → SGC 401`).
2. **Clave de producción** (actor con rol `contract-manager`; entrega por canal seguro) —
   pendiente para el cutover a `https://gestion-contratos.sistemasiimp.org.pe`.
3. **Confirmar** que los endpoints documentales (`POST /documents`, `POST /document-versions/{id}/complete`)
   aceptan/validan `Idempotency-Key` (ya la enviamos).
4. **Confirmar** que el webhook incluirá `x-sgc-delivery` en producción (lo usamos para dedup).
5. **V2 participativa**: confirmar disponibilidad en QA con la clave nueva (`routes.client`,
   `participationPolicy`, `eventEditions`) para decidir la fase participativa.

## 4. Matriz de aceptación (runbook §11)

Se usará como checklist de cierre; los casos que dependen del SGC (webhooks `live` en producción,
clave de producción) se marcarán al conectar el ambiente productivo.
