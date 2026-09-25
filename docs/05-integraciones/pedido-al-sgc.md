# Pedido al equipo del SGC — guía v2 (bloqueo de tipo/ruta)

**Para:** equipo del SGC (autor de `APIS_USE_HOOKS.md`).
**De:** equipo de ContratosStands (sistema de separación de stands / e-commerce).
**Fecha:** 25 set. 2026.
**Estado:** con la **guía v2** quedaron resueltos URL, auth (`Bearer sgc_<clave>`) y el flujo.
Queda **1 bloqueo** del lado del SGC (tipos con ruta propia).

---

## Contexto: qué ya validamos con la guía v2 (QA)

La integración está **desplegada contra QA** y probada. Lo que sí funciona:

- `GET /contract-types` (áreas + tipos + ruta vigente) ✅
- `GET /templates` y `GET /templates/{code}` ✅
- `GET /templates/{code}/files/{fileId}/download` (URL de 60 s) ✅
- `POST /contracts` con tipos de **ruta por defecto** (`route.source = "default"`): `201` con
  `contractTypeCode`, **`route`** (`frozen`, `steps[]`, `requiredRole`) y `routeError` ✅
- Subida de contrato/anexos en 3 fases (`reservar → transferir → confirmar`) con checksum SHA-256 ✅
- `POST /contracts/{contractId}/resend` (reabre tras subsanar; `422` correcto si no hay versión nueva) ✅
- Webhook HMAC (`x-sgc-signature`) procesando `workflow.advanced` ✅

---

## Bloqueo: los tipos con **ruta propia** no permiten crear (`422`)

`POST /api/integrations/v1/contracts` devuelve
**`422 {"error":"No se pudo crear el expediente."}`** cuando el `contractTypeCode` es un tipo con
**ruta propia** (`route.source = "type"`). Con los de **ruta por defecto** (`source = "default"`) crea
sin problema. El mismo cuerpo/headers/`areaCode`; **solo cambia el tipo**.

| `contractTypeCode` | `route.source` | `POST /contracts` |
|---|---|---|
| `AUSPICIO`, `SERVICIOS`, `PROVEEDOR`, `ARRENDAMIENTO` | `default` | ✅ `201` |
| **`PRUEBA_IIMP_1`** | **`type`** (`PRUEBA-IIMP-1-FLUJO`) | ❌ **`422`** |
| **`PRUEBA_IIMP_2`** | **`type`** (`PRUEBA-IIMP-2-FLUJO`) | ❌ **`422`** |

Probamos con `areaCode = COMUNICACIONES` **y** `EVENTOS`: da igual; los de ruta propia **siempre**
fallan. Conclusión: el problema está en la **resolución de la ruta personalizada** al crear, no en
el request.

### Reproducción

```bash
curl -i -X POST https://qa-gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contracts \
  -H "Authorization: Bearer sgc_<clave>" \
  -H "Idempotency-Key: stands/reserva/repro-1" \
  -H "Content-Type: application/json" \
  -d '{"code":"STAND-REPRO-1","areaCode":"COMUNICACIONES","contractTypeCode":"PRUEBA_IIMP_1",
       "name":"x","counterpartyLegalName":"X SAC","counterpartyTaxIdentifier":"20123456789",
       "processOrigin":"ContratosStands"}'
# PRUEBA_IIMP_1 -> 422 {"error":"No se pudo crear el expediente."}
# SERVICIOS     -> 201 { "contractId": "...", "route": { "source": "default", "frozen": true, ... } }
```

### Impacto

El repositorio de templates **`STANDS_PERUMIN`** está ligado a **`PRUEBA_IIMP_1`**. Como la guía
recomienda enviar el `contractType.code` del repositorio, nuestro flujo de "separación de stands"
**no puede crear el expediente** hoy.

---

## Segundo punto: el `422` no trae el detalle que promete la guía

La **§3.3** de la guía indica que el `422` ocurre por "Tipo o área inexistente/inactiva
(**el mensaje lista los códigos válidos**)". Hoy el `422` es **genérico**
(`"No se pudo crear el expediente."`), sin motivo ni códigos válidos. Pedimos que incluya el
detalle para poder diagnosticar sin adivinar.

---

## Qué necesitamos (cualquiera de las dos primeras)

1. **Corregir la configuración de la RUTA** de `PRUEBA_IIMP_1` y `PRUEBA_IIMP_2` (la creación falla
   al resolverla), **o**
2. **Crear el tipo oficial `ALQUILER_STANDS`** con una ruta **válida** y **apuntar el template
   `STANDS_PERUMIN` a ese tipo** (hoy la guía nombra `ALQUILER_STANDS`, pero en QA no existe: el
   catálogo real es `PROVEEDOR, ARRENDAMIENTO, SERVICIOS, AUSPICIO, PRUEBA_IIMP_1, PRUEBA_IIMP_2`).
3. Que el **`422` traiga el motivo / códigos válidos** (según §3.3).

---

## Mientras tanto

Seguimos con `areaCode = COMUNICACIONES` + `contractTypeCode = AUSPICIO` (verificado `201`), para no
bloquear las pruebas. En cuanto `ALQUILER_STANDS` (o la ruta de `PRUEBA_IIMP_1`) funcione, cambiamos
solo la variable `SGC_CONTRACT_TYPE_CODE` (sin recompilar).

---

## Recordatorio (webhooks)

El único flujo **sin** Bearer es el **webhook**, y es al revés: lo envía el SGC hacia nosotros,
firmado con HMAC (`x-sgc-signature`). Pendiente: registrar como host autorizado
`POST https://ecommerce.sistemasiimp.org.pe/api/integracion/sgc/webhook` y enviarnos el secreto HMAC.
