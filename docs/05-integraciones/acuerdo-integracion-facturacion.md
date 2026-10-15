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
| **Solicitud de factura** | Requiere que la **1ª cuota** tenga **al menos 1 OC y 1 HES** (validación bloqueante en UI y backend de ContratosStands; cuentan los documentos generales, sin cuota). En las cuotas 2–3 son **opcionales**. La detracción y la diferencia se adjuntan después, al pagar |
| **Plan de cuotas** | Hasta **3 cuotas** por reserva. La reserva se registra **una sola vez**; la notificación es **por cuota** (1 a 3) |
| **Auth M2M** | `x-api-key` (misma clave compartida del Sistema de Montaje). En local/túnel no se exige; en producción es obligatoria |
| **Umbral de detracción** | SPOT aplica si la cuota supera **S/ 700** (convertir si la cuota está en USD). Cuota ≤ S/ 700 → **pago único** sin detracción |
| **Orden de pago** | Libre: puede pagarse **primero la detracción o primero la diferencia** (ambos son independientes) |
| **Plazo de detracción** | La constancia puede registrarse **hasta 1 mes después** del pago del resto |
| **Pagos parciales** | ContratosStands **no trackea parciales**: cada voucher/pago se notifica; el **SIE decide** si el pago quedó completo (`0`) o sigue pendiente (`1`) |
| **Estados** | `0` PAGADA · `1` PENDIENTE (incluye parciales) · `2` ANULADA **o rechazo** (código **homologado** con la declaración del SIE; no existe código separado de rechazo) |
| **Efecto de `2`** | Limpia el documento de la cuota (vuelve a pendiente de documento); **no revierte el pago** (por confirmar — §7 #2) |
| **Justificación de rechazo** | Con `estadoPago: 2` el SIE envía la **justificación** (`justificacion`, obligatoria, máx. 500 caracteres); queda en el historial de facturación |
| **Re-emisión** | Si el documento se reemite, basta reenviarlo: reemplaza al anterior (sin `Idempotency-Key`) |
| **Rechazo bidireccional** | ContratosStands podrá solicitar el rechazo al SIE por la API de este (canal por definir — §7 #3) |
| **Cierre** | Con **todas** las cuotas en `0`, ContratosStands cierra la facturación y la solicitud (`pagado`) |

---

## 5. Responsabilidades

### 5.1 ContratosStands

1. **Reserva**: exigir OC+HES de la primera cuota (UI + backend) y registrar la reserva en `POST /stands/reserva` con `NumeroSolicitud` y `Archivos`.
2. **Cuenta corriente**: mantener los documentos (OC/HES/detracción/diferencia/pago total/valorización-cotización) vía `/stands/archivos`, en cualquier orden y momento. En la UI, `PAGO_TOTAL` es excluyente con `DETRACCION`/`DIFERENCIA` de una misma cuota.
3. **API entrante**: exponer `POST /api/integracion/factura` conforme a la guía técnica (validaciones, 400/401/404).
4. **Efectos por estado**: `0` → cuota pagada + cierre si no quedan pendientes; `1` → registrar documento sin cambiar estado; `2` → limpiar documento sin revertir pago.
5. **Sin tracking de parciales**: confiar en el estado que determina el SIE en cada notificación.
6. **Visibilidad**: mostrar al cliente el documento notificado y la marca de anulación; microcopy del umbral/orden/plazo de detracción.
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

1. Adjuntar **OC y HES** (obligatorias en la **1ª cuota**; opcionales en las cuotas 2–3) al solicitar la reserva/factura.
2. Pagar la cuota (única si ≤ S/ 700; diferencia y detracción en cualquier orden si > S/ 700; la detracción hasta 1 mes después).
3. Subir los vouchers en "Mis pagos" para que se registren en la cuenta corriente del IIMP.

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
| 2 | ¿`2` después de `0` debe **revertir** el estado de pago de la cuota? (hoy solo limpia el documento) | SIE |
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
