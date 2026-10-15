# Plan de implementación — SGC en producción (guía 2026-10-13)

Fuente: `C:\Users\ASUSVivobook\Downloads\APIS_USE_HOOKS (2).md` (v2 local, 948 líneas,
106 KB). Diferencias relevantes contra la versión usada en la integración actual
(`stands/APIS_USE_HOOKS (2).md`, 44 KB, 2026-09-25).

## Estado de implementación (2026-10-13)

- **F0 ejecutado en el working tree (sin commit)**:
  - C1: alias del receptor en `src/app/sgc/route.ts` (la suscripción del SGC apunta a `/sgc`).
  - C2: migración `20261013120000_add_sgc_devolucion_datos` + `sgc_expediente.devolucion_*`;
    `workflow.returned` ahora solo marca `observed` cuando `requiresDocumentChange !== false`,
    y guarda motivo/destino/estrategia; 3 tests nuevos.
  - C3 (parcial): tope `SGC_RECONCILIAR_MAX_POR_CORRIDA = 50` con rotación por `lastSyncedAt`
    (el backoff de errores, 429 incluido, ya lo aplica el outbox; respetar `Retry-After` queda opcional).
  - C4: verificado sin cambios (el panel ya es null-safe con `completedBy`).
  - C5: **no aplicado a propósito** (el correo de aprobación se `await`ea; quitarlo podría romper
    tests en vuelo de otra sesión — decidir tras su commit).
- Verificación local: `npx tsc --noEmit` 0 errores, `npx eslint .` 0 errores, `npx vitest run src`
  577 passed / 2 skipped.
- Pendiente: precarga del motivo del webhook en el modal de declaración (UI, opcional),
  F1 QA, F2 cutover (requiere clave y secreto HMAC de producción).

## 1. Qué cambió en la guía

| # | Cambio | Sección |
|---|--------|---------|
| 1 | **Límite 120 req/min por clave** → `429`; reintentar con backoff | §1.1 (nuevo) |
| 2 | **Webhooks: producción entrega real y activa; QA es `sink` (no entrega)** | §6.5 (actualizado) |
| 3 | La suscripción de webhook apunta a `https://ecommerce.sistemasiimp.org.pe/sgc` | §0 y §6.5 |
| 4 | **`workflow.returned` trae `requiresDocumentChange`, `destinationStepId`, `destinationAreaId`, `strategy`, `reason`**. No toda devolución exige acción del cliente/origen | §8 |
| 5 | El motivo de la observación viaja en `data.reason` del webhook (ya no hay que pedirlo aparte) | §8 |
| 6 | `steps[].completedBy` es `null` para pasos pendiente/en curso/rechazado (también en la consulta v1) | §7 y §11 (corrección de proyección) |
| 7 | Rechazo (`rejected`) es subsanable con el mismo flujo §8/§8.1 (ya implementado) | §8.2 |
| 8 | Endpoints nuevos v1: `PATCH /contracts/{id}`, `GET /contracts?q=&stage=&page=`, `GET /documents/{documentId}`, `GET /document-versions/{versionId}` | §7.1, §7.2, §11 |
| 9 | Confirmar una nueva versión del principal dispara resumen ejecutivo IA automático (sin acción nuestra) | §5.3 |
| 10 | **API v2 participativa: incremento local, sin despliegue** en QA/producción. No enviar `participationMode` a v1 | §API v2 |
| 11 | Hechos nuevos de outbox (`participation.document-version-accepted`, `contract.archived`, etc.): suscripción administrativa opt-in, **no** amplían la allowlist M2M | §v49–v60 |

## 2. Impacto sobre la implementación actual

| Tema | Estado en ContratosStands | Impacto | Acción |
|------|---------------------------|---------|--------|
| URL del receptor de webhook | Receiver en `/api/integracion/sgc/webhook`; **no existe ruta `/sgc`** | ALTO — si la suscripción apunta literal a `/sgc`, las entregas reales de producción darán 404 | C1 |
| `workflow.returned` | Se mapea **siempre** a `observed` y habilita la ventana de subsanación del cliente | ALTO — devoluciones internas (`requiresDocumentChange=false`) invitarían al cliente a corregir/reenviar, lo que la guía prohíbe | C2 |
| Motivo de devolución | Se declara manualmente (admin: motivo libre + modo) | MEDIO — el motivo real ya viene en el webhook; debe guardarse y precargarse | C2 |
| Límite 429 | `sgc-client` lanza error en cualquier `!res.ok`; sin backoff específico | MEDIO — cron de reconciliación y reintentos pueden topar el límite | C3 |
| `completedBy: null` | El panel usa etiquetas propias; pendiente verificar que no asuma `completedBy` no nulo | BAJO | C4 |
| Ack del webhook < 10 s | El service procesa inline y **awaitea el correo** de aprobación | BAJO — correo lento podría superar los 10 s y provocar reintentos | C5 |
| Endpoints 7.1/7.2 | No usados | BAJO — mejoran el sync (resolver versión/documento desde webhooks) | C6 (opcional) |
| `participationMode` / v2 | No se envía | N/A — no enviar; fase futura | — |
| Resumen IA automático | No aplica | N/A | — |

## 3. Cambios de código

### C1. Ruta de webhook `/sgc` (bloqueante para producción)

La guía afirma que la suscripción ya apunta a `https://ecommerce.sistemasiimp.org.pe/sgc`.
Antes de producción:

1. Verificar con el equipo del SGC la URL exacta registrada en la suscripción.
2. Si es literal `/sgc`, agregar una ruta alias que despache al mismo controller:
   `src/app/sgc/route.ts` → `POST = sgcWebhookController.recibir` (mismo `runtime = "nodejs"`).
   Alternativa preferida de largo plazo: pedir que la suscripción apunte al endpoint canónico
   `/api/integracion/sgc/webhook` (un solo contrato documentado).
3. Dejar la verificación end-to-end para la fase F3 (QA no entrega webhooks reales).

### C2. Semántica de `workflow.returned` (bloqueante para producción)

1. **Migración** `0048_add_sgc_devolucion_datos` sobre `sgc_expediente`:
   - `devolucion_requiere_cambio` BOOLEAN NULL
   - `devolucion_motivo` VARCHAR(500) NULL
   - `devolucion_destino_step_id` VARCHAR(64) NULL
   - `devolucion_estrategia` VARCHAR(30) NULL
   (additiva; sin backfill; los registros previos quedan `NULL` = comportamiento legado).
2. **`sgc-webhook-service.ts`**: en `WORKFLOW_RETURNED` leer `data.requiresDocumentChange`,
   `data.reason`, `data.destinationStepId` y `data.strategy`:
   - `requiresDocumentChange === true` → `lifecycleStatus = observed` (como hoy) y guardar los datos.
   - `requiresDocumentChange === false` → **no** cambiar `lifecycleStatus`; solo persistir el
     último retorno (para historial/admin). No habilita subsanación del cliente.
   - Guardar siempre `devolucion_*` para trazabilidad.
3. **Gating UI** (constante + util):
   - `solicitud-documentos.ts`: `sgcDevuelto(s)` se mantiene; nueva condición efectiva:
     - `observed` → subsanable solo si `sgcDevolucionRequiereCambio !== false`
       (fallback `NULL` = true, compatibilidad con registros previos).
     - `rejected` → subsanable (regla vigente §8.2, no cambia).
   - `sgc-expediente-panel.tsx` (`subsanable`), `solicitud-review.tsx`
     (`sgcSubsanable`/`puedeReemplazarContrato`) y `mis-solicitudes-manager.tsx`
     deben consumir la misma utilidad (una sola regla).
4. **Precargar motivo**: el modal de declaración de subsanación del admin se precarga con
   `devolucionMotivo` (webhook) como texto inicial editable; el `subsanacionModo`
   (`nuevo_contrato`/`mismo_contrato`) se sigue declarando.
5. **Tests**: `sgc-webhook-service.test.ts` (3 casos: cambio=true, cambio=false, sin campo),
   `solicitud-documentos.test.ts` (gating en panel y ventana cliente).

### C3. Manejo de `429` + backoff

1. `sgc-client.ts`: clasificar `429` como error retryable (nueva propiedad en `SgcApiError`,
   p. ej. `retryable`), respetando `Retry-After` si viene.
2. `sgc-outbox-service.ts`: al reintentar, si el error es `429` usar el backoff existente
   (`SGC_OUTBOX_BACKOFF_BASE_MS`) sin consumir intento extra (o con penalización mínima).
3. Cron `sgc-reconciliar`: acotar el lote por corrida (p. ej. máximo 50 expedientes) para no
   superar 120 req/min con la misma clave.
4. Tests: `sgc-client.test.ts` (429 → retryable), `sgc-outbox.test.ts` (reprogramación).

### C4. `completedBy: null` (verificación)

Revisar `sgc-expediente-panel.tsx` y el mapeo del detalle (`sgc.ts` mapper):
usar `steps[].status` para el stepper y `completedBy` solo cuando `status === "completed"`;
`history[]` para las constancias anteriores. Agregar caso de test del mapper con
`completedBy: null` en paso `current` y `rejected`.

### C5. Ack del webhook en menos de 10 s

En `sgc-webhook-service.ts`, la notificación al cliente (`notificarAprobacion`) no debe
bloquear la respuesta: ejecutarla sin `await` (fire-and-forget con catch) o moverla a un
job. Mantener 2xx inmediato; el SGC reintenta 6 veces si no hay 2xx en 10 s.

### C6. (Opcional, post cutover)

- `GET /documents/{documentId}` y `GET /document-versions/{versionId}`: usar en el
  sync-on-read para refrescar historial de versiones sin pedir el expediente completo.
- `PATCH /contracts/{id}` y `GET /contracts?q=`: evaluar si aportan al backoffice.

## 4. Coordinación con el equipo del SGC (externo)

| # | Ítem | Detalle |
|---|------|---------|
| 1 | URL de suscripción de webhook | Confirmar/actualizar (ver C1) |
| 2 | Clave de **producción** | Activar clave nueva; actor con rol `contract-manager` |
| 3 | Secreto HMAC de producción | El de la suscripción debe coincidir con `SGC_WEBHOOK_SECRET` de prod |
| 4 | Catálogo producción | Confirmar que existen `areaCode=EVENTOS` y `contractTypeCode=AUSPICIO` (hoy configurados en prod contra QA) |
| 5 | Entrega real | Confirmar que la suscripción de producción está activa y entrega al host autorizado |
| 6 | Plantilla/fields | Confirmar que el tipo de producción no exige `fields` distintos a los de QA |

## 5. Configuración de producción (ECS `iimp-ctrst-prod-app`)

**Regla por entorno (obligatoria):**

- **Producción (ECS) → SGC de producción** (`https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1`).
- **Local / desarrollo → SGC de QA** (`https://qa-gestion-contratos.sistemasiimp.org.pe/api/integrations/v1`).

La separación es solo por variables de entorno (task definition en ECS vs `.env` local); no existe
código condicional por ambiente. Producción hoy apunta a QA y debe cambiarse en el cutover (F2).

| Variable | Valor actual (revisión :12) | Valor objetivo |
|----------|------------------------------|----------------|
| `SGC_ENABLED` | `1` | `1` |
| `SGC_MODE` | `real` | `real` |
| `SGC_API_URL` | `https://qa-gestion-contratos...` | `https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1` |
| `SGC_API_KEY` (Secret) | clave QA | clave **producción** |
| `SGC_WEBHOOK_SECRET` (Secret) | secreto QA | secreto **producción** (nuevo, de la suscripción) |
| `SGC_AREA_CODE` | `EVENTOS` | confirmar en catálogo prod |
| `SGC_CONTRACT_TYPE_CODE` | `AUSPICIO` | `EXHIBIDORES` (cambiado 2026-10-13; confirmar el code exacto en el catálogo prod del SGC antes del cutover) |
| `SGC_TIMEOUT_MS` | `10000` | sin cambio |

## 6. Fases

### F0 — Preparación (sin tocar producción)
1. Implementar C1–C5 + migración + tests; `npx tsc --noEmit`, `npx eslint .`, `npx vitest run src` en verde.
2. Commit/push (auto-despliega) y verificar health del servicio.
3. Solicitar al SGC los ítems del §4.

### F1 — Verificación en QA (con código nuevo)
1. Flujo completo contra QA (sin webhooks reales; usar `GET /contracts/{id}` y el cron):
   crear → subir contrato/anexos → simular devolución (`requiresDocumentChange=true`) →
   declarar motivo/modo → cliente re-firma → `/resend` → aprobar.
2. Probar en QA una devolución interna (`requiresDocumentChange=false`): el cliente **no** debe
   ver ventana de subsanación.
3. Verificar que `SGC_API_URL` de QA no rompe con el manejo de 429 (test unitario basta).

### F2 — Cutover de producción
1. Actualizar `SGC_API_URL`, `SGC_API_KEY` y `SGC_WEBHOOK_SECRET` en la task definition
   (nueva revisión) y forzar nuevo deployment (~7 min).
2. `RUN_MIGRATIONS` aplica `0048` al arrancar; confirmar en logs.
3. Health check OK y `/api/integracion/sgc/webhook` responde 401 sin firma.

### F3 — Verificación end-to-end en producción (entrega real)
1. Crear un expediente controlado en prod → subir contrato y anexos → `/resend`.
2. Confirmar llegada del webhook `workflow.started`/`advanced` al receptor (log + tabla inbox),
   firma HMAC válida y evento aplicado.
3. Provocar devolución con `requiresDocumentChange=true`: panel admin muestra motivo del SGC,
   declaración precargada, cliente ve ventana de subsanación.
4. Provocar devolución con `requiresDocumentChange=false`: el cliente **no** ve ventana.
5. Corregir → `/resend` → aprobación → descarga del firmado (enlace 60 s).
6. Revisar métricas: sin `429` sostenidos, sin reintentos de webhook mayores a 1.

### F4 — Post-cutover
1. Documentar en `docs/05-integraciones/integracion-sgc.md` (URL prod, 429, `requiresDocumentChange`,
   URL de receptor canónica).
2. Evaluar C6 y la suscripción opt-in a `participation.document-version-accepted`.
3. Dejar registrado el plan v2 participativa como fase futura (no enviar `participationMode`).

## 7. Rollback

- **Kill switch inmediato**: `SGC_ENABLED=0` (el sistema no llama al SGC; la revisión Legal
  sigue por el portal interno).
- **Reversión de config**: volver `SGC_API_URL` a QA y clave QA (nueva revisión de task def).
- **Reversión de código**: redeploy de la revisión previa del task definition (`:12`).
- La migración es aditiva; no requiere rollback.

## 8. Criterios de aceptación

- [ ] `npx tsc --noEmit`, `npx eslint .`, `npx vitest run src` en verde con los nuevos tests.
- [ ] Devolución interna (`requiresDocumentChange=false`) no habilita subsanación del cliente.
- [ ] Devolución con cambio (`requiresDocumentChange=true`) muestra el motivo del webhook y
      precarga la declaración del admin.
- [ ] Webhook real de producción recibido, firmado y aplicado (F3).
- [ ] `429` clasificado como retryable con backoff (test unitario).
- [ ] Sin errores en el cron de reconciliación por límite de tasa.
- [ ] Rollback probado (kill switch `SGC_ENABLED=0`).

## 9. Fuera de alcance

- **API v2 participativa** (portal del cliente, `participationMode`, paquetes, contactos):
  incremento local del SGC; no desplegado. No enviar esos campos por v1.
- Publicación final multipieza, firmas por pieza, OTP: no son endpoints M2M.
- Suscripciones a hechos nuevos de outbox: opt-in administrativo, no bloquea producción.
