# API de consulta de la solicitud vigente — ContratosStands (IIMP)

> **Para:** equipo del SIE (sistema de facturación / servicio-eventos).
> **Qué es:** un servicio de **solo lectura** que devuelve los datos **vigentes** de una solicitud
> de reserva (cliente facturado, comprobante, montos, stands y cuotas).
> **Para qué:** que el SIE **actualice su propio registro** cuando un dato cambió en ContratosStands
> después de reservar, **sin que ContratosStands regenere ni reenvíe la reserva**.

## 1. Contexto

ContratosStands envía la reserva con `POST /stands/reserva` y el SIE la guarda tal como llegó. Si luego
un dato se corrige en ContratosStands (por ejemplo, el cliente facturado de una boleta pasa de la
persona representante a la **empresa**), el SIE conservaría el dato viejo. Con este API el SIE consulta
el dato **actual** y se actualiza. **Toda corrección se hace en ContratosStands; el SIE solo lee.**

## 2. Ambientes y autenticación

| Ambiente | URL base |
|---|---|
| Producción | `https://ecommerce.sistemasiimp.org.pe` |
| QA | `https://qa-ecommerce.sistemasiimp.org.pe` |

Autenticación: header **`x-api-key`** con la clave compartida (`INTEGRACION_API_KEY`), **la misma** del
`POST /api/integracion/factura` que el SIE ya usa. Sin clave o con clave inválida: `401` y no se devuelve
ningún dato. La clave se entrega por un canal seguro (no por correo en texto plano).

## 3. Endpoint

```
GET /api/integracion/solicitud?numeroSolicitud=<NumeroSolicitud>
GET /api/integracion/solicitud?contrato=<Contrato>
```

| Parámetro | Descripción |
|---|---|
| `numeroSolicitud` | El mismo `NumeroSolicitud` que ContratosStands envió en la reserva (`CTRS-` + 25 caracteres). |
| `contrato` | Alternativa: el contrato del SIE (10 dígitos, p. ej. `0000000045`). Se usa solo si no se envía `numeroSolicitud`. |

Reglas: es **solo lectura** (no envía, no modifica ni crea nada) y se puede llamar las veces que haga falta.

```bash
curl -s "https://ecommerce.sistemasiimp.org.pe/api/integracion/solicitud?contrato=0000000045" \
  -H "x-api-key: $CLAVE_COMPARTIDA"
```

## 4. Respuesta `200`

Ejemplo ilustrativo (datos ficticios):

```json
{
  "success": true,
  "data": {
    "numeroSolicitud": "CTRS-0123456789abcdef01234",
    "contrato": "0000000099",
    "cuentaCorriente": "99",
    "version": "3f9a1c5d7e2b4a60",
    "facturacion": {
      "tipoComprobante": "03",
      "tipoDocumento": "0",
      "numeroDocumento": "DE123456789",
      "razonSocial": "EMPRESA EJEMPLO GMBH",
      "nombres": null,
      "apellidoPaterno": null,
      "apellidoMaterno": null,
      "paisCodigo": 5,
      "direccion": "Calle Ejemplo 1, Ciudad",
      "telefono": "+49 000 000000",
      "web": "www.ejemplo.com",
      "friso": "Empresa Ejemplo",
      "correoFacturacion": "facturacion@ejemplo.com",
      "correoContrato": "facturacion@ejemplo.com",
      "correoPagos": "facturacion@ejemplo.com"
    },
    "comercial": {
      "moneda": "USD",
      "tipoCambio": 1,
      "modalidad": "cuotas",
      "netoLista": 18480,
      "descuentoMonto": 0,
      "netoDescontado": 18480,
      "igv": 3326.4,
      "total": 21806.4
    },
    "stands": [
      { "codigo": "184", "standCode": "184", "precioLista": 9240, "descuentoPorcentaje": null, "descuentoMonto": null, "neto": null }
    ],
    "cuotas": [
      { "numero": 1, "porcentaje": 20, "vencimiento": "2026-12-25", "monto": 4361.28 },
      { "numero": 2, "porcentaje": 80, "vencimiento": "2027-06-15", "monto": 17445.12 }
    ]
  }
}
```

### Campos

| Campo | Significado |
|---|---|
| `numeroSolicitud`, `contrato`, `cuentaCorriente` | Identificadores de la reserva. `contrato` y `cuentaCorriente` son `null` si aún no se registró en el SIE. |
| `version` | Huella de 16 caracteres de facturación + montos + stands + cuotas. **Cambia solo si cambia algo.** |
| `facturacion.tipoComprobante` | `01` factura (solo a RUC) · `03` boleta. |
| `facturacion.tipoDocumento` | `6` RUC · `0` empresa extranjera · `1` DNI · `4` CE · `7` pasaporte. |
| `facturacion.numeroDocumento` | Documento del cliente facturado, sin signos y en mayúsculas. |
| `facturacion.razonSocial` | Empresa facturada. `null` solo en boleta a persona natural. |
| `facturacion.nombres`, `apellidoPaterno`, `apellidoMaterno` | Solo boleta a persona natural; `null` en empresas. |
| `facturacion.paisCodigo` | Solo empresa extranjera: **código numérico del catálogo de ubigeo** (`GET /ubigeo/paises` de servicio-persona; Alemania = 5, Irlanda = 134). `null` en el resto. |
| `facturacion.correoFacturacion` | Correo de facturación: el del responsable de pagos de la empresa o, si no hay, el de facturación de la empresa. |
| `facturacion.correoContrato`, `correoPagos` | Correos de los contactos de contrato y de pagos (hoy coinciden con el de facturación). |
| `comercial` | Moneda, tipo de cambio, modalidad y totales del plan. `netoLista` es el precio de lista antes del descuento; `total` incluye IGV. |
| `stands[]` | Un elemento por stand: precio de lista y, si hay descuento por stand, `descuentoPorcentaje`, `descuentoMonto` y `neto`. |
| `cuotas[]` | `monto` es el total de la cuota con IGV, en la moneda de la solicitud; `vencimiento` en `AAAA-MM-DD`. |

### Reglas de facturación vigentes

- **Factura (`01`) solo a una empresa con RUC (`6`).**
- **Una empresa extranjera recibe boleta (`03`) a nombre de la empresa**: `tipoDocumento` `0`, su razón social
  y su país. **Nunca a nombre del representante legal.**
- La respuesta **no incluye datos personales del representante legal** (nombre, documento ni dirección).

## 5. Errores

Formato: `{ "success": false, "error": { "code": "...", "message": "..." } }`.

| HTTP | Causa |
|---|---|
| `400` | No se envió `numeroSolicitud` ni `contrato`, o la solicitud no tiene datos de facturación válidos (el `message` lo explica). |
| `401` | Clave `x-api-key` ausente o inválida. |
| `404` | Solicitud no encontrada. |

## 6. Uso sugerido

1. Cuando el SIE necesite refrescar una reserva (o de forma periódica), consulta la solicitud por `contrato`
   o `numeroSolicitud`.
2. Compara `version` con la última que aplicó. Si coincide, no hay nada que hacer.
3. Si cambió, actualiza en su registro el cliente facturado, el comprobante, los contactos y lo que corresponda.
   Los montos y las cuotas ya emitidas no deberían modificarse si existe un comprobante emitido; esa decisión
   es del SIE.
4. Si un dato debe corregirse, se corrige en ContratosStands y el SIE lo lee en la siguiente consulta.

## 7. Notas

- `NumeroSolicitud` es la llave de idempotencia de `POST /stands/reserva`. Un contrato **anulado** en el SIE
  sigue ocupando ese número y el reenvío responde `409` hasta que el SIE **libere o borre la reserva**.
  Este API evita tener que anular y reenviar solo para corregir datos del cliente.
- Documentación técnica (OpenAPI): `docs/04-api/openapi.yaml`, operación `GET /integracion/solicitud`.
- Integración de la reserva: `docs/05-integraciones/integracion-reserva-iimp.md`.
