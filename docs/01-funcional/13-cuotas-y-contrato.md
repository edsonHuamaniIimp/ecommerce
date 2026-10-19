# Cuotas y cronograma de pagos del contrato

> Fuente: `src/lib/shared/utils/cuotas.ts`,
> `src/application/contratos/contrato-service.ts`,
> `src/application/empresas/empresa-service.ts`,
> `src/components/plano/reserva/step-pagos.tsx`,
> `src/components/empresas/configurar-cuotas-empresa-modal.tsx`.
> Relacionado: [plan-contrato-cronograma-2027.md](../00-inicio/plan-contrato-cronograma-2027.md).

## 1. Objetivo

Definir las reglas de negocio de las cuotas del contrato de exhibición, tanto para el
**cronograma estándar** como para el **cronograma personalizado por empresa**, y cómo
se trasladan al contrato y a los procesos de regeneración.

## 2. Dos tipos de configuración

| Tipo | Quién define las fechas | Quién define los porcentajes | Dónde se usa |
|---|---|---|---|
| Estándar | Sistema (hitos PERUMIN 38) | Sistema, según modalidad 1/2/3 | Empresas sin configuración personalizada |
| Personalizada | Administrador en `/dashboard/empresas` | Cliente en el wizard | Empresas con configuración activa |

La configuración personalizada se guarda por empresa en `empresa.config_cuotas`:

```json
{
  "maxCuotas": 3,
  "fechas": ["2026-11-15", "2027-02-15", "2027-06-15"]
}
```

- `maxCuotas`: cantidad exacta de cuotas configuradas por el administrador. Puede ser
  **N cuotas** (1 a 9, límite del API del IIMP). El wizard estándar sigue limitado a 3.
- `fechas`: una fecha ISO por cuota, estrictamente futura, válida y en orden ascendente.
- `null`: la empresa usa el cronograma estándar.

## 3. Cronograma estándar

### 3.1 Hitos

| Hito | Fecha |
|---|---|
| A | 2026-11-15 |
| B | 2027-01-15 |
| C | 2027-02-15 |
| D | 2027-03-15 |
| E | 2027-06-15 |

### 3.2 Regla de selección

Se usa el primer cronograma cuyas fechas sean **estrictamente posteriores** a la fecha
de reserva (hora `America/Lima`). Si la reserva cae en un hito, ese hito no se usa.

**3 cuotas (40% / 30% / 30%)**

| Reserva | Cuota 1 | Cuota 2 | Cuota 3 |
|---|---|---|---|
| Antes del 2026-11-15 | 2026-11-15 | 2027-02-15 | 2027-06-15 |
| 2026-11-15 al 2027-01-14 | 2027-01-15 | 2027-03-15 | 2027-06-15 |
| Desde el 2027-01-15 | No disponible | — | — |

**2 cuotas (50% / 50%)**

| Reserva | Cuota 1 | Cuota 2 |
|---|---|---|
| Antes del 2026-11-15 | 2026-11-15 | 2027-06-15 |
| 2026-11-15 al 2027-01-14 | 2027-01-15 | 2027-06-15 |
| 2027-01-15 al 2027-03-14 | 2027-03-15 | 2027-06-15 |
| Desde el 2027-03-15 | No disponible | — |

**1 cuota (100%)**

| Reserva | Cuota única |
|---|---|
| Antes del 2026-11-15 | 2026-11-15 |
| 2026-11-15 al 2027-06-14 | 2027-06-15 |
| Desde el 2027-06-15 | No disponible |

### 3.3 Reglas de UI

- En empresas sin configuración personalizada, el cliente solo ve tres botones: 1 cuota
  100%, 2 cuotas 50/50 y 3 cuotas 40/30/30.
- Las modalidades sin fechas futuras se muestran deshabilitadas.
- El cliente no edita porcentajes ni fechas en el modo estándar.
- El servidor recalcula el cronograma y rechaza cualquier fecha o porcentaje distinto.

## 4. Cronograma personalizado (Modalidad 4)

### 4.1 Configuración del administrador

En `/dashboard/empresas`, el icono de calendario abre el modal **“Fechas de pago”**:

- Agrega cuotas hasta el máximo permitido (N; tope 9 del IIMP) o quita cuotas.
- Define una fecha por cuota.
- Las fechas deben ser futuras, válidas y ascendentes.
- “Usar cronograma estándar” elimina la configuración (`configCuotas = null`).
- Guardar exige permiso `empresas:manage` (o `admin:full`) y usa
  `POST /api/empresas/configurar-cuotas` con `{ id, configCuotas }`.

La configuración puede cambiarse en cualquier momento. Una configuración nueva **no
reescribe** contratos ya generados: esos usan el snapshot del plan guardado en la
solicitud.

### 4.2 Experiencia del cliente

Si la empresa tiene una configuración válida:

- El wizard muestra **solo** el cronograma personalizado, no los botones estándar.
- El cliente ve las cuotas y las fechas definidas por el administrador.
- El cliente **solo edita los porcentajes**; las fechas son de solo lectura.
- Los porcentajes deben ser mayores a 0, sumar 100% y respetar hasta 2 decimales.
- El monto de cada cuota se calcula en el servidor a partir del precio del stand.
- El contrato marca **Modalidad 4** y contiene el cronograma con los porcentajes del
  cliente y las fechas del administrador.

Si la configuración no existe, está incompleta o sus fechas ya vencieron, el wizard usa
el cronograma estándar.

### 4.3 Validación del servidor

- El servidor no confía en las fechas del cliente.
- Para una empresa con configuración válida, exige que la cantidad de cuotas y las
  fechas coincidan exactamente con `configCuotas`.
- Para una empresa sin configuración, exige una modalidad estándar exacta.
- Los planes históricos persistidos se aceptan aunque sus fechas ya hayan pasado
  (regeneración de contratos antiguos).

## 5. Contrato

El Anexo 2 contiene las cuatro modalidades:

1. **Modalidad 1:** 100%.
2. **Modalidad 2:** 50% / 50%.
3. **Modalidad 3:** 40% / 30% / 30%, con el texto legal oficial.
4. **Modalidad 4:** cronograma personalizado según configuración del cliente.

Solo se marca con `X` la modalidad aplicada. Después de las modalidades se imprime el
bloque **“Cronograma de pagos seleccionado”** con una fila por cuota:

```text
Cuota 1: 50% del total - US$ 2,950.00 - vence: 15/11/2026
Cuota 2: 25% del total - US$ 1,475.00 - vence: 15/02/2027
Cuota 3: 25% del total - US$ 1,475.00 - vence: 15/06/2027
```

Las fechas del texto legal de la Modalidad 3 (30/45 días hábiles) se mantienen y
conviven con las fechas fijas del cronograma. Legal aprobó esta coexistencia.

## 6. Persistencia y regeneración

- Al generar el contrato se guarda el snapshot en `solicitud.plan_cuotas`:
  `{ modalidad, cuotas: [{ numero, porcentaje, monto, fechaVencimiento }] }`.
- La generación definitiva (al enviar la solicitud), la firma digital, la regeneración
  desde la plantilla y la regeneración tras una observación usan **ese snapshot**.
- No se recalcula el plan desde la configuración actual de la empresa al regenerar:
  cambiar las fechas de la empresa no altera un contrato ya generado.
- La modalidad persistida manda para el marcado del contrato; un plan personalizado de
  3 cuotas sigue siendo Modalidad 4 aunque sus porcentajes coincidan con 40/30/30.
- La eliminación de la configuración de la empresa no rompe contratos existentes.

## 7. Reglas de permisos

| Acción | Permiso |
|---|---|
| Ver configuración de empresas | `empresas:view` |
| Configurar fechas de pago | `empresas:manage` o `admin:full` |
| Ver su cronograma y editar porcentajes | Cliente titular de la solicitud |
| Generar/regenerar contrato | Titular o admin según estado de la solicitud |

## 8. Casos límite

- **Reserva el mismo día de un hito:** la fecha debe ser estrictamente posterior; se usa
  el siguiente cronograma o se oculta la modalidad.
- **Sin fechas futuras:** la modalidad no se ofrece; el cliente debe contactar a
  Facturación del IIMP.
- **Configuración personalizada con fechas inválidas:** se ignora y se usa el estándar.
- **Cliente envía fechas manipuladas:** el servidor responde 400.
- **Configuración cambiada después de reservar:** el contrato conserva el snapshot.
- **Plan legacy con fechas pasadas:** se puede regenerar el contrato histórico.
- **Sin plan persistido:** la regeneración falla con un mensaje claro; no inventa cuotas.

## 9. Pruebas de referencia

- `src/lib/shared/utils/__tests__/cuotas.test.ts`
- `src/application/contratos/__tests__/contrato-service.test.ts`
- `src/validators/__tests__/contratos.validator.test.ts`
- `src/application/empresas/__tests__/empresa-service.test.ts`
