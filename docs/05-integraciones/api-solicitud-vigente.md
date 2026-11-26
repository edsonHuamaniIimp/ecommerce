# API de consulta de la solicitud vigente — ContratosStands (IIMP)

> **Para:** equipo del SIE (sistema de facturación / servicio-eventos).
> **Qué es:** un servicio de **solo lectura** que devuelve los datos **vigentes** de una solicitud
> de reserva **con los mismos campos, nombres y reglas del body de `POST /stands/reserva`**.
> **Para qué:** que el SIE **actualice su cuenta corriente** (y la vuelva a enviar a SAP) cuando un dato
> cambió en ContratosStands después de reservar, **sin que ContratosStands regenere ni reenvíe la reserva**.

## 1. Contexto

ContratosStands envía la reserva con `POST /stands/reserva` y el SIE la guarda tal como llegó. Si luego un
dato se corrige en ContratosStands (por ejemplo, el cliente facturado de una boleta pasa de la persona
representante a la **empresa**), el SIE conservaría el dato viejo. Con este API el SIE consulta el dato
**actual**. **Toda corrección se hace en ContratosStands; el SIE solo lee.**

## 2. Ambientes y autenticación

| Ambiente | URL base |
|---|---|
| Producción | `https://ecommerce.sistemasiimp.org.pe` |
| QA | `https://qa-ecommerce.sistemasiimp.org.pe` |

Autenticación: header **`x-api-key`** con la clave compartida (`INTEGRACION_API_KEY`), **la misma** del
`POST /api/integracion/factura` que el SIE ya usa. Hay una clave por ambiente. Sin clave o con clave inválida:
`401` y no se devuelve ningún dato. La clave se entrega por un canal seguro.

## 3. Endpoint

```
GET /api/integracion/solicitud?numeroSolicitud=<NumeroSolicitud>
GET /api/integracion/solicitud?contrato=<Contrato>
```

| Parámetro | Descripción |
|---|---|
| `numeroSolicitud` | El mismo `NumeroSolicitud` que ContratosStands envió en la reserva (`CTRS-` + 25 caracteres). |
| `contrato` | Alternativa: el contrato del SIE (10 dígitos, p. ej. `0000000045`). Se usa solo si no se envía `numeroSolicitud`. |

Es **solo lectura**: no envía, no modifica ni crea nada, y se puede llamar las veces que haga falta.

```bash
curl -s "https://ecommerce.sistemasiimp.org.pe/api/integracion/solicitud?contrato=0000000045" \
  -H "x-api-key: $CLAVE_COMPARTIDA"
```

## 4. Respuesta `200`

El sobre es `{ "success": true, "data": { ... } }`. `data` es el body de la reserva en **PascalCase** más
`Version`. Ejemplo ilustrativo (datos ficticios):

```json
{
  "success": true,
  "data": {
    "Version": "3f9a1c5d7e2b4a60",
    "NumeroSolicitud": "CTRS-0123456789abcdef01234567",
    "TipEvCod": 2,
    "EvenCod": 19,
    "Stands": ["184", "185"],
    "TipoFacturacion": "03",
    "TipDocFacturacion": "0",
    "NumDocFacturacion": "DE123456789",
    "RazonSocial": "EMPRESA EJEMPLO GMBH",
    "DirFacturacion": "CALLE EJEMPLO 1, CIUDAD",
    "Pais": 5,
    "Web": "www.ejemplo.com",
    "Telefono": "+49 000 000000",
    "Friso": "EMPRESA EJEMPLO",
    "Moneda": "USD",
    "TipoCambio": "3.4960",
    "Contactos": {
      "Contrato": { "Nombre": "Nombre Apellido", "Cargo": "Representante legal", "Email": "contrato@ejemplo.com", "Telefono": "+49 000 000001" },
      "Pagos": { "Nombre": "Nombre Apellido", "Email": "pagos@ejemplo.com", "Telefono": "+49 000 000001" }
    },
    "Comercial": {
      "TipoDescuento": "NINGUNO",
      "SumaLista": "18480.00",
      "DescuentoTotal": "0.00",
      "BaseImponible": "18480.00",
      "TasaIgv": "18.00",
      "Igv": "3326.40",
      "Total": "21806.40"
    },
    "StandsDetalle": [
      { "Numero": "184", "PrecioLista": "9240.00", "DescuentoPorcentaje": "0.00", "DescuentoMonto": "0.00", "PrecioNeto": "9240.00" },
      { "Numero": "185", "PrecioLista": "9240.00", "DescuentoPorcentaje": "0.00", "DescuentoMonto": "0.00", "PrecioNeto": "9240.00" }
    ],
    "Cuotas": [
      { "Porcentaje": 20, "Fecha": "2026-12-25", "BaseImponible": "3696.00", "Igv": "665.28", "Monto": "4361.28" },
      { "Porcentaje": 80, "Fecha": "2027-06-15", "BaseImponible": "14784.00", "Igv": "2661.12", "Monto": "17445.12" }
    ],
    "Modalidad": "cuotas"
  }
}
```

### Campos

Son los de la reserva (guía *API de reserva de stands*). Lo que **cambia o se precisa** en esta consulta:

| Campo | Precisión |
|---|---|
| `Version` | Huella de 16 caracteres del body completo. **Cambia solo si cambia algo.** Es el único campo adicional a la reserva. |
| `NumeroSolicitud` | El mismo que ContratosStands envió al reservar. |
| `Stands` | **Todos** los stands vigentes de la solicitud, con el `Numero` de `liststand`. |
| `TipoFacturacion` / `TipDocFacturacion` | `01` factura (solo con RUC `6`) · `03` boleta a persona (`1`, `4`, `7`) o a **empresa extranjera (`0`)**. |
| `RazonSocial` | Empresa facturada, también en la boleta a empresa extranjera. En boleta a persona natural vienen `ApellidoPaternoFact`, `ApellidoMaternoFact` y `NombresFact`. |
| `Pais` | **Número** del catálogo de ubigeo (`GET /ubigeo/paises`; Alemania = `5`, Irlanda = `134`), no las siglas. Solo empresa extranjera. |
| `TipoCambio` | Tipo de cambio **real** (soles por dólar), también cuando `Moneda` es `USD`: en USD es el del **evento** (nunca `1`). Si el evento no lo tiene configurado, la consulta responde `400`. |
| `Comercial`, `StandsDetalle`, importes de cada cuota, `Modalidad` | **Siempre**, también sin descuento y en USD. |
| `Contactos.Pagos` | `Nombre` y `Email` (correo de facturación de la empresa, o el del responsable de pagos si lo tiene). |
| `Contactos.Contrato` | El contacto de contrato de la solicitud, como en la reserva. |
| `Archivos`, `Requisitos`, `Origen` | **No se envían** en esta consulta (los archivos siguen por `/stands/archivos`). |

> **Datos personales:** el body es el mismo de la reserva. En una empresa extranjera el contacto va **sin
> documento**. En una empresa con RUC, el contacto de contrato puede traer el documento de su representante,
> igual que en la reserva. Este API no agrega ningún dato personal que no se haya enviado ya al SIE.

### Reglas de facturación vigentes

- **Factura (`01`) solo a una empresa con RUC (`6`).**
- **Una empresa extranjera recibe boleta (`03`) a nombre de la empresa**: `TipDocFacturacion` `0`, su razón social
  y su país. **Nunca a nombre del representante legal.**

### Sumas (las mismas que valida el SIE)

Tolerancia 0.02: `BaseImponible + Igv = Total`; `SumaLista − DescuentoTotal = BaseImponible`; por cuota
`BaseImponible + Igv = Monto`; la suma de las bases y de los montos de las cuotas es `Comercial.BaseImponible` y
`Comercial.Total`; por stand `PrecioLista − DescuentoMonto = PrecioNeto`; porcentajes enteros que suman 100.
ContratosStands las valida **antes de responder**: si algo no cuadra, responde `400` con el motivo y no devuelve datos.

## 5. Errores

Formato: `{ "success": false, "error": { "code": "...", "message": "..." } }`.

| HTTP | Causa |
|---|---|
| `400` | No se envió `numeroSolicitud` ni `contrato`, o la solicitud no se puede armar (sin datos de facturación, plan incompleto, evento sin tipo de cambio en USD, sumas que no cuadran). El `message` lo explica. |
| `401` | Clave `x-api-key` ausente o inválida. |
| `404` | Solicitud no encontrada. |

## 6. Uso sugerido

1. Cuando el SIE necesite refrescar una cuenta corriente, consulta la solicitud por `contrato` o `numeroSolicitud`.
2. Compara `Version` con la última que aplicó; si coincide, no hay nada que hacer.
3. Si cambió, actualiza la cuenta corriente con el body recibido y vuelve a enviarla a SAP. Los comprobantes ya
   emitidos y el tratamiento de las cuotas ya facturadas son decisión del SIE.
4. Cualquier corrección se hace en ContratosStands y el SIE la lee en la siguiente consulta.

## 7. Notas

- `NumeroSolicitud` es la llave de idempotencia de `POST /stands/reserva`. Un contrato **anulado** en el SIE
  sigue ocupando ese número y el reenvío responde `409` hasta que el SIE **libere o borre la reserva**.
  Este API evita tener que anular y reenviar solo para corregir datos del cliente.
- Documentación técnica (OpenAPI): `docs/04-api/openapi.yaml`, operación `GET /integracion/solicitud`.
- Integración de la reserva: `docs/05-integraciones/integracion-reserva-iimp.md`.
