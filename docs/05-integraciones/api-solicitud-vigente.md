# API de consulta de la solicitud vigente — ContratosStands (IIMP)

> Guía para el **sistema de facturación / servicio-eventos (SIE)**.
> Servicio de **solo lectura**: devuelve los datos **vigentes** de una solicitud (cliente facturado,
> comprobante, montos, stands y cuotas) para que el SIE **actualice su propio registro**.
> ContratosStands **no regenera ni reenvía** la reserva: lo que el SIE leyó al crearla puede haber
> cambiado (por ejemplo, el cliente facturado se corrigió de persona a empresa) y aquí consulta lo actual.

## 1. Endpoint

```
GET /api/integracion/solicitud?numeroSolicitud=CTRS-672ea54ec291423d96271bd5a
GET /api/integracion/solicitud?contrato=0000000045
x-api-key: <clave compartida>
```

- Mismo `NumeroSolicitud` que ContratosStands envió en `POST /stands/reserva`, o el `contrato` del SIE.
- Autenticación: header `x-api-key` con la clave compartida (`INTEGRACION_API_KEY`, la misma de
  `POST /api/integracion/factura`). Sin clave o con clave inválida: `401`.
- **Solo lee**: no envía, no modifica y no crea nada. Se puede consultar las veces que haga falta.

## 2. Respuesta `200`

```json
{
  "success": true,
  "data": {
    "numeroSolicitud": "CTRS-672ea54ec291423d96271bd5a",
    "contrato": "0000000045",
    "cuentaCorriente": "45",
    "version": "3f9a1c5d7e2b4a60",
    "facturacion": {
      "tipoComprobante": "03",
      "tipoDocumento": "0",
      "numeroDocumento": "84245291",
      "razonSocial": "Portwest UC",
      "nombres": null,
      "apellidoPaterno": null,
      "apellidoMaterno": null,
      "paisCodigo": 134,
      "direccion": "…",
      "telefono": "56 9 3382 0964",
      "web": "www.portwest.com",
      "friso": "Portwest UC",
      "correoFacturacion": "eduardo@portwest.com",
      "correoContrato": "eduardo@portwest.com",
      "correoPagos": "eduardo@portwest.com"
    },
    "comercial": { "moneda": "USD", "tipoCambio": 1, "modalidad": "cuotas", "netoLista": 18480, "descuentoMonto": 0, "netoDescontado": 18480, "igv": 3326.4, "total": 21806.4 },
    "stands": [ { "codigo": "184", "standCode": "184", "precioLista": 9240, "descuentoPorcentaje": null, "descuentoMonto": null, "neto": null } ],
    "cuotas": [ { "numero": 1, "porcentaje": 20, "vencimiento": "2026-12-25", "monto": 4361.28 } ]
  }
}
```

| Campo | Significado |
|---|---|
| `version` | Huella de 16 caracteres de facturación + montos + stands + cuotas. **Cambia solo si cambia algo**: si coincide con la última que el SIE aplicó, no hay nada que actualizar. |
| `facturacion.tipoComprobante` | `01` factura (solo a RUC) · `03` boleta. |
| `facturacion.tipoDocumento` | `6` RUC · `0` empresa extranjera · `1` DNI · `4` CE · `7` pasaporte. |
| `facturacion.razonSocial` | Empresa facturada. `null` en boleta a persona natural (ahí vienen `nombres` y apellidos). |
| `facturacion.paisCodigo` | Solo empresa extranjera: **código numérico del catálogo de ubigeo** (`GET /ubigeo/paises` de servicio-persona; Alemania = 5, Irlanda = 134). |
| `facturacion.correoFacturacion` | Correo de facturación de la empresa (responsable de pagos, o el correo de facturación de la empresa). |

**Regla de facturación vigente:** una boleta a una empresa extranjera se emite **a la empresa**
(`tipoDocumento` `0`, razón social y país), nunca al representante legal. La respuesta **no incluye**
datos personales del representante legal (nombre, documento ni dirección).

## 3. Errores

| HTTP | Causa |
|---|---|
| 400 | No se envió `numeroSolicitud` ni `contrato`, o la solicitud no tiene datos de facturación válidos (el mensaje lo explica). |
| 401 | Clave `x-api-key` ausente o inválida. |
| 404 | Solicitud no encontrada. |

## 4. Uso sugerido

1. El SIE consulta la solicitud (por contrato o número) cuando necesite refrescar su registro.
2. Compara `version` con la última que aplicó; si cambió, actualiza cliente facturado, comprobante y contactos.
3. Cualquier corrección de datos se hace en ContratosStands; el SIE solo lee.

Documentación OpenAPI: `docs/04-api/openapi.yaml` (`GET /integracion/solicitud`).
