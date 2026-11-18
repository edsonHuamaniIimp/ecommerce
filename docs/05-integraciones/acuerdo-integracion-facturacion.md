# Acuerdo de integración — Facturación y pagos de stands

> **Partes:** ContratosStands (IIMP / Sistemas TI) ↔ **Sistema de facturación (SIE)**
> **Versión:** v1.0 — 14-10-2026 · **Estado:** acordado (verificación E2E contra túnel el 14-10-2026)
> **Guía técnica del endpoint:** [`api-facturacion-entrante.md`](api-facturacion-entrante.md)
> **Reserva de stands:** [`integracion-reserva-iimp.md`](integracion-reserva-iimp.md)

---

## 1. Objetivo y alcance

Definir el flujo extremo a extremo, los acuerdos cerrados y las **responsabilidades de cada
parte** para la reserva de stands, la emisión de facturas por cuota y la confirmación de pagos
(incluida la **detracción SPOT**), entre **ContratosStands** (web del exhibidor, `ecommerce.sistemasiimp.org.pe`)
y el **Sistema de facturación del IIMP (SIE)**.

Fuera de alcance: cálculo de montos/IGV (lo hace ContratosStands con el plan del contrato),
saldo en SAP y detracción fiscal (lógica interna del SIE), entrega física del voucher (por
definir su canal — ver §7).

---

## 2. Sistemas y actores

| Actor | Rol en la integración |
|---|---|
| **Cliente (exhibidor)** | Solicita la reserva con documentos (OC/HES), paga las cuotas y adjunta vouchers |
| **ContratosStands** (web) | UI del exhibidor + API M2M `POST /api/integracion/factura` + cuenta corriente del IIMP |
| **servicio-eventos (IIMP)** | API de reserva (`/stands/reserva`) y de archivos (`/stands/archivos`) — cuenta corriente |
| **SIE (Sistema de facturación)** | Emite el documento por cuota, decide si el pago quedó completo y **notifica estados** |

---

## 3. Flujo acordado (extremo a extremo)

| # | Quién → Quién | Evento | Estado |
|---|---|---|---|
| 1 | Cliente → ContratosStands | Registra la reserva y adjunta **OC y HES obligatorios** | Implementado |
| 2 | ContratosStands → servicio-eventos | `POST /stands/reserva` (Stands, Cuotas 1–3, Archivos) | Implementado |
| 3 | SIE → ContratosStands | `POST /api/integracion/factura` — factura emitida (`documento` + `estadoPago: 1`) | Implementado y verificado |
| 4 | Cliente → ContratosStands | Adjunta vouchers (diferencia, detracción o pago total) en "Mis pagos" | Implementado |
| 5 | ContratosStands → SIE | Entrega de vouchers (cuenta corriente `/stands/archivos`) | **Por confirmar** (§7 #1) |
| 6 | SIE → ContratosStands | `POST /api/integracion/factura` — resultado del pago (`0`/`1`; `2` si se anula o rechaza) | Implementado y verificado |

Diagramas de este acuerdo (carpeta de entrega):

| Diagrama | Archivo |
|---|---|
| Secuencia (UML) | `diagrama-1-secuencia.png` |
| Actividades (UML con carriles y rombos; cubre casuísticas A–C) | `diagrama-2-actividades-uml.png` (+ fuente `diagrama-2-actividades-uml.puml`) |
| Flujo del endpoint entrante (validaciones y estados) | `diagrama-3-flujo.png` |

---

## 4. Acuerdos cerrados

| Tema | Acuerdo |
|---|---|
| **Solicitud de factura** | Los requisitos son **declarativos y referenciales**: el cliente marca OC, HES, plataforma, valorización, otros o "ninguna de las anteriores" y adjunta al menos un documento por tipo declarado (la cuota del documento es la de la bandeja). **No se bloquea** por falta de OC/HES. La carga de constancias de pago se hace al pagar cada cuota |
| **Plan de cuotas** | Hasta **3 cuotas** por reserva. La reserva se registra **una sola vez**; la notificación es **por cuota** (1 a 3) |
| **Auth M2M** | `x-api-key` (misma clave compartida del Sistema de Montaje). En local/túnel no se exige; en producción es obligatoria |
| **Detracción** | SPOT aplica si la cuota supera **S/ 700** (convertir si la cuota está en USD). Cuota ≤ S/ 700 → **pago único** sin detracción. El plazo de la detracción es normativo y lo gestiona Facturación; la UI ya no muestra plazos |
| **Pagos parciales** | ContratosStands **no trackea parciales**: cada voucher/pago se notifica; el **SIE decide** si el pago quedó completo (`0`) o sigue pendiente (`1`) |
| **Estados** | `0` PAGADA · `1` PENDIENTE (incluye parciales) · `2` ANULADA **o rechazo** (código **homologado** con la declaración del SIE; no existe código separado de rechazo) |
| **Efecto de `2`** | Limpia el documento de la cuota (vuelve a pendiente de documento); **no revierte el pago** (decisión operativa; si se requiere, corrección manual autorizada con registro en el historial) |
| **Fecha de emisión** | Campo opcional `fechaEmision` (`YYYY-MM-DD`, no futura) en la notificación; se guarda en la cuota y se muestra al cliente y en la bandeja |
| **Justificación de rechazo** | Con `estadoPago: 2` el SIE envía la **justificación** (`justificacion`, obligatoria, máx. 500 caracteres); queda en el historial de facturación |
| **Re-emisión** | Si el documento se reemite, basta reenviarlo: reemplaza al anterior (sin `Idempotency-Key`) |
| **Rechazo bidireccional** | ContratosStands podrá solicitar el rechazo al SIE por la API de este (canal por definir — §7 #3) |
| **Cierre** | Con **todas** las cuotas en `0`, ContratosStands cierra la facturación y la solicitud (`pagado`) |
| **Pagos en la plataforma** | ContratosStands **no gestiona pagos** en la bandeja de Facturación: refleja el estado notificado. El cobro y las confirmaciones los gestiona Facturación y Cobranzas |

---

## 5. Responsabilidades

### 5.1 ContratosStands

1. **Reserva**: registrar la solicitud de factura en `POST /stands/reserva` con `NumeroSolicitud` y `Archivos`, según los requisitos declarados por el cliente (sin bloqueo por OC/HES).
2. **Cuenta corriente**: mantener los documentos (OC/HES/detracción/diferencia/pago total/valorización-cotización/otros requisitos) vía `/stands/archivos`, en cualquier orden y momento. En la UI, `PAGO_TOTAL` es excluyente con `DETRACCION`/`DIFERENCIA` de una misma cuota.
3. **API entrante**: exponer `POST /api/integracion/factura` conforme a la guía técnica (validaciones, 400/401/404).
4. **Efectos por estado**: `0` → cuota pagada + cierre si no quedan pendientes; `1` → registrar documento sin cambiar estado; `2` → limpiar documento sin revertir pago.
5. **Sin tracking de parciales**: confiar en el estado que determina el SIE en cada notificación.
6. **Visibilidad**: mostrar al cliente el documento notificado, su fecha de emisión real y la marca de anulación; los requisitos y vouchers son referenciales.
7. **Entrega de la clave** de producción por canal seguro.

### 5.2 Sistema de facturación (SIE)

1. **Emitir** el documento por cuota (hasta 3 por reserva, identificadas por `cuota` 1–3) y **notificar** con `documento` + `estadoPago` vigente en **cada** notificación.
2. **Determinar el estado**: `0` solo con saldo 0 en SAP — es decir, con **ambos pagos acreditados** cuando hay detracción; `1` mientras el pago sea parcial.
3. **Anular/rechazar** → notificar `2` (código homologado) **con la justificación** (`justificacion`, obligatoria).
4. **Detracción SPOT**: aplicar el umbral S/ 700 (conversión si la cuota está en USD) y aceptar pagos en **cualquier orden**.
5. **Consumir los vouchers** que ContratosStands registra en la cuenta corriente (confirmar canal — §7 #1).
6. **Definir el canal** para recibir solicitudes de rechazo de ContratosStands (§7 #3).
7. **Confirmar** la semántica de `2` después de `0` (§7 #2).
8. **Validar la clave compartida** en producción.

### 5.3 Cliente (exhibidor)

1. Declarar sus requisitos de facturación (OC, HES, plataforma, valorización, otros o "ninguna") y adjuntar al menos un documento por tipo declarado al enviar la solicitud.
2. Pagar la cuota (única si ≤ S/ 700; diferencia y detracción en cualquier orden si > S/ 700).
3. Subir las constancias de pago en "Mis documentos" (referenciales) para que se registren en la cuenta corriente del IIMP.

### 5.4 servicio-eventos (IIMP)

1. Exponer `POST /stands/reserva` (Stands, Cuotas, Archivos) devolviendo `Contrato`, `CuentaCorriente` y `NumeroSolicitud`.
2. Exponer `/stands/archivos` (agregar/eliminar/consultar) para la cuenta corriente.

---

## 6. Interfaces implicadas (resumen)

| Interfaz | Dirección | Detalle |
|---|---|---|
| `POST /api/integracion/factura` | SIE → ContratosStands | Guía completa: [`api-facturacion-entrante.md`](api-facturacion-entrante.md) (códigos, errores, ejemplos `curl`, verificación) |
| `POST /stands/reserva` / `/stands/archivos` | ContratosStands → servicio-eventos | [`integracion-reserva-iimp.md`](integracion-reserva-iimp.md) |

**Ambientes**: producción `https://ecommerce.sistemasiimp.org.pe`; pruebas por túnel al local
(URL efímera indicada en la guía; sin clave). La clave de producción se entrega por canal seguro.

---

## 7. Pendientes por cerrar

| # | Tema | Responsable |
|---|---|---|
| 1 | Canal de entrega del **voucher** al SIE (¿consume la cuenta corriente `/stands/archivos` o exige endpoint propio?) | SIE |
| 2 | `2` después de `0`: **resuelto** — no revierte el pago; la corrección es manual y autorizada (registrada en el historial) | ContratosStands / Facturación |
| 3 | Canal/endpoint del SIE para **recibir la solicitud de rechazo** de ContratosStands (bidireccional) | SIE |
| 4 | Confirmación explícita: pago parcial con detracción → `1` hasta completar ambos pagos | SIE |
| 5 | Clave compartida de producción (`x-api-key`) | ContratosStands (entrega por canal seguro) |

---

## 8. Verificación (14-10-2026)

Contra el túnel de pruebas al ambiente local de ContratosStands:

| Prueba | Resultado |
|---|---|
| `1` (PENDIENTE): documento registrado, estado sin cambios | ✅ |
| `0` (PAGADA) end-to-end (contrato `0000000008`): cuota pagada + facturación y solicitud cerradas | ✅ |
| `2` (ANULADA): documento limpiado de la cuota | ✅ |
| `400` con `estadoPago: 3` o texto; `404` con contrato inexistente o reserva anulada | ✅ |
| Historial de facturación firmado por `iimp` en cada notificación | ✅ |
| `fechaEmision` guardada y devuelta en la respuesta (QA/producción) | ✅ |
| `401` sin `x-api-key` o sin `INTEGRACION_API_KEY` en el ambiente | ✅ |
| Anulación (`2`) de una cuota pagada: documento limpio y estado de pago conservado; corrección manual verificada (COELPRA, 05-11-2026) | ✅ |
