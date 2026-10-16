# Aviso de cambio — API de notificación de facturación (sistema de facturación → ContratosStands)

**Dirigido a:** equipo del **sistema de facturación del IIMP**
**Fecha:** 15-10-2026
**Servicio afectado:** `POST /api/integracion/factura` (notificación por cuota: documento + estado)
**Referencia completa:** `api-facturacion-entrante.md` (versión actualizada; se entrega junto con este aviso)

---

## 1. Qué cambia

Con el estado **`estadoPago: 2` (ANULADA o RECHAZO)**, el campo **`justificacion` pasa a ser OBLIGATORIO**:

| Campo | Tipo | Cuándo | Detalle |
|---|---|---|---|
| `justificacion` | string | **Con `estadoPago: 2`** | Motivo de la anulación o rechazo. Máximo **500** caracteres |

- Si envían `2` **sin** `justificacion` → la API responde **`400`** con:
  `"justificacion es obligatoria cuando estadoPago es 2 (ANULADA/RECHAZADA)"`.
- Si supera 500 caracteres → `400`.
- Para `estadoPago: 0` (PAGADA) y `1` (PENDIENTE) el campo es **opcional** (no cambia nada).

## 2. Por qué

1. La justificación queda registrada en el **historial de facturación** (trazabilidad de la anulación/rechazo).
2. Se muestra al **cliente** en "Mis pagos" (tooltip del documento anulado/rechazado).

## 3. Ejemplo

**Correcto** (anulación con motivo):

```json
{
  "numeroSolicitud": "CTRS-dbef0d24ff1246b1b419edd05",
  "cuota": 1,
  "documento": "F001-1234.pdf",
  "estadoPago": 2,
  "justificacion": "Rechazada: RUC incorrecto en la factura"
}
```

**Incorrecto** (será rechazado con `400`):

```json
{ "numeroSolicitud": "CTRS-...", "cuota": 1, "documento": "F001-1234.pdf", "estadoPago": 2 }
```

Sin cambio para el resto del contrato: `0` y `1` siguen igual; `2` mantiene su efecto
(limpia el documento de la cuota y la deja pendiente de documento; **no revierte** el pago).

## 4. Vigencia y acción requerida

1. **Acción requerida (sistema de facturación):** agregar `justificacion` a la notificación cuando `estadoPago` sea `2`.
2. **Vigencia:** este cambio se activará en producción **una vez desplegado del lado
   ContratosStands y coordinada la fecha** (aún no está en producción al emitirse este aviso).
   Confirmar por este canal la fecha en que su sistema ya podrá enviar el campo.
3. **Pruebas:** pueden verificar contra el túnel de pruebas vigente
   (`https://officially-apollo-hybrid-assigned.trycloudflare.com/api/integracion/factura`,
   sin `x-api-key`, URL efímera) o contra el entorno que acuerden.

## 5. Recordatorio del contrato vigente (sin cambios)

- `estadoPago`: `0` PAGADA · `1` PENDIENTE · `2` ANULADA **o RECHAZO** (código homologado; no existe un código separado de rechazo).
- Sin `Idempotency-Key` (la llamada puede repetirse; cada envío reemplaza el estado/documento anterior).
- Errores: `401` clave inválida · `404` solicitud/facturación/cuota inexistente · `400` validación · `500` interno.

---

Contacto de coordinación: equipo de Sistemas TI / ContratosStands (IIMP).
