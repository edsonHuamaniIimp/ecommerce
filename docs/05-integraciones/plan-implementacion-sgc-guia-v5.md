# Plan de implementación — guía SGC v5 + runbook (2026-10-16)

Fuentes nuevas: `APIS_USE_HOOKS (5).md` y `API_HOOK_SCENARIOS (1).md`.
Contexto: responde el bloqueo actual (`422 "El código contractual no es válido"`) y fija
las reglas de `code`, `fields.input_demo` e idempotencia documental.

## 1. Qué cambió en la documentación (verificado por diff)

1. **`code` (resuelve el 422 actual)**
   - Identifica al **expediente completo** (no al stand) y debe ser **globalmente único en el SGC** (no solo por evento).
   - **3–40 caracteres**; empieza con letra o número; admite letras, números, punto, barra, guion y guion bajo; se **normaliza a mayúsculas**.
   - Recomendado: `STAND-<evento>-<reserva>` (ej. `STAND-PERUMIN-2026-0012`).
   - `code: "12"` se rechaza por formato/unicidad — **causa exacta de nuestro 422**.
2. **`fields.input_demo`**
   - Para `AUSPICIO` es **obligatorio** y ahora es **`short-text`** con etiqueta **"Número de stand"** (antes long-text).
   - **El número visible del stand va ahí** (ej. `"12"`, `"A-042"`).
3. **Idempotency-Key documental (ahora explícita)**
   - Reserve: `Idempotency-Key: stands/documento/<contractId>/<pieza>` · Complete: `Idempotency-Key: stands/documento/<versionId>/complete`.
   - "Reserva y confirmación exigen claves idempotentes **independientes**; repetir misma clave+payload recupera el mismo ticket; reutilizarla con otro payload/recurso → `409`".
4. **409/422 (tabla de errores actualizada)**
   - `409` = clave usada con otro contenido **o el `code` ya pertenece a otro expediente** (duplicado).
   - `422` = **código con formato inválido**, tipo/área inexistente, o falta campo propio del tipo (el mensaje dirá cuál).
5. **§0.1 Configuración vigente (2026-10-16)**: AUSPICIO + `fields.input_demo` ("Número de stand").
6. El runbook añade la key idempotente también al **`complete`** (§2) y actualiza el ejemplo del Escenario A (`fields.input_demo: "A-042"`).

## 2. Cambios a implementar (nosotros)

### P1 — Creación de expediente (desbloquea el 422) — **crítico**
1. `construirCodigoExpediente` (mapper `sgc.ts`):
   - Nuevo formato: **`STAND-<codigoEvento>-<standCode>`** normalizado (upper, solo `[A-Z0-9._/-]`), truncado a 40; multi-stand: `STAND-<codigoEvento>-<id8>`.
   - Determinístico y estable por solicitud (reintentos idempotentes).
   - Mantener el sufijo `-<id8>` ante colisión local (P2002) como hoy.
2. `fields`: en `conCamposDelTipo`/`valorPorDefectoCampo`, para `short-text` del tipo → enviar el **NÚMERO DE STAND** (`standCodes[0]`; multi: join corto), no el `name`. Asegura `input_demo` correcto para AUSPICIO.
3. Tests: mapper + integración + flujo completo (asserts de `code` y `fields`).

### P2 — Idempotency-Key documental (alinear formato)
1. Nueva constante `SGC_IDEMPOTENCY_DOC_PREFIX = "stands/documento"`.
2. Reserva: `stands/documento/<contractId>/<documentId|nuevo>-<sha256:16>` (mantiene "nueva por versión").
3. Complete: `stands/documento/<versionId>/complete` (formato del doc).
4. Tests del cliente SGC.

### P3 — Manejo del `409` por `code` duplicado en el SGC
1. En `crearExpedienteDesdeSolicitud`: ante **409**, reintentar **una vez** con `code` sufijado (`-<id8>` solicitad) y **clave idempotente nueva** (payload distinto = intención nueva).
2. Si el 409 es por "clave usada"/"sigue procesándose", no reintentar a ciegas: registrar con mensaje claro (como hoy).
3. Distinguir por el mensaje del SGC (code/código vs clave) — dejar el mapeo en el servicio, no en el cliente.
4. Tests: 409-code → reintento con sufijo; 409-clave → error registrado sin reintento.

### P4 — Verificación local (tu prueba)
1. Reiniciar `next dev` (env actual: `AUSPICIO`, clave QA nueva ✓).
2. "Registrar expediente" de la solicitud `9aa08c6b…` → debe crear con
   `code: STAND-19-12` (ej.), `fields.input_demo: "12"`, tipo `AUSPICIO`.
3. Subir contrato/anexos → `/resend` → revisar `estadoEnvio` y `GET`.

### P5 — Documentación
1. Actualizar `integracion-sgc.md` con: reglas de `code` (3–40, global, normalizado), `fields.input_demo` (short-text "Número de stand"), claves documentales, tabla 409/422.
2. Marcar `consulta-sgc-2026-10-15.md` como **respondida por la guía v5** (solo queda pedir clave de producción y confirmar `x-sgc-delivery`).

## 3. Fuera de alcance (sin cambios)
- V2 participativa (disponible en QA; no la usamos para stands).
- Ack <10 s del webhook (cambio coordinado pospuesto).
- Este plan NO toca facturación (canal distinto).
