# Consulta al equipo del SGC — 15-10-2026

Hola 👋 equipo SGC. Ya con las claves nuevas todo responde (v1 y v2, ¡gracias!). Nos topamos con un punto al registrar el expediente y queremos confirmar reglas antes de seguir. Contexto: sistema ContratosStands (separación de stands), QA.

## 1) Error actual: “El código contractual no es válido” (lo que necesitamos resolver)

Enviamos `POST /api/integrations/v1/contracts` y responde:

```
422 {"error":"El código contractual no es válido."}
```

Payload enviado (resumido):

```json
{
  "code": "12",
  "areaCode": "EVENTOS",
  "contractTypeCode": "AUSPICIO",
  "name": "Separacion de stand - 12",
  "counterpartyLegalName": "YURA S.A.",
  "counterpartyEmail": "correo@correo.com",
  "processOrigin": "ContratosStands"
}
```

**¿Qué reglas exige `code`?** Necesitamos saber, por ejemplo:
- formato permitido (¿solo alfanumérico?, ¿mayúsculas?, ¿guiones?),
- longitud mínima/máxima (nuestro caso usa el **número de stand**: "12", "A-042", o `STAND-<8 chars>` en reservas múltiples),
- **¿debe ser único en el SGC?** (si "12" ya fue usado en otra prueba/evento, ¿devuelve este mismo mensaje?),
- si aplica por evento o global.

Y si el `422` pudiera traer el detalle (qué regla falló), nos ahorra iteraciones.

## 2) Confirmación de idempotencia (comportamiento observado)

Repetimos una creación con la **misma `Idempotency-Key`** y **payload corregido** (cambiamos el tipo) y respondió:

```
409 {"error":"La clave idempotente ya fue usada con otro contenido."}
```

Deducimos que la clave queda registrada **incluso cuando el request falla (422)**. ¿Es correcto? Ya lo manejamos de nuestro lado (nuestra clave ahora incluye un hash del contenido), es solo para documentar la semántica.

## 3) Tipos de expediente para “stands/exhibidores”

En QA, `GET /contract-types` hoy devuelve solo: `AUSPICIO` y `RECLUTAMIENTO_DE_AUSPICIADORES`.
Para el negocio de **separación de stands / exhibidores**:
- ¿Qué `contractTypeCode` debemos usar en QA y en **producción**?
- ¿Está previsto crear un tipo tipo `EXHIBIDORES` o `EVENTOS`? (Lo pedimos porque hoy uno u otro no existe y no queremos configurar algo que falle en prod.)

## 4) Extras (para el cierre)

- Confirmar la entrega de la **clave de producción** (con rol `contract-manager`) y el secreto HMAC de producción.
- Confirmar que el webhook de producción incluirá el header `x-sgc-delivery` (lo usamos para deduplicar entregas).

Gracias 🙏 — con los puntos 1 y 3 quedamos desbloqueados para cerrar la integración.
