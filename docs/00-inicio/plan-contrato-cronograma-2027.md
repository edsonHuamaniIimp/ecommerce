# Plan de implementación — Cronograma fijo de cuotas y contrato PERUMIN 38

> Estado: implementado en la rama de trabajo; pendiente QA visual y validación de Legal.
> Fecha de análisis: 2026-10-19.
> Alcance: wizard de reserva (`/mapa?codigo=...`), generación DOCX/PDF del contrato,
> validaciones de servidor, integración IIMP y pruebas/documentación.

## 1. Hallazgos del análisis

### 1.1 El DOCX recibido no debe reemplazar la plantilla actual completa

Comparé el DOCX nuevo (`CONTRAO-CONDICIONES GENERALES - EXHIBICIÓN PERUMIN 38 - ACT (29.9.26)`)
contra `plantillas/contrato-perumin38-tags.docx`:

- El nuevo DOCX **sí** trae el texto oficial de la Modalidad 3 con 40% / 30% / 30%.
- Pero en otras partes está **más atrasado** que la plantilla actual:
  - En la cláusula Quinta conserva la nota interna
    `(Diferenciar si hay un correo especifico para recepción de diseños y planos)` y
    `EL AUSPICIADOR`; la plantilla actual ya tiene `extemin@iimp.org.pe` y `EL EXHIBIDOR`.
  - El nuevo DOCX **no incluye el cuerpo del Anexo 4 (Reglamento de Exhibidores)**;
    solo deja el título. La plantilla actual sí contiene el Reglamento completo.
  - El nuevo DOCX conserva la obligación 3.2.7 de presentar diseños/planos; la plantilla
    actual ya la eliminó y renumeró las obligaciones (3.2.7 a 3.2.13).
- Conclusión: **no reemplazar** la plantilla completa por el DOCX nuevo. Usar el DOCX nuevo
  únicamente como fuente del texto de la Modalidad 3 y conservar las correcciones actuales.

### 1.2 La plantilla actual ya tiene un cronograma dinámico, pero perdió el texto legal

La plantilla actual reemplazó la Modalidad 3 por:

> `Modalidad 3 {sel_modalidad_3}: cronograma personalizado segun configuracion del cliente.`
> `Cuota {numero}: {porcentaje}% del total - US$ {monto} - vence: {fecha}`

Eso imprime fechas y montos, pero **elimina el texto legal oficial** de la Modalidad 3.
La corrección debe:
1. Restaurar el texto oficial 40/30/30 con sus condiciones de suspensión/incumplimiento.
2. Mantener un bloque separado de “Cronograma de pagos seleccionado” con las fechas.

### 1.3 El flujo actual permite demasiada configuración

Hoy el cliente puede:
- editar porcentajes;
- editar fechas;
- agregar/quitar cuotas;
- elegir 1, 2 o 3 cuotas con porcentajes arbitrarios.

El nuevo requisito es:
- 1 cuota: 100%.
- 2 cuotas: 50% / 50%.
- 3 cuotas: 40% / 30% / 30%.
- Sin edición de fechas: el sistema calcula el cronograma fijo.
- El cronograma se traslada al contrato.

### 1.4 La validación actual bloquea el cronograma nuevo

`fechasCuotasEnRango` exige que la cuota N no supere N meses desde la reserva
(`CUOTAS_MESES_MAX_POR_CUOTA = 1`) y un tope `2027-07-15`. Con el cronograma nuevo:

- Cuota 1: 2026-11-15 (puede estar dentro del mes).
- Cuota 2: 2027-02-15 (4 meses después de octubre; hoy la regla la rechaza).
- Cuota 3: 2027-06-15 (8 meses después; hoy la regla la rechaza).

Hay que sustituir esa regla para las reservas nuevas, manteniendo compatibilidad con
planes antiguos ya persistidos.

## 2. Regla funcional propuesta

### 2.1 Hitos

| Hito | Fecha | Uso |
|---|---|---|
| A | 2026-11-15 | 1.ª cuota 2026 / cuota única 2026 |
| B | 2027-01-15 | 1.ª cuota 2027 / 2 cuotas en enero 2027 |
| C | 2027-02-15 | 2.ª cuota del plan 3 cuotas 2026 |
| D | 2027-03-15 | 2.ª cuota 3 cuotas 2027 / 1.ª cuota 2 cuotas desde febrero 2027 |
| E | 2027-06-15 | Última cuota de todos los planes |

### 2.2 Selección según la fecha de reserva (hora Lima)

Se elige el primer cronograma cuyas fechas sean **estrictamente posteriores** a la fecha
de reserva. Si ninguna aplica, la modalidad no se ofrece. Si la reserva cae exactamente
en un hito, ese hito no se usa.

**3 cuotas**

| Reserva | Cuota 1 (40%) | Cuota 2 (30%) | Cuota 3 (30%) |
|---|---|---|---|
| Antes de 2026-11-15 | 2026-11-15 | 2027-02-15 | 2027-06-15 |
| 2026-11-15 a 2027-01-14 | 2027-01-15 | 2027-03-15 | 2027-06-15 |
| Desde 2027-01-15 | No disponible | — | — |

**2 cuotas**

| Reserva | Cuota 1 (50%) | Cuota 2 (50%) |
|---|---|---|
| Antes de 2026-11-15 | 2026-11-15 | 2027-06-15 |
| 2026-11-15 a 2027-01-14 | 2027-01-15 | 2027-06-15 |
| 2027-01-15 a 2027-03-14 | 2027-03-15 | 2027-06-15 |
| Desde 2027-03-15 | No disponible | — |

**1 cuota**

| Reserva | Cuota única (100%) |
|---|---|
| Antes de 2026-11-15 | 2026-11-15 |
| 2026-11-15 a 2027-06-14 | 2027-06-15 |
| Desde 2027-06-15 | No disponible |

> Interpretación adoptada para el caso no respondido: después del 2027-01-15 no se
> ofrece la modalidad de 3 cuotas porque su primera fecha ya no sería posterior.
> Confirmado: después del 2027-01-15 no se ofrece la modalidad de 3 cuotas.

### 2.3 Modalidad 4 (personalizada)

El contrato conserva una **Modalidad 4: cronograma personalizado según configuración
del cliente**. Se ofrece en el wizard cuando la empresa tiene una configuración creada
por el administrador en `/dashboard/empresas`:

- el administrador define la cantidad de cuotas (N, hasta 9) y las fechas;
- el cliente solo edita los porcentajes en el paso Cuotas;
- las fechas son de solo lectura;
- si no hay configuración válida, el cliente usa el cronograma estándar.

La Modalidad 4 también cubre planes históricos con porcentajes/fechas libres y
regeneraciones administradas que mantengan un plan anterior.

En el contrato se imprimen las cuatro modalidades con su marca de selección; solo una
queda marcada con `X`. El cronograma de cuotas se imprime una vez, después de las
modalidades, con las filas del plan seleccionado.

## 3. Diseño técnico

### 3.1 Utilidad compartida (fuente única de verdad)

Archivo: `src/lib/shared/utils/cuotas.ts`.

Nuevas piezas:
- `MODALIDADES_CUOTAS = { UNA: 1, DOS: 2, TRES: 3 }`.
- `PORCENTAJES_POR_MODALIDAD`: `1 -> [100]`, `2 -> [50, 50]`, `3 -> [40, 30, 30]`.
- `HITOS_CUOTAS`: constantes ISO en `constants.ts`.
- `cronogramaPredeterminado(cantidad, hoyISO): string[] | null`.
- `planPagoPredeterminado(montoTotal, cantidad, hoyISO): CuotaPlan[]`.
- `cronogramaValido(cuotas, hoyISO): boolean` (comparación exacta contra el cronograma
  esperado; sin fechas libres).
- `configCuotasValida(config, hoyISO)`, `cuotasCoincidenConfig(...)`,
  `cuotasPersonalizadasIniciales(...)` y `porcentajesEquitativos(...)` para la
  configuración personalizada por empresa.
- `modalidadDeCuotas(...)` y `etiquetaModalidad(...)`:
  - 1 cuota 100% → Modalidad 1.
  - 2 cuotas 50/50 → Modalidad 2.
  - 3 cuotas 40/30/30 → Modalidad 3.
  - plan con fechas configuradas por el administrador → Modalidad 4.
  - cualquier otro plan legacy → Modalidad 4 (personalizada).

Reglas:
- Fechas ISO `yyyy-mm-dd`, sin horas.
- Fecha de hoy calculada en `America/Lima`, no en la zona del servidor (ECS corre UTC).
- Agregar `dateUtils.todayLimaInputValue()` con `Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" })`.
- La comparación de fechas es por día calendario.
- Mantener las funciones antiguas solo para compatibilidad de planes legacy, marcadas
  como legacy, o eliminarlas si ya no tienen uso.

### 3.2 Backend

Archivo principal: `src/application/contratos/contrato-service.ts`.

- `calcularPlan` deja de aceptar porcentajes libres para reservas nuevas.
- Para el flujo del cliente:
  - validar modalidad 1/2/3;
  - recalcular el cronograma esperado en el servidor para la fecha actual;
  - exigir que las cuotas recibidas coincidan exactamente (porcentaje, fecha y orden);
  - nunca confiar en fechas enviadas por el cliente.
- Para regeneración de planes legacy persistidos (admin, sin `cuotas`):
  - conservar el plan guardado;
  - validar estructura mínima (1..3, suma 100%, fechas ISO) sin exigir el cronograma nuevo,
    para no romper contratos históricos.
- Nueva modalidad de 3 cuotas: `MODOS_PAGO.TRES_CUOTAS = "tres_cuotas"`.
  - Mantener `PERSONALIZADO` para la Modalidad 4 y datos históricos.
  - `marcarOrdenPago` ya trata cualquier modalidad distinta de `completo` como `cuotas`;
    no requiere migración, pero conviene actualizar el comentario y los tests.
- `calcularPlan` clasifica el plan: 1 cuota → Modalidad 1; 2x50/50 → Modalidad 2;
  3x40/30/30 → Modalidad 3; plan que coincide con `empresa.configCuotas` → Modalidad 4.
- **Configuración por empresa**: `empresa.config_cuotas` (JSONB) guarda
  `{ maxCuotas, fechas }`; se administra desde `/dashboard/empresas` con
  `empresas:manage`. El cliente recibe la configuración en `GET /api/auth/perfil`.
- `src/validators/contratos.validator.ts`:
  - valida estructura (N cuotas configurables, máximo 9; suma 100%, fechas futuras y ascendentes);
  - el servicio valida que las fechas coincidan con el cronograma estándar o con la
    configuración de la empresa;
  - mensajes claros con modalidades/fechas permitidas.
- `POST /api/contratos/borrador`, `/generar`, `/firmar-borrador` mantienen su contrato
  externo (`cuotas[]`) para minimizar cambios; el servidor recalcula y valida.

### 3.3 UI del wizard

Archivos: `step-pagos.tsx`, `use-reserva-form.ts`, `reserva-modal.tsx`,
`step-confirmacion.tsx`.

- Eliminar inputs de porcentaje y fecha, botones agregar/quitar y presets libres.
- Mostrar 3 tarjetas/botones cuando no hay configuración personalizada:
  - “1 cuota — 100%”.
  - “2 cuotas — 50% / 50%”.
  - “3 cuotas — 40% / 30% / 30%”.
- Si la empresa tiene `configCuotas` válida, mostrar **solo** el cronograma
  personalizado (Modalidad 4): fechas de solo lectura y porcentajes editables por el
  cliente, con validación de suma 100%.
- Deshabilitar modalidades sin cronograma futuro y explicar el motivo.
- Mostrar tabla de solo lectura: número, porcentaje, monto, fecha.
- El estado `CuotaConfig[]` se llena desde el cronograma estándar o desde
  `configCuotas`; en el modo personalizado solo se editan los porcentajes.
- El texto “Configura tus cuotas” cambia a “Elige la modalidad de pago”.
- `StepConfirmacion` recibe y muestra el plan seleccionado y sus fechas.
- El contrato borrador se sigue generando al pasar de Cuotas a Contrato.
- Al cambiar de modalidad, se regenera el borrador (o se invalida el anterior).
- Si el usuario dejó el wizard abierto y cambió el día, recalcular al entrar al paso;
  si el plan quedó inválido, volver a Cuotas.

### 3.4 Plantilla del contrato

Archivos: `plantillas/contrato-perumin38-tags.docx`,
`plantillas/contrato-perumin38-tags-en.docx`.

- Mantener la plantilla actual como base (no reemplazarla por el DOCX nuevo completo).
- En el Anexo 2:
  1. Restaurar el texto oficial de Modalidad 3 (ES y EN).
  2. Conservar la Modalidad 4 como “cronograma personalizado según configuración del cliente”, usando el bloque genérico actual.
  3. Quitar el loop genérico de la Modalidad 4 y moverlo a un bloque único después de las cuatro modalidades.
  4. Añadir después de las cuatro modalidades:
     - Título “Cronograma de pagos seleccionado”.
     - Loop `{#cuotas_contrato}` con `Cuota {numero}: {porcentaje}% del total - US$ {monto} - vence: {fecha}`.
     - El loop debe imprimir 1, 2 o 3 filas según la modalidad.
  5. Conservar `sel_modalidad_1`, `sel_modalidad_2`, `sel_modalidad_3`, `sel_modalidad_4`,
     `monto_modalidad_1`, montos e IGV.
- Añadir `modalidad_pago` al `data` del render para un encabezado explícito
  (“Modalidad seleccionada: …”), si se decide mostrarlo.
- Actualizar ES y EN con el mismo contenido; validar que no queden tags sin reemplazar.
- Crear/actualizar un script idempotente para parchear el DOCX, en lugar de editar XML a mano:
  `scripts/actualizar-contrato-cronograma.ps1`.
- No tocar el Anexo 4 ni las correcciones actuales de las cláusulas Quinta y 3.2.x.

### 3.5 Documentación

- `docs/00-inicio/plan-contrato-cuotas.md`: reemplazar la regla de fechas libres por
  el cronograma fijo.
- `docs/01-funcional/01-publico-y-reservas.md`: actualizar el paso CUOTAS.
- `docs/01-funcional/02-solicitudes-y-aprobaciones.md`: mencionar que el contrato
  incluye el cronograma seleccionado.
- `docs/05-integraciones/integracion-reserva-iimp.md`: aclarar que las fechas fijas
  del contrato son las que viajan al IIMP.
- No se requiere migración de base de datos.

## 4. Fases de implementación

### Fase 1 — Utilidad y pruebas (sin UI)
1. Añadir hitos y modalidades a `constants.ts`.
2. Implementar `cronogramaPredeterminado`, `planPagoPredeterminado` y
   `cronogramaValido`.
3. Añadir `todayLimaInputValue`.
4. Reescribir `cuotas.test.ts` con tabla de decisión y límites de fecha.
5. Verificar redondeo de montos y orden 40/30/30.

### Fase 2 — Backend
1. Adaptar `contrato-service.calcularPlan`.
2. Adaptar `contratos.validator.ts`.
3. Agregar `MODOS_PAGO.TRES_CUOTAS`.
4. Actualizar tests de contrato (modo 3 oficial, cronograma, legacy).
5. Probar payload del IIMP con 1/2/3 cuotas.

### Fase 3 — UI
1. Reescribir la selección de modalidad en `step-pagos.tsx`.
2. Ajustar `use-reserva-form.ts` (inicialización, validación, regeneración).
3. Ajustar textos de `reserva-modal.tsx`.
4. Mostrar plan en `step-confirmacion.tsx`.
5. Probar los tres modos y los estados deshabilitados.

### Fase 4 — Plantillas
1. Parchear ES y EN.
2. Regenerar DOCX/PDF de prueba.
3. Verificar que el texto legal de Modalidad 3 esté completo y que el cronograma
   tenga las fechas correctas.
4. Verificar que Anexo 4 y cláusulas actuales sigan intactos.

### Fase 5 — QA y despliegue
1. `tsc`, lint, suite completa.
2. Prueba manual en `/mapa?codigo=...` con 1/2/3 cuotas.
3. Descargar contrato y revisar PDF.
4. Probar “Registrar reserva en el IIMP” con el plan nuevo.
5. Verificar que planes antiguos sigan regenerando su contrato.
6. Commit, push y despliegue normal (sin migración).

## 5. Archivos afectados

- `src/lib/shared/constants.ts`
- `src/lib/shared/utils/date.ts`
- `src/lib/shared/utils/cuotas.ts`
- `src/lib/shared/utils/__tests__/cuotas.test.ts`
- `src/application/contratos/contrato-service.ts`
- `src/application/contratos/__tests__/contrato-service.test.ts`
- `src/validators/contratos.validator.ts`
- `src/validators/__tests__/contratos.validator.test.ts`
- `src/components/plano/reserva/step-pagos.tsx`
- `src/components/plano/reserva/use-reserva-form.ts`
- `src/components/plano/reserva/reserva-modal.tsx`
- `src/components/plano/reserva/step-confirmacion.tsx`
- `plantillas/contrato-perumin38-tags.docx`
- `plantillas/contrato-perumin38-tags-en.docx`
- `scripts/actualizar-contrato-cronograma.ps1` (nuevo)
- `docs/00-inicio/plan-contrato-cuotas.md`
- `docs/01-funcional/01-publico-y-reservas.md`
- `docs/01-funcional/02-solicitudes-y-aprobaciones.md`
- `docs/05-integraciones/integracion-reserva-iimp.md`

## 6. Criterios de aceptación

- En el wizard se ofrecen 3 modalidades estándar (100%, 50/50, 40/30/30) o el
  cronograma personalizado de la empresa (Modalidad 4), según corresponda.
- El contrato conserva 4 modalidades; la Modalidad 4 se usa para la configuración
  administrada y planes legacy.
- En el modo personalizado solo se editan los porcentajes; en el estándar no hay
  inputs editables de porcentaje ni fecha.
- Las fechas mostradas coinciden exactamente con la tabla aprobada.
- El contrato muestra el texto legal oficial de la Modalidad 3 y el cronograma
  seleccionado con fechas y montos.
- Un cliente no puede enviar fechas/porcentajes distintos: el servidor los recalcula
  y rechaza cualquier manipulación.
- El payload al IIMP lleva las mismas fechas del contrato.
- Los planes históricos siguen regenerando su contrato sin errores.
- `tsc`, lint y tests pasan; se valida el PDF real.

## 7. Riesgos

1. **Plazos relativos vs hitos**: el texto oficial de la Modalidad 3 habla de 30/45
   días hábiles desde la reserva/pago; el cronograma fijo usa hitos. Confirmado que
   ambos conviven; el contrato debe dejar clara la fecha pactada de cada cuota.
2. **Fechas vencidas**: si se reserva después de un hito, la modalidad se oculta o
   pasa al siguiente cronograma; nunca se genera una fecha pasada.
3. **Zona horaria**: usar `America/Lima`; el servidor ECS corre en UTC.
4. **Plantilla**: el DOCX nuevo es más antiguo en varias cláusulas; se conserva la
   plantilla actual y solo se incorporan Modalidad 3 y Modalidad 4.
5. **Datos históricos**: no migrar ni reescribir planes existentes.
6. **Inglés**: la plantilla EN debe actualizarse con el mismo texto y cronograma; Legal
   debe validarla.

## 8. Decisiones confirmadas

1. **3 cuotas 2027**: 15/01/2027 (40%), 15/03/2027 (30%), 15/06/2027 (30%).
   Después del 15/01/2027 no se ofrece esta modalidad (la primera fecha ya no sería
   estrictamente posterior).
2. **1 cuota después del 15/11/2026**: vence el 15/06/2027.
3. **Mismo día del hito**: la fecha debe ser estrictamente posterior; el hito de ese
   día no se usa y se pasa al siguiente cronograma disponible.
4. **Contrato**: conservar la versión actual (más completa), agregar el párrafo de
   Modalidad 3 y mantener la Modalidad 4 personalizada. No adoptar los retrocesos del
   DOCX nuevo (Anexo 4, cláusulas Quinta/3.2.7).
5. **Plazos 30/45 días hábiles**: el texto legal oficial se mantiene y convive con los
   hitos fijos del cronograma.

### Punto confirmado

- Después del 15/01/2027 se **oculta la modalidad de 3 cuotas**; quedan disponibles
  1 y 2 cuotas. El cronograma 2027 (15/01, 15/03, 15/06) aplica solo mientras sus tres
  fechas sean estrictamente posteriores a la reserva.
