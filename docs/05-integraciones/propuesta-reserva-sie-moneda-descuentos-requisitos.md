# Cambios solicitados al SIE en `POST /stands/reserva` — tipo de cambio pactado e información de solicitudes internas

> Para: desarrollo del SIE (IIMP). De: ContratosStands. Fecha: 24-11-2026.
> Ambiente de pruebas: SIE Pruebas (`/servicio-eventos-pruebas/api`).
> Contexto: [integracion-reserva-iimp.md](./integracion-reserva-iimp.md) (contrato actual),
> [acuerdo-integracion-facturacion.md](./acuerdo-integracion-facturacion.md) (acuerdo vigente) y
> [api-facturacion-entrante.md](./api-facturacion-entrante.md) (notificación SIE → web).

## 1. Qué se pide (resumen)

1. **Respetar el tipo de cambio pactado.** La web envía `TipoCambio` (y `Moneda`) en **toda** reserva. El SIE debe
   registrar y facturar el contrato con **ese** tipo de cambio en todas sus cuotas, no con el del día.
2. **Solicitudes internas** (`Origen.TipoSolicitud = "RESERVA_EMPRESA"`, pabellones internacionales): la web enviará
   **más información** (condiciones comerciales, descuentos por stand, importes por cuota, requisitos y origen). El SIE
   debe **almacenarla** y **usar los importes recibidos** (no recalcularlos con su lista).

Todos los campos nuevos son **opcionales**: una reserva sin ellos (formato v6 actual) sigue funcionando igual.

## 2. Por qué (dos casos reales de QA)

Hoy la web envía solo stands y el porcentaje/fecha de cada cuota; el SIE calcula los montos con su lista en USD y
convierte con **su tipo de cambio del día** (su doc de reserva responde `409` sin tipo de cambio del día y devuelve
`Documento.tipoCambio` al emitir). El [acuerdo](./acuerdo-integracion-facturacion.md) (§1) deja el cálculo de
montos/IGV **del lado de ContratosStands** ("lo hace ContratosStands con el plan del contrato").

| | **Caso A** — contrato en soles, TC 3.50 (contrato `0000000025`) | **Caso B** — USD con descuento por stand (contrato `0000000024`) |
|---|---|---|
| Web (pactado) | Moneda PEN · base S/ 84,420.00 · IGV 15,195.60 · **total S/ 99,615.60** | Moneda USD · lista 36,960.00 · descuento **−1,293.60** · base 35,666.40 · IGV 6,419.95 · **total USD 42,086.35** |
| SIE respondió | Moneda **USD** · base 24,120.00 · **total USD 28,461.60** | Moneda USD · base 36,960.00 (sin descuento) · IGV 6,652.80 · **total USD 43,612.80** |
| Diferencia | Registrada en dólares; la conversión a soles dependerá del TC del día de cada factura | USD 1,526.45 de más (no recibe los descuentos) |
| Cuotas web | 19,923.12 · 19,923.12 · 59,769.36 (20/20/60 %) | 16,834.54 · 8,417.27 · 16,834.54 (40/20/40 %) |
| Cuotas SIE | 5,692.32 · 5,692.32 · 17,076.96 (USD) | 17,445.12 · 8,722.56 · 17,445.12 |

## 3. Campos que enviará la web

Importes: **string decimal con punto y 2 decimales**, en la **moneda del contrato** (`Moneda`). `TipoCambio`: string con
4 decimales.

### 3.1 En toda reserva (regular e interna)

| Campo | Ejemplo | Descripción |
|---|---|---|
| `Moneda` | `"PEN"` | Ya se envía hoy (desde el 09-11-2026). Moneda de **todos** los importes. |
| `TipoCambio` | `"3.5000"` | **Nuevo.** Soles por dólar pactado con la empresa. `"1.0000"` si `Moneda = USD`. |

### 3.2 Solo solicitudes internas

| Campo | Ejemplo | Descripción |
|---|---|---|
| `Stands` | `["83","84"]` | **Sin cambios** (arreglo de códigos). |
| `StandsDetalle[]` | ver §4 | Precio pactado por stand. **Solo si hay descuento por stand**: `Numero`, `PrecioLista`, `DescuentoPorcentaje`, `DescuentoMonto`, `PrecioNeto`. |
| `Comercial` | ver §4 | `TipoDescuento` (`NINGUNO`\|`PORCENTAJE`\|`MONTO`\|`POR_STAND`), `SumaLista`, `DescuentoTotal`, `BaseImponible`, `TasaIgv` (`"18.00"`), `Igv`, `Total`. |
| `Modalidad` | `"personalizado"` | Modo de pago: `completo`, `cuotas`, `tres_cuotas` o `personalizado`. |
| `Cuotas[].BaseImponible`, `Cuotas[].Igv`, `Cuotas[].Monto` | `"14266.56"`, `"2567.98"`, `"16834.54"` | Importes de cada cuota (`Monto` = base + IGV). Se agregan a `Porcentaje`, `Fecha` y `TextoLibre`, que ya se envían. La suma de bases = `Comercial.BaseImponible` exactamente (la última cuota absorbe los centavos). |
| `Requisitos` | ver §4 | Declaración de requisitos de facturación: `Oc`, `Hes`, `Plataforma`, `PlataformaNombre`, `PlataformaUrl`, `Valorizacion`, `Otros`, `Ninguna`, `CuotaOrigen` (cuota desde la que se pidió). Los documentos siguen yendo en `Archivos`. Solo si el usuario los declaró. |
| `Origen` | ver §4 | `Sistema` (`"CONTRATOS_STANDS"`), `TipoSolicitud` (`"RESERVA_EMPRESA"`), `RegistradoPor` (correo del staff), `RegistradoEn` (ISO-8601 UTC), `ProgramadaPara` (ISO-8601 UTC si lo registró una tarea programada por Facturación; si no, `null`). |

### 3.3 Cómo se envía según el tipo de solicitud

| | Solicitud regular | Solicitud interna (`RESERVA_EMPRESA`) |
|---|---|---|
| Quién la dispara | El **cliente**, con "Solicitar factura" (habilitado 30 días antes de la cuota; la 1.ª siempre) | **Facturación** (staff): inmediato, o **automático a la fecha y hora programadas** (tarea que corre cada minuto, hora de Lima) |
| Llamada | `POST /stands/reserva` (**una sola vez**, con **todas** las cuotas del contrato) | Igual |
| `Moneda`, `TipoCambio` | Sí | Sí |
| `Comercial`, importes por cuota y `StandsDetalle` (todos los stands) | Solo si el contrato es en **PEN** (el SIE exige los importes); en USD **no** (formato actual) | **Sí** |
| `Modalidad`, `Requisitos`, `Origen` | **No** | **Sí** |
| Requisitos declarados después (reserva ya registrada) | Solo documentos por `POST /stands/archivos` | Igual |

Reglas comunes: `NumeroSolicitud` determinista y único (409 si se repite); `TextoLibre` solo en la cuota de origen;
factura (`01`) a RUC y boleta (`03`) a DNI; los importes salen del plan de pagos **congelado** en la solicitud.

## 4. Ejemplos exactos de request (los que producirá la web)

### Caso B — interna, USD, descuento por stand, programada por Facturación

```json
{
  "NumeroSolicitud": "CTRS-13f7e38c8ac14857a9d6d329f",
  "TipEvCod": 2,
  "EvenCod": 19,
  "Moneda": "USD",
  "TipoCambio": "1.0000",
  "Stands": ["83", "84", "85", "86"],
  "StandsDetalle": [
    { "Numero": "83", "PrecioLista": "9240.00", "DescuentoPorcentaje": "3.00", "DescuentoMonto": "277.20", "PrecioNeto": "8962.80" },
    { "Numero": "84", "PrecioLista": "9240.00", "DescuentoPorcentaje": "3.00", "DescuentoMonto": "277.20", "PrecioNeto": "8962.80" },
    { "Numero": "85", "PrecioLista": "9240.00", "DescuentoPorcentaje": "3.00", "DescuentoMonto": "277.20", "PrecioNeto": "8962.80" },
    { "Numero": "86", "PrecioLista": "9240.00", "DescuentoPorcentaje": "5.00", "DescuentoMonto": "462.00", "PrecioNeto": "8778.00" }
  ],
  "Comercial": {
    "TipoDescuento": "POR_STAND", "SumaLista": "36960.00", "DescuentoTotal": "1293.60",
    "BaseImponible": "35666.40", "TasaIgv": "18.00", "Igv": "6419.95", "Total": "42086.35"
  },
  "Modalidad": "personalizado",
  "TipoFacturacion": "01",
  "TipDocFacturacion": "6",
  "NumDocFacturacion": "20102026471",
  "RazonSocial": "ABASTECEDORES Y SERVICIOS INDUSTRIALES S.A.",
  "DirFacturacion": "AV. EJEMPLO 123, LIMA",
  "Contactos": {
    "Contrato": { "Nombre": "Representante Legal", "Cargo": "Representante legal", "Email": "pagos@empresa.com" },
    "Pagos": { "Nombre": "Representante Legal", "Email": "pagos@empresa.com" }
  },
  "Cuotas": [
    { "Porcentaje": 40, "Fecha": "2026-12-22", "TextoLibre": "Servicio de exhibición Expo 2027", "BaseImponible": "14266.56", "Igv": "2567.98", "Monto": "16834.54" },
    { "Porcentaje": 20, "Fecha": "2026-12-30", "BaseImponible": "7133.28", "Igv": "1283.99", "Monto": "8417.27" },
    { "Porcentaje": 40, "Fecha": "2027-04-02", "BaseImponible": "14266.56", "Igv": "2567.98", "Monto": "16834.54" }
  ],
  "Requisitos": {
    "Oc": true, "Hes": true, "Plataforma": false, "PlataformaNombre": null, "PlataformaUrl": null,
    "Valorizacion": false, "Otros": null, "Ninguna": false, "CuotaOrigen": 1
  },
  "Archivos": [
    { "Tipo": "OC", "Cuota": 1, "Link": "https://qa-ecommerce.sistemasiimp.org.pe/uploads/xxx.pdf", "Nombre": "oc.pdf" },
    { "Tipo": "HES", "Cuota": 1, "Link": "https://qa-ecommerce.sistemasiimp.org.pe/uploads/yyy.pdf", "Nombre": "hes.pdf" }
  ],
  "Origen": {
    "Sistema": "CONTRATOS_STANDS", "TipoSolicitud": "RESERVA_EMPRESA",
    "RegistradoPor": "admin@iimp.org.pe", "RegistradoEn": "2026-11-24T17:26:18.000Z",
    "ProgramadaPara": "2026-11-24T17:26:00.000Z"
  }
}
```

### Caso A (PEN, TC 3.50) — cambian estos campos

```json
"Moneda": "PEN",
"TipoCambio": "3.5000",
"Stands": ["114", "117", "118"],
"StandsDetalle": [
  { "Numero": "114", "PrecioLista": "26040.00", "DescuentoPorcentaje": "0.00", "DescuentoMonto": "0.00", "PrecioNeto": "26040.00" },
  { "Numero": "117", "PrecioLista": "26040.00", "DescuentoPorcentaje": "0.00", "DescuentoMonto": "0.00", "PrecioNeto": "26040.00" },
  { "Numero": "118", "PrecioLista": "32340.00", "DescuentoPorcentaje": "0.00", "DescuentoMonto": "0.00", "PrecioNeto": "32340.00" }
],
"Comercial": { "TipoDescuento": "NINGUNO", "SumaLista": "84420.00", "DescuentoTotal": "0.00",
               "BaseImponible": "84420.00", "TasaIgv": "18.00", "Igv": "15195.60", "Total": "99615.60" },
"Cuotas": [
  { "Porcentaje": 20, "Fecha": "2026-11-20", "BaseImponible": "16884.00", "Igv": "3039.12", "Monto": "19923.12" },
  { "Porcentaje": 20, "Fecha": "2026-12-05", "BaseImponible": "16884.00", "Igv": "3039.12", "Monto": "19923.12" },
  { "Porcentaje": 60, "Fecha": "2026-12-09", "BaseImponible": "50652.00", "Igv": "9117.36", "Monto": "59769.36" }
]
```
(`PrecioLista` = lista del IIMP en USD × `TipoCambio`: 7,440 × 3.5 = 26,040 y 9,240 × 3.5 = 32,340; los precios del ejemplo del SIE (28,000 / 28,140 / 28,280) no son los de la lista.)

### Solicitud regular

- **USD:** solo se suma `TipoCambio`: `{ "...": "payload actual (v6)", "Moneda": "USD", "TipoCambio": "1.0000" }`.
- **PEN:** el SIE no calcula; la web envía `Comercial`, importes por cuota y `StandsDetalle` igual que en el caso A (sin `Modalidad`, `Requisitos` ni `Origen`).

## 5. Qué debe hacer el SIE

1. **Tipo de cambio:** si llega `TipoCambio`, usarlo para registrar y **facturar todas las cuotas** del contrato (incluida
   la conversión a soles y el umbral de detracción de S/ 700 cuando la cuota está en USD). No usar el del día.
2. **Moneda:** registrar el contrato en `Moneda` y responder esa misma moneda (hoy responde `USD` aunque se envía `PEN`).
3. **Interna:** usar `Comercial`, `StandsDetalle[].PrecioNeto` y `Cuotas[].Monto` como importes oficiales del contrato,
   en lugar de recalcular con la lista de precios (precio neto pactado por stand, descuentos incluidos).
4. **Validar y responder `400 SOLICITUD_INVALIDA`** si no cuadra (tolerancia 0.02):
   `Σ Cuotas[].BaseImponible = Comercial.BaseImponible` · `BaseImponible + Igv = Total` ·
   `Σ Cuotas[].Monto = Comercial.Total` · `Moneda = PEN ⇒ TipoCambio > 0`.
5. **Almacenar** lo recibido (sugerencia):

   | Dato | Dónde |
   |---|---|
   | `Moneda`, `TipoCambio`, `Comercial`, `Modalidad` | Cabecera del contrato / cuenta corriente |
   | `StandsDetalle` | Detalle por stand (precio pactado ≠ lista) |
   | `Cuotas[].{BaseImponible,Igv,Monto,TextoLibre}` | Cronograma del contrato (`TextoLibre` → `FreeTxt`, como hoy) |
   | `Requisitos` | Requisitos de facturación del contrato (una fila por contrato) |
   | `Origen` | Auditoría (sistema, usuario, fecha, programada) |
   | JSON completo de entrada | Bitácora de integración |

6. **Responder** (recomendado) lo efectivamente registrado: `Moneda`, `TipoCambio`, `BaseImponible`, `Igv`, `Total` y por
   cuota `BaseImponible`, `Igv`, `Total` (la web compara contra lo pactado).
7. **Idempotencia sin cambios:** `NumeroSolicitud` repetido ⇒ `409` con la cuenta corriente existente.

### Opcional — retorno SIE → web (`POST /api/integracion/factura`, existente)

Para conciliar lo facturado, la notificación por cuota podría traer además (opcionales): `tipoDocumento`, `serie`,
`numero`, `moneda`, `tipoCambio`, `baseImponible`, `igv`, `total`. Los campos actuales no cambian.

## 6. Cómo probarlo (Pruebas)

1. El SIE publica los cambios en **SIE Pruebas** y confirma los nombres de campos (si hay diferencias, se ajustan en la web).
2. ContratosStands activa el envío con la variable `RESERVA_IIMP_CAMPOS_EXTENDIDOS=true` en su ambiente QA (apagada por
   defecto: mientras esté apagada la web envía el formato v6 de siempre).
3. Casos de prueba:

   | # | Caso | Se espera |
   |---|---|---|
   | 1 | Interna **A** (PEN, TC 3.50, 20/20/60) | Contrato en **PEN**, total S/ 99,615.60, cuotas 19,923.12 / 19,923.12 / 59,769.36, `TipoCambio` 3.5 |
   | 2 | Interna **B** (USD, descuento por stand) | Total USD **42,086.35** (no 43,612.80), cuotas 16,834.54 / 8,417.27 / 16,834.54 |
   | 3 | Regular en PEN | Solo `TipoCambio` adicional; facturada con ese TC |
   | 4 | Reserva sin los campos nuevos (v6) | Funciona como hoy |
   | 5 | Interna con importes que no cuadran | `400 SOLICITUD_INVALIDA` con detalle |
   | 6 | Mismo `NumeroSolicitud` | `409` con la cuenta corriente existente |

4. Si el SIE responde `400 JSON_INVALIDO` por campos que no conoce, avisar: se ajusta el envío por tipo de campo.

## 7. Preguntas para el SIE

1. ¿`Moneda` es campo de entrada soportado en `POST /stands/reserva`? Hoy se envía `PEN` y vuelve `USD`.
2. ¿Pueden usar el `TipoCambio` recibido para todas las cuotas (en lugar del tipo de cambio del día de emisión)?
3. ¿Los descuentos deben existir en SAP como descuento de línea o como precio neto por stand?
4. ¿Dónde se verá la declaración `Requisitos` (pantalla del contrato o solo base de datos)?
5. ¿Cómo se actualiza `Requisitos` si el usuario los completa después (endpoint nuevo o reenvío)? Hoy solo se agregan documentos por `/stands/archivos`.
6. ¿Aceptan `Origen.ProgramadaPara` para distinguir los registros hechos por tarea programada?
7. ¿Tope real de cuotas: 3 (acuerdo) o 9 (doc de reserva)?
8. ~~Empresas extranjeras~~ **Resuelto en la web:** para una empresa no domiciliada (documento RUT/ID alfanumérico) la web enviará `TipDocFacturacion: "0"`, `NumDocFacturacion` (documento sin signos, en mayúsculas), `RazonSocial`, `DirFacturacion` y **`Pais`** (ISO 3166-1 alfa-2, p. ej. `"CL"`). No se envía documento del representante. Confirmar con el SIE: ¿`Pais` en alfa-2 o prefieren el nombre?
