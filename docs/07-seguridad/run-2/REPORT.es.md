# Re-auditoría de seguridad — ContratosStands (corrida 2)

> Auditoría aditiva sobre el **delta** desde la corrida 1: la superficie **nueva de integración SGC** (no existía en la corrida 1) y la **revalidación** de los 43 hallazgos previos en los archivos que cambiaron (refactor de tipado estricto + constants-first).
> Commit base: `de1ebbbc07019ab93031f8d9ab25e9bba1928df6` + working tree con cambios sin commitear. **Solo análisis de código; sin ejecución** (host Windows sin sandbox).

## Resultado en una línea

**Sí hay problemas.** El refactor de tipado/constantes **no introdujo ni arregló vulnerabilidades**: los **28 hallazgos confirmados de la corrida 1 siguen vigentes** (todos `unchanged`). La superficie **SGC nueva** agrega **4 leads nuevos** (sin severidad, requieren un dato de despliegue) y **1 descartado**.

| Categoría | Corrida 1 | Nuevos (corrida 2) | Total |
|---|---|---|---|
| Confirmados | 28 | 0 | **28** |
| Necesitan validación | 13 | 4 | **17** |
| Descartados | 2 | 1 | **3** |
| **Total** | 43 | 5 | **48** |

## 1. Revalidación de hallazgos previos (archivos cambiados)

Los 28 hallazgos `confirmed` se re-revisaron contra el código actual (los archivos sí cambiaron por el refactor de tipos y constantes). Resultado: **28/28 `unchanged`** — la misma causa raíz sigue presente. No se encontró ningún hallazgo que el refactor haya **arreglado** ni **introducido** en los archivos modificados. Ejemplos verificados en el commit actual:

- `solicitudes.listar/detalle/historial` siguen sin binding de owner (`src/controllers/solicitudes.controller.ts`, `solicitudes-repository.ts`).
- `revisar/orden-pago/reevaluar` siguen sin permiso por área/facturación.
- `/api/gess/*`, `/api/upload`, `/api/reniec`, `/api/sunat`, `/api/kbservicios`, `/api/errors/log` siguen sin autenticación en el middleware.
- `auth.login` sigue comparando contraseña en texto plano; reset con `Math.random()`; JWT con secreto de respaldo.
- Infra: `prisma db push` en arranque, contenedor root con bind rw, TLS de clientes externos deshabilitado, CloudFront→ALB `http-only`, ALB público, action mutable + token en `.git/config`, `.env.prod` no ignorado.

## 2. Superficie nueva auditada: integración SGC

### 2.1 Lo que está bien (control positivo)
- **Webhook `/api/integracion/sgc/webhook`**: firma **HMAC-SHA256** sobre el cuerpo crudo (`t=<unix>,v1=<hmac>`), **comparación en tiempo constante**, **ventana de tolerancia** de 300 s, y **fail-closed** si `SGC_WEBHOOK_SECRET` no está definido (la verificación falla antes de cualquier escritura). Idempotencia por `eventId` (`@unique`) con inbox.
- **`DocumentoOrigen.leerLocal`**: contención de ruta correcta para `/uploads/` (no hay traversal).
- **Config fail-closed**: `SGC_ENABLED` exige `"1"`; faltantes de API URL/key lanzan error.

### 2.2 Leads nuevos (sin severidad; requieren dato de despliegue)
Todas dependen de `SGC_ENABLED="1"` y/o de hechos del entorno, por eso quedan como **necesitan validación**:

1. **SSRF autenticado** — `POST /api/sgc/subsanar` acepta `url` del cliente y `DocumentoOrigen.leerRemoto` hace `fetch(url)` para cualquier `http(s)`, **sin allowlist de hosts, sin timeout y sin límite de tamaño**; los bytes se empujan al flujo SGC. El fetch ocurre **antes** de verificar que el expediente exista. (`src/infrastructure/external/documento-origen.ts`, `src/controllers/sgc.controller.ts`).
2. **Falta binding de owner/evento en `/api/sgc`** — `detalle`, `descarga`, `subsanar` y `sincronizar` toman `solicitudId` del cliente y solo exigen sesión; el gate del middleware es el permiso amplio `solicitudes:view`, que **también tiene el rol `cliente`**. Cualquier cliente autenticado puede leer el expediente/descarga de otro y lanzar una subsanación sobre otra solicitud. (`middleware.ts:29`, `sgc.controller.ts`).
3. **Update por `documentId` global sin scope de expediente** — `subirPiezaDocumental` resuelve el expediente por `solicitudId` pero actualiza `sgcDocumento.update({ where: { documentId } })`, y `documentId` es **globalmente único**; el `documentId` lo elige el cliente. Permite sobrescribir la correlación de otro expediente. (`sgc-repository.ts:110-112`, `sgc-integracion-service.ts:147`).
4. **Cuerpo sin límite antes del HMAC** — el webhook público hace `await request.text()` **antes** de verificar la firma y no hay límite de tamaño a nivel app; en el camino ECS (sin nginx) el único tope sería ALB/CloudFront. (`sgc-webhook.controller.ts:11`).

### 2.3 Descartado
- **`SGC_MODE=real` ignorado / mock siempre conectado** (`services.ts` siempre instancia `SgcClientMock`): es un defecto real de integración/operación (ids `mock-*` persistidos como `contractId`, links `mock-sgc.local`, confirmaciones siempre `ACCEPTED`), pero **no es una frontera de seguridad con principal/atacante** — se retuvo como `rejected` con su razón y como nota de hardening.

## 3. Hardening sugerido (SGC)
- Parsear el payload del webhook con Zod (el contrato existe en `docs/openapi.yaml`; el validador no).
- Hacer atómica la idempotencia (`P2002` → `duplicado:true`); registrar como error el caso "expediente no encontrado" en vez de marcarlo procesado.
- Unicidad compuesta `@@unique([sgcExpedienteId, documentId])` y agregar `sgcExpedienteId`/owner a `actualizarDocumento`.
- Aplicar `SGC_TIMEOUT_MS` con `AbortController` y tope de tamaño en `leerRemoto`; allowlist de hosts.
- Gatear los endpoints de escritura SGC con un permiso de escritura explícito (no `solicitudes:view`).
- Seleccionar el cliente SGC por `getSgcMode()` con una factory y fallar al arrancar si `mode=real` sin adaptador real.

## 4. Artefactos
- `findings.json` — 48 registros (28 confirmed, 17 needs_validation, 3 rejected), validado contra `report-schema.json`.
- `run-metadata.json` — metadatos de la corrida y referencia a la corrida 1.
- Corrida 1: `../run-1/` (ledger, findings, REPORT, FINDINGS-DETAIL, NEEDS-VALIDATION).

> Conclusión: la deuda de seguridad de la corrida 1 sigue abierta; la integración SGC añade 4 leads por resolver (destacan SSRF y falta de autorización por objeto). Ninguno es explotable "de fábrica" porque el feature flag `SGC_ENABLED` está apagado por defecto y no existe cliente SGC real; deben cerrarse antes de activar el flag en producción.
