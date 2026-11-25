# Incidente en Producción — `POST /stands/reserva` responde 500 `ERROR_INTERNO`

> Para: desarrollo del SIE (IIMP). De: ContratosStands. Fecha: 25-11-2026.
> Ambiente afectado: **Producción** (`https://secure2.iimp.org:8443/servicio-eventos/api`).
> Impacto: los clientes **no pueden solicitar factura** desde `/dashboard/mis-pagos` (mensaje "Error del API de reserva del IIMP (código)").

## 1. Resumen

Desde la noche del 24-11-2026 (hora Lima) las llamadas a `POST /stands/reserva` en Producción responden **500 `ERROR_INTERNO`**
con un `identificador`. Hasta el 24-11 a las 12:02 (hora Lima) las reservas se registraban sin problema (3 a 4 por día).
Del lado de ContratosStands **no cambió el formato del request** (los campos nuevos de la propuesta del 24-11 están
desactivados en Producción), por eso pedimos revisar del lado del SIE qué ocurrió en esas llamadas.

## 2. Códigos de error (`identificador`) para buscar en los logs del SIE

| # | Fecha y hora (Lima) | UTC | `identificador` | Solicitud |
|---|---|---|---|---|
| 1 | 24-11-2026 21:40:28 | 25-11 02:40:28 | `04432cbd` | probablemente MOLY-COP (ver §3) |
| 2 | 24-11-2026 21:40:48 | 25-11 02:40:48 | `4432c389` | probablemente MOLY-COP (ver §3) |
| 3 | 25-11-2026 08:34:09 | 25-11 13:34:09 | `5d71cefe` | ICC PERU S.A.C. |
| 4 | 25-11-2026 08:35:04 | 25-11 13:35:04 | `ab14ba32` | ICC PERU S.A.C. |
| 5 | 25-11-2026 08:35:12 | 25-11 13:35:12 | `1ec627b0` | ICC PERU S.A.C. |

Los reintentos del usuario generan un identificador nuevo cada vez. Nuestro registro no guarda el cuerpo de la respuesta
del SIE, solo el `identificador`; el motivo del 500 solo se ve en los logs del SIE.

## 3. Solicitudes afectadas

| | **ICC PERU S.A.C.** (captura del usuario) | **MOLY-COP ADESUR S.A.** |
|---|---|---|
| `NumeroSolicitud` | `CTRS-a6dbab5db6c6424594b21228d` | `CTRS-689d7ecc807c43cbb6f404a15` |
| Documento | RUC 20269764211 (factura) | RUC 20100192064 (factura) |
| Stands | `E-13` (1 stand) | `E-79`, `E-80`, `E-81`, `E-82` (4 stands) |
| Moneda | USD (TC 1) | USD (TC 1) |
| Cuotas | 3: 40 / 30 / 30 % — 2026-11-15, 2027-02-15, 2027-06-15 | 1: 100 % — 2026-11-13 |
| Total con IGV | USD 17,534.80 | USD 137,352.00 |
| Estado en el SIE | sin contrato (nunca se registró) | sin contrato (nunca se registró) |

Ninguna de las dos quedó registrada: no hay contrato ni cuenta corriente en nuestro lado.

## 4. Qué envía la web (formato v6 vigente, sin campos nuevos)

```json
{
  "NumeroSolicitud": "CTRS-a6dbab5db6c6424594b21228d",
  "TipEvCod": 2,
  "EvenCod": 19,
  "Moneda": "USD",
  "Stands": ["E-13"],
  "TipoFacturacion": "01",
  "TipDocFacturacion": "6",
  "NumDocFacturacion": "20269764211",
  "RazonSocial": "ICC PERU S.A.C.",
  "DirFacturacion": "…",
  "Contactos": { "Contrato": { "…": "…" }, "Pagos": { "…": "…" } },
  "Cuotas": [
    { "Porcentaje": 40, "Fecha": "2026-11-15", "TextoLibre": "L-07-SV26-000249 - CUOTA 1" },
    { "Porcentaje": 30, "Fecha": "2027-02-15" },
    { "Porcentaje": 30, "Fecha": "2027-06-15" }
  ],
  "Archivos": [ { "Tipo": "OC", "Cuota": 1, "Link": "https://ecommerce.sistemasiimp.org.pe/uploads/…pdf", "Nombre": "L-07-SV26-000249 INSTITUTO DE INGENIEROS DE MINA.pdf" } ]
}
```

(Reconstruido a partir de los datos guardados y de la pantalla del usuario; `Moneda` se envía desde el 09-11-2026 y no se envía `TipoCambio`.
La solicitud de MOLY-COP tiene la misma forma, con 4 stands y una sola cuota, y sin `TextoLibre` ni `Archivos`.)

## 5. Qué descartamos de nuestro lado

- **No es el formato:** las reservas que sí se registraron el 23 y el 24-11 tienen el mismo formato (`Moneda: "USD"`, sin `TipoCambio`,
  sin los campos nuevos de la propuesta).
- **No es el tipo de stand:** hay 17 reservas registradas antes con stands de código `E-xx` (E-04 … E-85) y 74 con stands numéricos.
- **No es la fecha de la primera cuota:** las reservas exitosas del 24-11 también tenían la primera cuota con fecha ya vencida (2026-11-15).
- **No es un reintento duplicado:** el SIE no registró nada (500), no hay `iimp_contrato` guardado.
- **Última reserva exitosa:** 24-11-2026 12:02 (hora Lima) — 2 stands numéricos, 3 cuotas, USD.

## 6. Qué necesitamos del SIE

1. El **motivo del 500** de los 5 `identificador` de §2 (stack, mensaje o validación que falla).
2. Confirmar si **el despliegue de los cambios del 24-11** (`TipoCambio`, `Moneda`, `Comercial`, `StandsDetalle`) llegó a **Producción**, o si Pruebas y
   Producción comparten código, base de datos o configuración.
3. Si falla por falta de tipo de cambio: la web envía `Moneda: "USD"` **sin** `TipoCambio` (el SIE dijo que en USD usa el del día). ¿Hay tipo de cambio
   del día cargado en Producción para hoy?
4. Cuándo estará corregido: hay clientes con la fecha de la cuota 1 ya vencida o por vencer esperando solicitar su factura.

## 7. Cómo reproducir (sin crear reservas)

No recomendamos reproducirlo con una reserva real en Producción. Con el `identificador` el SIE puede ubicar la llamada en sus logs;
si necesitan el cuerpo exacto de alguna de las 5 llamadas, ContratosStands lo reconstruye con los datos de §3 y §4.
