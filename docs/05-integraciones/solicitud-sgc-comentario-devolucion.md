# Solicitud al equipo SGC: comentario del revisor en las devoluciones

**De:** Sistema de Reserva de Stands (integración SGC v1)
**Fecha:** 2026-11-25
**Prioridad:** Alta. Los clientes no ven qué deben corregir.

## Resumen

Cuando el área legal devuelve un trámite, nuestros clientes no reciben el **comentario del revisor**.
Hoy solo nos llega por dos vías:

1. **Webhook `workflow.returned` / `workflow.rejected` (`data.reason`):** trae el texto completo, pero **no recibimos webhooks desde el 2026-11-12 13:56 UTC**.
2. **`GET /api/integrations/v1/contracts/{id}` → `history[]`:** la entrada `source: "observation"` trae el mismo texto, pero **recortado a 240 caracteres**.

El texto armado por el SGC antepone la lista de adjuntos («Adjuntos a corregir: … Comentario: …»). Con títulos largos, esa lista ocupa casi todo el espacio y el comentario queda prácticamente vacío.

Los mensajes de `observations[].message` («Corrige el adjunto «X» y vuelve a enviarlo.») son automáticos. Según la guía (§8.3), el comentario general viaja solo en `reason`.

## Evidencia (expediente `f048f0b3-76ca-478c-9eac-06c45143307b`)

Devolución del 2026-11-25 20:11 UTC, entrada `history[]` con `source: "observation"` (240 caracteres):

```text
Adjuntos a corregir: Ficha RUC (o equivalente, en caso de empresa extranjera) (ficha-ruc-835-836-31df01.pdf), Vigencia de Poder (o equivalente, en caso de empresa extranjera) (vigencia-poder-835-836-d5f36e.pdf). Comentario: Actualizar la fi
```

Devolución anterior del 2026-11-23 16:57 UTC, también de 240 caracteres:

```text
Adjuntos a corregir: Vigencia de Poder (o equivalente, en caso de empresa extranjera) (vigencia-poder-835-836-996245.pdf). Comentario: La documentación se encuentra conforme y en orden, en la Vigencia de Poder solo se observa que supera el
```

En ambos casos el cliente no puede saber qué corregir: en el primero solo le llegan 16 caracteres del comentario y en el segundo la frase queda cortada.

Hoy hay **10 expedientes observados** en la misma situación.

## Lo que necesitamos (cualquiera de las dos resuelve el problema)

### 1. Reactivar la entrega de webhooks (preferido)

- Endpoint registrado: `POST https://ecommerce.sistemasiimp.org.pe/api/integracion/sgc/webhook`
- Último evento aceptado por nuestro lado: **2026-11-12 13:56 UTC**.
- Si en su panel figuran entregas fallidas, por favor compártannos el código HTTP y la respuesta que recibieron, y la fecha del último intento. Registramos el diagnóstico de firma (`X-SGC-Signature`) de cada intento para cruzarlo.
- Si es posible, reenvíen los eventos `workflow.returned` / `workflow.rejected` pendientes desde el 2026-11-12.

### 2. Exponer el motivo completo en el GET del expediente

Cualquiera de estas opciones nos sirve:

- No recortar el `detail` de las entradas `history[]` con `source: "observation"`.
- O agregar un campo con el motivo de la devolución vigente, por ejemplo:

```json
"lastReturn": {
  "round": 4,
  "reason": "Adjuntos a corregir: … Comentario: <texto completo>",
  "occurredAt": "2026-11-25T20:11:51Z"
}
```

## De nuestro lado (ya desplegado)

- Guardamos el `reason` completo del webhook (hasta 500 caracteres) y lo mostramos al cliente como «Comentario del área legal».
- Si el webhook no llega, tomamos el comentario de `history[]` y lo actualizamos en cada ronda. Mientras siga recortado, lo mostramos con «…».
- En cuanto se aplique la opción 1 o la 2, el cliente verá el comentario completo sin más cambios de nuestro lado.

## Pedido puntual mientras se resuelve

Por favor envíennos el **texto completo del comentario** de las devoluciones del expediente `f048f0b3-76ca-478c-9eac-06c45143307b` (2026-11-23 y 2026-11-25) para comunicárselo al cliente.
