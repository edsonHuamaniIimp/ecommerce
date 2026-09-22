# Logs de prueba — autenticación API SGC (401)

**Fecha:** 22 set. 2026, 09:38 (America/Lima)
**Origen:** red local (Lima). También se probó desde AWS `us-east-1` (mismo 401).
**Clave:** `sgc_<clave>` (conexión `ECOMMERCE_IIMP_CONEX`).
**Resultado:** todas las llamadas → `401 {"error":"No autorizado."}`.

> Observación clave: las respuestas traen headers de Next.js (`vary: rsc, ...`) y cookies de
> Auth.js (`__Host-authjs.csrf-token`). Eso indica que **el request llega a la aplicación** y que
> el 401 lo emite el **handler de integración** (no el WAF ni CloudFront).

---

## 1. QA — `GET` con `Authorization: Bearer sgc_<clave>`

```bash
curl -i https://qa-gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contracts \
  -H "Authorization: Bearer sgc_<clave>"
```

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json
Transfer-Encoding: chunked
Connection: keep-alive
Date: Tue, 22 Sep 2026 14:38:18 GMT
set-cookie: __Host-authjs.csrf-token=...; Path=/; HttpOnly; Secure; SameSite=Lax
set-cookie: __Secure-authjs.callback-url=https%3A%2F%2Fqa-gestion-contratos.sistemasiimp.org.pe; Path=/; HttpOnly; Secure; SameSite=Lax
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
Content-Security-Policy: base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: camera=(), geolocation=(), microphone=()
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-Cache: Error from cloudfront
Via: 1.1 9b06d154fff944cda67f7bcd6f9f49e4.cloudfront.net (CloudFront)
X-Amz-Cf-Pop: MIA3-P8
X-Amz-Cf-Id: g37M1sbkn0LG7dvH1qX0naEEKN61j4xtXpvScQOnA9F1KLV1jpmhqQ==
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains

{"error":"No autorizado."}
```

## 2. QA — `POST` con `Bearer` + `Idempotency-Key` + JSON

```bash
curl -i -X POST https://qa-gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contracts \
  -H "Authorization: Bearer sgc_<clave>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: ecommerce/pedido/qa-2" \
  -d '{"code":"ECOM-QA-0002","areaCode":"EVENTOS","contractTypeCode":"AUSPICIO","name":"QA 2","counterpartyLegalName":"PRUEBA SAC","processOrigin":"ContratosStands"}'
```

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json
Transfer-Encoding: chunked
Connection: keep-alive
Date: Tue, 22 Sep 2026 14:38:19 GMT
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
cache-control: no-store
Content-Security-Policy: base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: camera=(), geolocation=(), microphone=()
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
set-cookie: __Host-authjs.csrf-token=...; Path=/; HttpOnly; Secure; SameSite=Lax
set-cookie: __Secure-authjs.callback-url=https%3A%2F%2Fqa-gestion-contratos.sistemasiimp.org.pe; Path=/; HttpOnly; Secure; SameSite=Lax
X-Cache: Error from cloudfront
Via: 1.1 6eab87502250913ab33482bd1eb3f5b0.cloudfront.net (CloudFront)
X-Amz-Cf-Pop: MIA3-P8
X-Amz-Cf-Id: kOYo9CGYkam6__XM9xy-_vPynXeSsxzfZWba3bqTZtVc0G4WmX3WPA==
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains

{"error":"No autorizado."}
```

## 3. QA — `GET` SIN header de auth (control)

```bash
curl -i https://qa-gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contracts
```

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json
Transfer-Encoding: chunked
Connection: keep-alive
Date: Tue, 22 Sep 2026 14:38:19 GMT
set-cookie: __Host-authjs.csrf-token=...; Path=/; HttpOnly; Secure; SameSite=Lax
set-cookie: __Secure-authjs.callback-url=https%3A%2F%2Fqa-gestion-contratos.sistemasiimp.org.pe; Path=/; HttpOnly; Secure; SameSite=Lax
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
Content-Security-Policy: base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: camera=(), geolocation=(), microphone=()
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-Cache: Error from cloudfront
Via: 1.1 a3d81350f207075a8a67e8d7ae50f6de.cloudfront.net (CloudFront)
X-Amz-Cf-Pop: MIA3-P8
X-Amz-Cf-Id: fBZm-7OxQvfKcjYEuaL7p1j27xWPCUKs2ypSBnPXKZ-HJ3LaKkh9BQ==
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains

{"error":"No autorizado."}
```

## 4. PRODUCCIÓN — `GET` con `Bearer sgc_<clave>`

```bash
curl -i https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contracts \
  -H "Authorization: Bearer sgc_<clave>"
```

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json
Transfer-Encoding: chunked
Connection: keep-alive
Date: Tue, 22 Sep 2026 14:38:20 GMT
set-cookie: __Host-authjs.csrf-token=...; Path=/; HttpOnly; Secure; SameSite=Lax
set-cookie: __Secure-authjs.callback-url=https%3A%2F%2Fgestion-contratos.sistemasiimp.org.pe; Path=/; HttpOnly; Secure; SameSite=Lax
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
Content-Security-Policy: base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: camera=(), geolocation=(), microphone=()
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-Cache: Error from cloudfront
Via: 1.1 08a337d4c41835bb1a388ee0311fd0aa.cloudfront.net (CloudFront)
X-Amz-Cf-Pop: LIM50-P4
X-Amz-Cf-Id: Wsppn9Sme9rye8QvQnkZLbtph43yFleYj_xaJXQ6mRulA4wJBl50HQ==
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains

{"error":"No autorizado."}
```

## 5. QA — `POST` con `{}` (JSON válido, sin campos)

```bash
curl -i -X POST https://qa-gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contracts \
  -H "Content-Type: application/json" -d '{}'
```

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json
Transfer-Encoding: chunked
Connection: keep-alive
Date: Tue, 22 Sep 2026 14:38:20 GMT
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
cache-control: no-store
Content-Security-Policy: base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: camera=(), geolocation=(), microphone=()
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
set-cookie: __Host-authjs.csrf-token=...; Path=/; HttpOnly; Secure; SameSite=Lax
set-cookie: __Secure-authjs.callback-url=https%3A%2F%2Fqa-gestion-contratos.sistemasiimp.org.pe; Path=/; HttpOnly; Secure; SameSite=Lax
X-Cache: Error from cloudfront
Via: 1.1 15167ef85a9fc2764e4d5ca36adfffde.cloudfront.net (CloudFront)
X-Amz-Cf-Pop: MIA3-P8
X-Amz-Cf-Id: GN7NKH27_G-fy2dO0V0BkTiYCq6AQf0twLwj_7tVVccb214VVuS05g==
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains

{"error":"No autorizado."}
```

---

## Resumen

| Prueba | Ambiente | Resultado |
|---|---|---|
| GET con `Bearer` | QA | 401 `{"error":"No autorizado."}` |
| POST con `Bearer` + JSON | QA | 401 |
| GET sin auth | QA | 401 |
| GET con `Bearer` | Producción | 401 |
| POST `{}` | QA | 401 |

En todos los casos la respuesta llega por CloudFront (`X-Cache: Error from cloudfront`), pero con
headers de Next.js/Auth.js, lo que indica que **la aplicación procesa el request y su handler
responde 401** — es decir, **la credencial no es aceptada por el handler de integración**
(clave no activa/validada, o esquema de auth distinto al documentado).

**Lo que necesitamos del equipo del SGC:** que ejecuten el mismo `curl` desde su lado y compartan
la salida; si a ellos les da `200/201`, revisar que CloudFront reenvíe `Authorization` al origen;
si también les da `401`, activar/validar la clave `ECOMMERCE_IIMP_CONEX` con rol
`contract-manager`. Ver `docs/05-integraciones/pedido-al-sgc.md`.
