# Pedido al equipo del SGC — guía v3 (bloqueo por `fields` del tipo)

**Para:** equipo del SGC (autor de `APIS_USE_HOOKS.md`).
**De:** equipo de ContratosStands (sistema de separación de stands / e-commerce).
**Fecha:** 25 set. 2026.
**Estado:** con la guía (v2 + v3) quedaron resueltos URL, auth (`Bearer sgc_<clave>`) y el flujo.
Queda **1 bloqueo**: los **campos propios del tipo** (`fields`, §3.2) **no están desplegados en QA**.

---

## Contexto: qué ya validamos (QA)

La integración está desplegada contra QA y probada. Funciona:

- `GET /contract-types`, `GET /templates`, `GET /templates/{code}` y descarga (URL de 60 s) ✅
- `POST /contracts` con tipos **sin campos propios** y ruta por defecto
  (`AUSPICIO`, `SERVICIOS`, `PROVEEDOR`, `ARRENDAMIENTO`): `201` con `contractTypeCode`, `route`
  (`frozen`, `steps[]`) y `routeError` ✅
- Subida de contrato/anexos en 3 fases con checksum SHA-256; 25 MB y formatos ✅
- `POST /contracts/{contractId}/resend` (reabre tras subsanar) ✅
- Webhook HMAC (`x-sgc-signature`) procesando `workflow.advanced` ✅

---

## Bloqueo: la creación falla con `PRUEBA_IIMP_1` (`422`) y `fields` no está desplegado

`POST /api/integrations/v1/contracts` con `contractTypeCode = PRUEBA_IIMP_1` responde
**`422 {"error":"No se pudo crear el expediente."}`**.

La **guía §3.4** dice que, si el tipo tiene **campos propios obligatorios** y no se envían en
`fields`, la respuesta es `422` con el nombre del campo faltante — y que eso es **independiente de si
el tipo tiene ruta propia o usa la predeterminada**. Es decir: la causa más probable es que
`PRUEBA_IIMP_1` exige campos propios (`input_demo`, p. ej.) que no podemos enviar todavía.

**Problema:** la funcionalidad de `fields` **no está desplegada en QA**:
- `GET /contract-types` **no devuelve** el arreglo `fields` de cada tipo (viene vacío/ausente).
- `POST /contracts` **rechaza** el objeto: `400 {"error":"Campos no admitidos: fields."}`.

Es decir, la guía v3 describe `fields`, pero la API de QA corre una versión anterior que aún no lo
acepta.

### Reproducción

```bash
# 1) El catalogo NO trae los campos propios del tipo
curl -s -H "Authorization: Bearer sgc_<clave>" \
  https://qa-gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contract-types
# -> items[].fields  (ausente/vacio)

# 2) Crear con fields -> 400 (aun no soportado)
curl -i -X POST https://qa-gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contracts \
  -H "Authorization: Bearer sgc_<clave>" -H "Idempotency-Key: stands/reserva/repro-1" \
  -H "Content-Type: application/json" \
  -d '{"code":"STAND-REPRO-1","areaCode":"COMUNICACIONES","contractTypeCode":"PRUEBA_IIMP_1",
       "name":"x","counterpartyLegalName":"X SAC","counterpartyTaxIdentifier":"20123456789",
       "processOrigin":"ContratosStands","fields":{"input_demo":"Stand esquina 3x3"}}'
# -> 400 {"error":"Campos no admitidos: fields."}

# 3) Sin fields -> 422 generico
# -> 422 {"error":"No se pudo crear el expediente."}
```

### Impacto

El repositorio de templates **`STANDS_PERUMIN`** está ligado a **`PRUEBA_IIMP_1`**. Como la guía
recomienda crear con el `contractType.code` del repositorio, nuestro flujo de "separación de stands"
**no puede crear el expediente** hasta que `fields` esté disponible.

---

## Qué necesitamos

1. **Desplegar en QA la funcionalidad de `fields`** (§3.2): que `GET /contract-types` devuelva
   `fields` (con `key`, `label`, `kind`, `required`, `options`, `apiSupported`) y que `POST
   /contracts` acepte el objeto `fields`.
2. **Confirmar los campos obligatorios** del tipo que usará "separación de stands"
   (`PRUEBA_IIMP_1` hoy; `ALQUILER_STANDS` cuando exista) y **un valor de ejemplo** para cada uno
   (p. ej. `input_demo` = "Descripción del stand").
3. Que el **`422` traiga el motivo** (nombre del campo faltante / códigos válidos), como indica la
   §3.3/§3.4 — hoy es genérico (`"No se pudo crear el expediente."`).

---

## Mientras tanto

Seguimos con `areaCode = COMUNICACIONES` + `contractTypeCode = AUSPICIO` (verificado `201`), para no
bloquear las pruebas. Nuestro DTO ya soporta `fields`; en cuanto QA lo despliegue y nos confirmen los
campos, los enviamos (solo cambia configuración, sin recompilar).

---

## Recordatorio (webhooks)

El único flujo **sin** Bearer es el **webhook**, y es al revés: lo envía el SGC hacia nosotros,
firmado con HMAC (`x-sgc-signature`). Pendiente: registrar como host autorizado
`POST https://ecommerce.sistemasiimp.org.pe/api/integracion/sgc/webhook` y enviarnos el secreto HMAC.
