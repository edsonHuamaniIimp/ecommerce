# Integración SGC ↔ ContratosStands — bloqueo de autenticación (401)

**Para:** equipo del SGC (autor de `APIS_USE_HOOKS.md`).
**De:** equipo de ContratosStands (sistema de separación de stands / e-commerce).
**Fecha:** 22 set. 2026.

---

## TL;DR — lo que necesitamos de ustedes

Con la **clave que nos entregaron** (conexión `ECOMMERCE_IIMP_CONEX`) **toda llamada a la API
responde `401 {"error":"No autorizado."}`**, tanto desde Lima como desde AWS. La ruta usada es la
de su documentación: `POST/GET https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contracts`
con `Authorization: Bearer sgc_<clave>`.

Necesitamos **una** de estas cosas:

1. **Ejecuten este mismo `curl` contra el origen directo (sin CloudFront).** Si ahí devuelve
   `201`, entonces CloudFront no está reenviando el header `Authorization` (ver hipótesis abajo).
2. **Revisen la *Origin request policy* de CloudFront** del distribution de
   `gestion-contratos.sistemasiimp.org.pe`: debe **reenviar el header `Authorization`** al origen
   (p. ej. política `AllViewer`). Por defecto CloudFront **excluye** `Authorization`.
3. **Confirmen que la clave está activa** y asignada al rol `contract-manager`.
4. **Pásennos un `curl` que les funcione** (con su URL/headers reales) y los códigos reales de
   `areaCode` y `contractTypeCode` para "separación de stands".

---

## Qué ya tenemos del lado nuestro (listo, no falta nada)

- Cliente HTTP implementado y probado (fases 0–6): crear expediente, subir contrato v1/anexos
  (3 fases con checksum SHA-256), consultar estado/stepper, webhooks con HMAC, subsanar y
  descargar el contrato firmado.
- `SGC_API_URL` configurada en producción:
  `https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1`.
- Integración **dormida** (`SGC_ENABLED=0`); se activa con variables de entorno cuando la auth
  funcione, sin recompilar.
- `npx tsc --noEmit` y `npx eslint` en 0 errores.

---

## La clave que nos dieron

- Conexión: `ECOMMERCE_IIMP_CONEX` — Actor: `ECOMMERCE_IIMP` (usuario Edson Huamani).
- Clave: `sgc_...` (nos indicaron que corresponde al ambiente **QA**:
  `https://qa-gestion-contratos.sistemasiimp.org.pe/`).
- Resultado real hoy: **401 `{"error":"No autorizado."}`** en **ambos** ambientes
  (QA y producción).

---

## Qué probamos y qué pasa

### Formatos de header (con la clave real)

```
Authorization: Bearer sgc_<clave>     -> 401
Authorization: Bearer <clave>         -> 401
Authorization: <clave>                -> 401
Authorization: ApiKey|Token <clave>   -> 401
x-api-key / api-key / apikey: <clave> -> 401
Authorization: Basic <base64>         -> 401
por query string (?apiKey= / ?key=)   -> 401
POST + Idempotency-Key + JSON válido  -> 401
```

### Rutas

```
/api/integrations/v1/contracts              -> 401 {"error":"No autorizado."}   (correcta)
/api/integration/v1/contracts               -> 307 redirect /login
/integrations/v1/contracts                  -> 307 redirect /login
/api/v1/integrations/contracts              -> 307 redirect /login
```

### Ambientes y origen de la llamada (para descartar ambiente e IP)

- **Producción** `https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contracts`
  → 401 (desde Lima y desde AWS).
- **QA** `https://qa-gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contracts`
  → 401 (desde Lima).
- Todas las respuestas (QA y prod) llegan vía **CloudFront** (`via: ...cloudfront.net`,
  `X-Cache: Error from cloudfront`). El comportamiento es idéntico en ambos ambientes, por lo que
  el bloqueo no depende del ambiente ni de nuestra IP.

### Reproducción

```bash
curl -i -X POST https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contracts \
  -H "Authorization: Bearer sgc_<clave>" \
  -H "Idempotency-Key: ecommerce/pedido/12345" \
  -H "Content-Type: application/json" \
  -d '{"code":"ECOM-2026-0001","areaCode":"EVENTOS","contractTypeCode":"AUSPICIO",
       "name":"Prueba","counterpartyLegalName":"Cliente de prueba S.A.C.",
       "counterpartyTaxIdentifier":"20123456789","processOrigin":"ContratosStands"}'
# Respuesta actual: 401 {"error":"No autorizado."}
# Respuesta esperada: 201 {"contractId":"...","status":"created"}
```

---

## Hipótesis principal

**CloudFront no está reenviando el header `Authorization` al origen.** Así el backend nunca recibe
la clave y responde 401. Es una configuración por defecto de CloudFront: si la *cache/origin
request policy* no incluye `Authorization`, ese header se elimina antes de llegar al origen.

> **Actualización (22 set., tras ajustar el WAF):** el request **sí llega a la app** — la respuesta
> incluye headers de Next.js (`vary: rsc, next-router-state-tree, ...`) y cookies de Auth.js
> (`__Host-authjs.csrf-token`). Es decir, el 401 **lo emite el propio handler de integración**
> (`{"error":"No autorizado."}`), no el WAF ni CloudFront. Por eso ahora la causa más probable es
> **(b) la clave no está activa/validada en ese ambiente**, o **(c) el esquema de auth difiere**
> del documentado.

**Cómo verificarlo (2 minutos):**
1. Ejecutar el `curl` de arriba **directamente contra el origen** (la URL del ALB/servicio, sin
   CloudFront). Si devuelve `201`, queda confirmado.
2. En CloudFront → Behaviors → *Origin request policy*: agregar `Authorization` (o usar
   `AllViewer`). Guardar y probar de nuevo por el dominio público.

---

## Cómo debe verse cuando funcione

```
POST /api/integrations/v1/contracts   -> 201 {"contractId":"<uuid>","status":"created"}
GET  /api/integrations/v1/contracts/<contractId> -> 200 { ... }
```

---

## Recordatorio (webhooks)

El único flujo **sin** Bearer es el **webhook**, y es al revés: lo envía el SGC hacia nosotros,
firmado con HMAC (`x-sgc-signature`). Cuando lo habiliten: confirmar host autorizado, registrar
`POST https://ecommerce.sistemasiimp.org.pe/api/integracion/sgc/webhook` y enviarnos el secreto
HMAC.
