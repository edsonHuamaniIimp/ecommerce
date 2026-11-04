# Integración de notificación de factura — Diagnóstico del HTTP 401

**Fecha:** 2026-11-03  
**Endpoint:** `POST https://ecommerce.sistemasiimp.org.pe/api/integracion/factura`  
**Sistema consumidor:** SIE (Sistema de Integración de Existencias / facturación)  
**Sistema receptor:** Contratos Stands (IIMP)  
**Estado:** RESUELTO el 2026-11-03. La clave de producción se alineó con la que ya usa SIE.

---

## 1. Resumen

La petición **sí llega** al endpoint de Contratos Stands. El `401 UNAUTHORIZED` no era por ruta inexistente ni por firewall: **la clave configurada en producción no coincidía** con la clave que SIE tiene para producción. El 2026-11-03 se alineó el secreto de producción a la clave de SIE.

La respuesta observada:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "No autorizado"
  }
}
```

Este mensaje lo genera nuestra aplicación, no el balanceador ni CloudFront.

---

## 2. Causa exacta

El endpoint valida la cabecera así:

```ts
const clave = process.env.INTEGRACION_API_KEY;
const enviada = request.headers.get("x-api-key");
return enviada === clave;
```

En producción, `INTEGRACION_API_KEY` se inyecta desde AWS Secrets Manager (`iimp-ctrst-prod-integracion-api-key`). Producción tenía otro valor; el 2026-11-03 se actualizó para que coincida con la clave de producción que SIE ya utiliza.

> La clave no se incluye en este documento. SIE debe seguir usando la misma clave de producción que ya tiene configurada.
> En QA la clave es distinta: no reutilizar la de producción.

---

## 3. Qué debe hacer SIE

No requiere cambios en su configuración: siga usando su misma clave de producción y reintente la petición.

1. Enviar su **clave de producción de SIE** (la misma que ya tiene configurada) en la cabecera `x-api-key`.
2. Enviar la cabecera exactamente así:

```http
POST /api/integracion/factura HTTP/1.1
Host: ecommerce.sistemasiimp.org.pe
Content-Type: application/json
x-api-key: <CLAVE_DE_PRODUCCION>
```

3. No usar `Authorization: Bearer`, no agregar espacios ni saltos de línea a la clave.
4. Reintentar la misma petición.

Ejemplo con `curl`:

```bash
curl -i -X POST "https://ecommerce.sistemasiimp.org.pe/api/integracion/factura" \
  -H "Content-Type: application/json" \
  -H "x-api-key: <CLAVE_DE_PRODUCCION>" \
  -d '{
    "numeroSolicitud": "CTRS-3ea625036fc2483895bff51a2",
    "cuota": 1,
    "documento": "20107972090-01-F003-5477.pdf",
    "estadoPago": 1,
    "fechaEmision": "2026-11-03"
  }'
```

Resultado esperado: **HTTP 200** con `success: true`.

---

## 4. Aclaración sobre pruebas locales

En desarrollo (`NODE_ENV !== "production"`) la validación de la clave está deshabilitada. Por eso una prueba contra `localhost` puede funcionar sin clave, pero en producción siempre se exige y se compara de forma exacta. Esto no indica que la clave de producción sea la misma.

---

## 5. Efecto de la petición una vez autenticada

Con la clave correcta, la petición:

- Actualiza la **cuota 1** de la solicitud `CTRS-3ea625036fc2483895bff51a2` (PDB TOOLS INC., SUCURSAL DEL PERU).
- Registra el documento `20107972090-01-F003-5477.pdf`.
- Marca `estadoPago: 1`.

Validar con el área de Facturación que ese efecto es el esperado antes de reintentar.

---

## 6. Checklist de diagnóstico

| Síntoma | Causa probable |
| --- | --- |
| `401` con mensaje `No autorizado` | `x-api-key` ausente o distinta de `INTEGRACION_API_KEY` |
| `400` con `JSON invalido` | El cuerpo no es un objeto JSON válido |
| `404` | `numeroSolicitud`/`contrato` inexistente o cuota no encontrada |
| `409` | La cuota ya tiene documento o estado incompatible |
| `422` | Datos del body fuera de rango o inconsistentes |

---

## 7. Recomendación de seguridad

La clave que se compartió por correo/chat debe rotarse después de estabilizar la integración. La clave vigente no debe quedar en documentación, repositorios ni tickets.

Para coordinar la rotación: actualizar el secreto en AWS Secrets Manager y la variable `INTEGRACION_API_KEY` del servicio, y luego comunicar el nuevo valor a SIE por canal seguro.
