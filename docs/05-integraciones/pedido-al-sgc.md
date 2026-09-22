# Pedido al equipo del SGC — credencial, autenticación y catálogos

> Documento para enviar al equipo que desarrolla el SGC (autor de `APIS_USE_HOOKS.md`).
> Contexto: ContratosStands (sistema de separación de stands) es el **cliente**; el SGC es el
> **proveedor** de `/api/integrations/v1/*` y de los webhooks.
> Estado: el host y el comportamiento de la autenticación ya se probaron contra producción
> (ver evidencia). Quedan dudas puntuales sobre el mecanismo de auth.

## Hallazgo 1: el dominio de la API no está en la documentación

La guía `APIS_USE_HOOKS.md` muestra solo las rutas (`/api/integrations/v1/contracts`, etc.) pero
**no el host**. El único dominio que menciona es `canal-seguro.sistemasiimp.org.pe` (que según su
§5.5 es nuestro host de webhooks, no el suyo). El host real, encontrado por prueba, es:

```
SGC_API_URL = https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1
```

Sugerimos **agregar esa URL a la documentación** para que el próximo integrador no tenga que
adivinar el host.

## Hallazgo 2: la API sí exige credencial

La guía (§1) y nuestro diseño (§7) indican `Authorization: Bearer sgc_<clave>` en toda llamada.
Lo probamos y **confirmamos que exige credencial**: toda llamada sin una clave válida responde
`401 {"error":"No autorizado."}`.

Aclaración importante sobre una confusión posible: el `POST` **valida el cuerpo antes que el
auth**. Con un cuerpo malformado devuelve `400 {"error":"JSON inválido."}`; con un cuerpo JSON
válido (aunque sea `{}`) responde `401`. Por eso, a primera vista, el `POST` puede parecer
"abierto".

### Evidencia (22 set. 2026)

```
GET  /api/integrations/v1/contracts   (sin header)        -> 401 {"error":"No autorizado."}
GET  /api/integrations/v1/contracts   Bearer sgc_prueba   -> 401
GET  /api/integrations/v1/contracts   x-api-key: prueba   -> 401
GET  /api/integrations/v1/contracts/  (trailing slash)    -> 308
OPTIONS /api/integrations/v1/contracts                    -> 204 (CORS preflight)
POST /api/integrations/v1/contracts   body vacío/malformado -> 400 {"error":"JSON inválido."}
POST /api/integrations/v1/contracts   body = {}             -> 401 {"error":"No autorizado."}
POST /api/integrations/v1/contracts   body = {"code":"X"}   -> 401 {"error":"No autorizado."}
```

Además, con la **clave real** emitida (conexión `ECOMMERCE_IIMP_CONEX`) el resultado **desde
fuera sigue siendo 401** en todos los formatos probados: `Authorization: Bearer sgc_<clave>` con
y sin el prefijo `sgc_`, `Authorization: <clave>`, `ApiKey`/`Token`, `x-api-key`, `api-key`,
`apikey`, Basic, y por query string. También se probó en el `POST` con `Idempotency-Key` y
`Content-Type: application/json`.

Ruta confirmada (la única que responde el JSON propio de integración):
`/api/integrations/v1/contracts` → `401 {"error":"No autorizado."}`. Otras variantes
(`/api/integration/v1/contracts`, `/integrations/v1/contracts`, `/api/v1/integrations/contracts`)
redirigen `307` a `/login`, por lo que no son la API de integración.

Posibles causas a confirmar con el equipo del SGC: (a) la clave aún no está activa o no tiene
asignado el rol `contract-manager`; (b) el request debe originarse desde un host/red autorizado
(p. ej. su dominio `canal-seguro.sistemasiimp.org.pe`); (c) el header o esquema de auth difiere
del documentado.

### Reproducción

```bash
curl -i https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contracts
curl -i -H "Authorization: Bearer sgc_invalida" \
     https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contracts
curl -i -X POST https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contracts \
     -H "Content-Type: application/json" -d '{}'
```

## Preguntas para el equipo del SGC

1. **¿Cuál es el mecanismo de autenticación exacto?** La guía dice
   `Authorization: Bearer sgc_<clave>`, pero un comentario interno indicó que "no requiere bearer
   token". Desde afuera, toda llamada sin clave válida responde 401.
2. **¿Pueden compartir un `curl` de ejemplo que les funcione** contra
   `POST /api/integrations/v1/contracts` (con la clave real), para replicar exactamente los
   headers?
3. Si efectivamente **no** se requiere token, **¿cómo se llamó desde fuera?** (¿hay otro header,
   un valor por query string, o una allowlist de IP?). Necesitamos el detalle exacto.
4. Nota: el único flujo que **no** usa Bearer es el **webhook**, y es al revés — lo envía el SGC
   hacia nosotros, firmado con HMAC (`x-sgc-signature`). Si la aclaración se refería al webhook,
   confirmarlo.

## Lo que necesitamos

1. **Credencial / mecanismo de auth** para llamar la API (ver preguntas 1–3).
2. **`areaCode`** para "separación de stands" (lo define el SGC).
3. **`contractTypeCode`** para "separación de stands" (lo define el SGC).
4. **Webhooks** (cuando lo habiliten):
   - Confirmar qué host autorizan como receptor.
   - Registrar `POST https://ecommerce.sistemasiimp.org.pe/api/integracion/sgc/webhook`.
   - Enviar el **secreto HMAC** de la suscripción.

## Qué desbloquea la prueba end-to-end

Con el mecanismo de auth resuelto + `areaCode` + `contractTypeCode` ejecutamos el flujo completo:
crear expediente → subir contrato v1 → consultar estado/stepper → recibir webhook → subsanar →
descargar.

## Nuestro lado (referencia)

- Fases 0–6 implementadas; `npx tsc --noEmit` y `npx eslint` en 0 errores.
- Integración **dormida** (`SGC_ENABLED=0`) hasta tener la credencial. Al recibirla se activa solo
  con variables de entorno (`SGC_MODE=real`), sin recompilar.
- Doc de diseño: `docs/05-integraciones/integracion-sgc.md`.
