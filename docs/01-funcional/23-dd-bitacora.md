# Debida Diligencia - Bitácora técnica y decisiones

> **Fecha:** 2026-11-16
> **Rama:** `feature/dd-v2`
> **Estado:** reparación aplicada en local; backfill general y despliegue en producción pendientes.
> **Documentos relacionados:** [`20-debida-diligencia-post-lanzamiento.md`](./20-debida-diligencia-post-lanzamiento.md), [`21-debida-diligencia-tareas-pendientes.md`](./21-debida-diligencia-tareas-pendientes.md), [`22-dd-dictamen-por-vinculo-estrategia.md`](./22-dd-dictamen-por-vinculo-estrategia.md).

## 1. Propósito

Esta bitácora registra las decisiones, incidentes y pasos operativos de Debida
Diligencia que no deben perderse entre sesiones. No reemplaza el alcance funcional
ni el backlog; documenta lo que se descubrió al probar la implementación.

## 2. Decisiones vigentes

### 2.1 Dictamen reputacional por vínculo

- La unidad de dictamen reputacional es la fila de `dd_matriz_vinculo`, no el nombre.
- Cada caso nuevo de `debida_diligencia_reputacion` debe tener `vinculo_id`.
- `vinculo_id = NULL` identifica un caso legacy y se mantiene visible para no perder
  historial.
- Dos vínculos pueden tener el mismo nombre, por ejemplo representante y beneficiario.
  En ese caso deben existir dos casos reputacionales independientes.
- La unicidad nueva es `(expediente_id, vinculo_id)`.
- Los casos legacy mantienen unicidad por `(expediente_id, nombre_a_revisar)` mediante
  un índice parcial.

### 2.2 Derivación a Comunicaciones

- La derivación exige la declaración `vinculosCompletos` (checkbox auditado).
- La evaluación SIG **no bloquea** la derivación. Puede completarse después.
- Sí se valida que la matriz contenga todos los vínculos esperados del expediente.
- Los vínculos que ya tienen un caso enlazado se omiten para evitar duplicados.
- La acción desde la matriz envía los `vinculoIds` seleccionados; la acción desde el
  modal del expediente mantiene la derivación de todos los vínculos.
- Los casos legacy con `vinculo_id = NULL` todavía requieren conciliación antes de
  considerar completa la cobertura por vínculo.

### 2.3 UI de reputación

- `/reputacion` vuelve a agrupar por expediente con acordeón.
- Se agregó filtro por rango de fecha de envío del SIG (`fecha_derivacion`) y orden
  reciente/antiguo.
- La fecha de envío SIG se muestra en la cabecera del expediente y en la tabla.
- Los grupos sin ningún caso enlazado muestran el badge `Sin vínculo`.

### 2.4 Resumen de matriz en la revisión

El tab **Matriz** de `Revisar expediente` ahora lista todos los vínculos del
expediente, no solo la fila de la empresa. Cada vínculo muestra:

- tipo y documento;
- estado y fecha de SIG;
- estado y fecha de Comunicaciones;
- estado y fecha de Legal;
- resultado final y fecha;
- acceso al detalle completo de la matriz.

El endpoint `GET /api/debida-diligencia/matriz-evaluacion/listar` acepta
`expedienteId` para obtener esas filas.

Se retiraron del detalle de empresa los bloques duplicados de conclusiones SIG,
Comunicaciones, Legal y resultado final. Las observaciones, responsables y adjuntos
de cada sujeto se consultan con **Abrir**, para no repetir el mismo estado dos veces.

### 2.5 Evaluación reputacional

- **Comunicaciones** registra resultado (`ACEPTADO` / `OBSERVADO`), observaciones y fuente.
- **SIG** define la conclusión reputacional en el modo edición del vínculo.
- `EN REVISIÓN` queda como estado informativo mientras el área está pendiente.
- La conclusión final sigue siendo del expediente y se registra en
  **Revisar expediente**.

`/reputacion` no elige la conclusión. Solo usa el catálogo `reputacion_estado` para
sus filtros.
### 2.6 Catálogo maestro DD

Se creó la tabla `dd_maestra` para administrar etiquetas, orden, disponibilidad y
metadatos de los catálogos DD. El seed `prisma/dd-maestra-seed.ts` carga 52 filas:
expediente, reputación, matriz, documento, evaluación y relación.

Los códigos canónicos siguen en `src/lib/shared/constants.ts` porque las reglas de
negocio, validaciones y tipos compartidos los necesitan en tiempo de compilación.
`dd_maestra` no reemplaza esas constantes: las complementa como catálogo
administrable. Migración: `20261115200000_add_dd_maestra`.

`/reputacion` consume `reputacion_estado` desde
`GET /api/debida-diligencia/maestra`; si el catálogo no responde, usa las constantes
como fallback. Así el administrador puede cambiar textos, orden o desactivar
opciones sin tocar el código, pero el backend sigue validando los códigos conocidos.
Comunicaciones usa `reputacion_resultado` para su resultado; SIG usa `matriz_conclusion` para la conclusión reputacional.

### 2.7 Inicio de revisión reputacional

Abrir un vínculo en `/reputacion` solo muestra su información: no cambia el estado.
Si el caso está en `por_revisar`, el detalle aparece en modo lectura y ofrece el
botón **Comenzar revisión**. Si se confirma:

- se marca el caso como `en_analisis` mediante
  `POST /api/debida-diligencia/reputacion/iniciar`;
- se registra auditoría;
- SIG ve el badge **En revisión** en la columna Comunicaciones de la matriz;
- se habilita el formulario de resultado, observaciones y fuente para Comunicaciones.

Si se cancela, no se modifica nada. Un vínculo que ya está en revisión no vuelve a
preguntar. Comunicaciones guarda resultado, observaciones y fuente, y puede cerrar su revisión;
la conclusión reputacional queda pendiente para SIG.

La **conclusión final** pertenece al expediente y vive en el modal
**Revisar expediente** de `/matriz`. El detalle de un vínculo (`/matriz/[id]`) solo
registra evaluación SIG, reputacional y Legal/Compliance; no expone botones de
conclusión final del expediente.

### 2.8 Flujo actual de dictamen reputacional

1. Logística deriva uno o varios vínculos a Comunicaciones.
2. Comunicaciones inicia la revisión del vínculo.
3. Comunicaciones registra:
   - resultado: `ACEPTADO` / `OBSERVADO`;
   - observación;
   - fuente.
4. El resultado y la observación se reflejan en `DdMatrizVinculo.repResultado` y
   `DdMatrizVinculo.repObservaciones`.
5. Logística, en `/matriz/[id]` modo edición, define únicamente la
   **conclusión reputacional**:
   - `ACEPTADO` → `SIN OBSERVACIONES`;
   - `OBSERVADO` → `SIN OBSERVACIONES` o
     `REQUIERE DEBIDA DILIGENCIA REFORZADA`.
6. `EN REVISIÓN` es un estado informativo mientras el área está pendiente; no se
   selecciona como conclusión manual.
7. La conclusión final (`APTO`, `NO APTO`, etc.) se registra a nivel expediente en
   **Revisar expediente**.

## 3. Migraciones

| Migración | Estado local | Propósito |
|---|---|---|
| `20261115170000_add_dd_vinculos_completos` | Aplicada | Declaración auditada de vínculos completos. |
| `20261115180000_dd_reputacion_por_vinculo` | Aplicada | Agrega `vinculo_id`, FK, unicidad por vínculo e índice parcial legacy. |
| `20261115190000_drop_reputacion_nombre_unique` | Aplicada | Elimina el índice único viejo por nombre que impedía dos casos del mismo nombre en vínculos distintos. |
| `20261115200000_add_dd_maestra` | Aplicada | Crea el catálogo administrable `dd_maestra`. |

Las migraciones `20261115190000` y `20261115200000` son obligatorias antes de
probar el flujo actual en cualquier ambiente.

## 4. Incidente FEJUCY S.A.C. (DD-2026-I1003)

### Síntoma

La matriz tenía 5 vínculos y se enviaron 5 a Comunicaciones, pero `/reputacion`
mostraba solo 4 casos. Faltaba el caso de
`VILELA MALPARTIDA JUAN CARLOS` como beneficiario, porque la misma persona también
existía como representante legal.

### Causa raíz

La migración 118 intentó eliminar la unicidad anterior como constraint:

```sql
UNIQUE (expediente_id, nombre_a_revisar)
```

En PostgreSQL, esa unicidad era un **índice único**, no un constraint. El índice
sobrevivió y `createMany({ skipDuplicates: true })` omitió silenciosamente el segundo
caso del mismo nombre.

### Corrección

1. Se creó y aplicó `20261115190000_drop_reputacion_nombre_unique`.
2. Se verificó que el índice viejo
   `debida_diligencia_reputacion_expediente_id_nombre_a_revisar_key` ya no existe.
3. Se reparó el expediente FEJUCY creando el caso faltante con su `vinculo_id`, la
   misma fecha de derivación y el mismo derivado por. La reparación quedó auditada.
4. FEJUCY quedó con 5 casos, uno por vínculo.

### Verificación esperada

```text
DD-2026-I1003
- FEJUCY S.A.C.                         -> 1 caso
- VILELA MALPARTIDA JUAN CARLOS (rep.)  -> 1 caso
- LOPEZ FERNANDEZ MARCILIO FERNANDO     -> 1 caso
- VALDIVIA TARAZONA JUAN                -> 1 caso
- VILELA MALPARTIDA JUAN CARLOS (benef.)-> 1 caso
Total: 5 casos
```

## 5. Estado local

- La BD local `contratos_dd` en `localhost:5433` tiene 120 migraciones aplicadas.
- El índice viejo por nombre fue eliminado.
- El índice único correcto `(expediente_id, vinculo_id)` y el índice parcial legacy
  existen.
- FEJUCY fue reparado.
- El backfill general de casos legacy sigue pendiente.
- El contador de Comunicaciones en la matriz ya se calcula por vínculo, con
  fallback para casos legacy.

## 6. Runbook para producción

No ejecutar `prisma migrate dev` en producción.

1. Respaldar la base de datos y registrar el estado de los índices.
2. Aplicar las migraciones pendientes con `npx prisma migrate deploy`.
3. Verificar que ya no exista el índice único por nombre.
4. Ejecutar un dry-run de conciliación de casos legacy y de vínculos sin caso.
5. Revisar los casos ambiguos: mismo nombre en más de un vínculo.
6. Crear los casos faltantes copiando estado, resultado, revisor, comentario, link y
   fechas del caso existente; registrar auditoría.
7. Verificar que cada `vinculo_id` tenga como máximo un caso y que no se haya perdido
   ningún caso legacy.
8. Recién después desplegar el código que derive por vínculo.

La migración no recrea los casos omitidos por el índice viejo. Esa reparación es un
paso de datos separado y requiere dry-run.

### 6.1 Normalización de estados y resultados reputacionales para producción

**Importante:** producción puede tener estados y resultados del flujo anterior. La
versión nueva no debe asumir que todos los registros ya usan `ACEPTADO`/`OBSERVADO`.

Estados históricos que pueden existir en `debida_diligencia_reputacion.estado`:

- `por_revisar`
- `en_analisis`
- `sin_hallazgos`
- `con_hallazgos`
- `requiere_informacion`
- `cerrada`

Resultados históricos que pueden existir en `debida_diligencia_reputacion.resultado`
o `dd_matriz_vinculo.rep_resultado`:

- `sin_hallazgos`
- `con_hallazgos`
- `requiere_informacion`
- `sin_observaciones`
- `observado`
- `requiere_debida_diligencia`
- `en_revision`

La UI ya normaliza los valores legacy para mostrar solo `ACEPTADO`/`OBSERVADO` en
Comunicaciones, pero **eso no reemplaza la migración de datos**. Los valores antiguos
siguen existiendo en la base hasta que se ejecute el proceso de conciliación.

Antes de desplegar:

1. Ejecutar un inventario y dry-run por estado y resultado, incluyendo casos legacy
   (`vinculo_id = NULL`) y filas de matriz con `rep_*` antiguos.
2. Aprobar el mapeo con negocio:
   - `sin_hallazgos` / `sin_observaciones` → resultado `ACEPTADO`;
   - `con_hallazgos` / `observado` → resultado `OBSERVADO`;
   - `requiere_debida_diligencia` → resultado `OBSERVADO` y, si corresponde,
     conclusión `REQUIERE DEBIDA DILIGENCIA REFORZADA`;
   - `requiere_informacion` / `en_revision` → dejar en revisión/pendiente;
     no inventar un resultado final.
3. Normalizar `estado`:
   - `por_revisar` y `en_analisis` se conservan;
   - `cerrada` se conserva;
   - `sin_hallazgos` / `con_hallazgos` / `requiere_informacion` se migran al nuevo
     resultado y a `cerrada` solo si negocio confirma que el caso ya terminó.
4. Sincronizar `repResultado`/`repConclusion` en `DdMatrizVinculo` con el mismo
   criterio y conservar auditoría.
5. Verificar que un vínculo no tenga más de un caso, que los legacy sin match sigan
   visibles y que no se hayan creado duplicados al derivar.
6. Ejecutar un smoke test en `/reputacion` y `/matriz` con al menos un caso de cada
   valor histórico.

No copiar texto libre del Excel ni ejecutar esta normalización sin respaldo,
dry-run y aprobación funcional. La compatibilidad de lectura no debe confundirse con
la migración definitiva.

### 6.2 Compatibilidad con decisiones y estados legacy

Producción conserva expedientes en estados antiguos. El inventario local de referencia
mostró: `aprobada` (508), `en_revision` (84), `rechazada` (12), `observada` (6),
`en_legal` (1) y `borrador` (1). También hay casos reputacionales con estados
`sin_hallazgos`, `con_hallazgos`, `requiere_informacion` y `cerrada`.

Reglas de compatibilidad obligatorias:

- No eliminar ni renombrar `DD_ESTADOS`, `DD_ACCIONES_REVISION` ni
  `DD_ACCIONES_LEGAL`.
- Mantener el endpoint legacy `revisar` con las acciones `aprobar`, `observar` y
  `rechazar`; la bandeja antigua lo sigue usando.
- `DOCUMENTACIÓN OBSERVADA` reutiliza `observada`; no crea un estado nuevo.
- `APROBADA`, `OBSERVADA`, `RECHAZADA`, `EN_LEGAL` y `EN_REVISION` deben seguir
  mostrándose y operando; la matriz no debe asumir que todo expediente tiene
  `dd_matriz_vinculo.resultado_final`.
- Mientras no exista backfill, la UI debe usar el estado del expediente como respaldo
  cuando `resultadoFinal` esté vacío:
  - `aprobada` → `APTO`;
  - `observada` → `DOCUMENTACIÓN OBSERVADA`;
  - `rechazada` → `NO APTO`;
  - `en_legal` / `en_revision` → pendiente de decisión.
- `Marcar APTO` y el cierre automático de la matriz no reemplazan la acción legacy
  `aprobar`: si se usan como decisión final, deben ejecutar también la transición del
  expediente (`APROBADA`, fechas, notificación e historial) o limitarse a registrar
  el resultado de la matriz con una etiqueta explícita.
- `Derivar a Legal` debe seguir usando el flujo existente con motivo e informe.
- Los casos legacy de Comunicaciones se resuelven por `vinculo_id = NULL` y nombre,
  sin borrar sus resultados.
- La validación de `aprobar` en `revisar` todavía compara resultados antiguos
  (`sin_hallazgos` / `sin_observaciones`). Antes de conectar el APTO nuevo se debe
  normalizar `aceptado` y `observado`; de lo contrario, un caso nuevo cerrado como
  `aceptado` sería rechazado como pendiente.
- La equivalencia buscada es: `Aprobar` → `APTO`, `Solicitar correcciones` →
  `DOCUMENTACIÓN OBSERVADA`; `Derivar a Legal` sigue siendo una acción separada de
  la matriz.

Antes de producción se debe ejecutar un dry-run que compare, para cada expediente, el
estado legacy contra `dd_matriz_vinculo.resultado_final` y reporte diferencias. El
backfill debe copiar los valores, no reinterpretar estados masivamente. Si un
expediente está `aprobada`, no se debe cambiar a otro estado solo por desplegar la
nueva matriz.

### 6.3 Flujo Legal legacy y transición a la matriz

**Derivación actual:** la acción `Derivar a Legal` de la matriz usa el endpoint legacy
`revisar` con `accion = rechazar`, motivo e informe de Logística. Deja el expediente
en `en_legal`, crea una observación de área Legal, registra historial/auditoría y
notifica a Legal. La bandeja `/dashboard/debida-diligencia/legal` lista exactamente
los expedientes `en_legal`.

**Decisiones de Legal en `/legal`:**

| Decisión | Estado resultante | Efecto |
|---|---|---|
| Aprobar | `en_revision` | Legal aprueba y devuelve el expediente a Logística/SIG para la decisión final. No aprueba directamente al cliente. |
| Observar | `observada` | Crea observaciones de Legal, marca documentos y notifica al cliente para que subsane y reenvíe. |
| Rechazar | `rechazada` | Exige informe legal PDF y motivo; notifica al cliente y cierra el rechazo. |

El modal legal actual (`DdLegalModal`) ya implementa esas tres decisiones mediante
`resolverLegal`. No hay que eliminar ese flujo.

**Brechas nuevas:**

- `resolverLegal` actualiza el expediente, pero **no actualiza las columnas legales
  de la matriz** (`cmpResultado` / `cmpConclusion`).
- La matriz todavía permite abrir `DdRevisionModal` desde el detalle del vínculo sin
  `onResultadoFinal`; en esa variante reaparecen las decisiones legacy, incluida
  `Derivar a Legal`. Hay que ocultarlas ahí si la derivación debe ser solo desde la
  barra de la matriz.
- El APTO final sigue pendiente de conectar con la transición legacy `aprobada`.
- La aprobación de Legal no es una aprobación final: deja el expediente en
  `en_revision`. Logística o el cierre final de la matriz debe registrar el APTO.

**Flujo objetivo:**

1. La matriz selecciona uno o más expedientes y usa **Derivar a Legal**.
2. Se registra motivo e informe de Logística y el expediente pasa a `en_legal`.
3. Legal trabaja desde `/legal` y decide aprobar, observar o rechazar.
4. Aprobar devuelve a Logística/SIG, no cierra la DD.
5. Observar notifica al cliente y permite subsanación.
6. Rechazar cierra la DD y notifica al cliente.
7. La matriz refleja el resultado legal y la conclusión final del expediente en una
   sola operación, sin duplicar decisiones.

Regla de compatibilidad: mantener `resolverLegal` y `revisar` para los expedientes
antiguos; si se oculta la derivación legacy en la UI, no eliminar el endpoint ni los
estados existentes.

Implementación aplicada:

- `resolverLegal` sincroniza `cmpResultado`, `cmpConclusion`, `cmpObservaciones`,
  `cmpResponsable` y `cmpFecha` en la fila de empresa de la matriz.
- Aprobar Legal deja el expediente en `en_revision`.
- Observar Legal deja `observada` y conserva la conclusión legal `ACEPTADO CON
  OBSERVACIONES`.
- Rechazar Legal deja `rechazada`, actualiza la conclusión legal a `RECHAZADO` y
  registra el resultado final `NO APTO`.
- La opción **Derivar a Legal** se retiró del modal legacy; la derivación queda
  únicamente como acción de la matriz.

### 6.4 Responsabilidades por área (según transferencia de conocimiento)

- **Comunicaciones**: entrega resultado/observación y fuente. No define la
  conclusión. SIG evalúa si la observación es suficiente.
- **SIG/Logística**: define la conclusión SIG y la conclusión reputacional, y
  consolida el resultado final del expediente (`APTO`, `APTO CON OBSERVACIONES`,
  `DOCUMENTACIÓN OBSERVADA`, `NO APTO`, `SIN RESPUESTA`).
- **Legal**: solo interviene en casos derivados por debida diligencia reforzada.
  Emite una decisión legal (`aprobar`, `observar`, `rechazar`) con informe y
  comentario. Su decisión no puede ser reinterpretada por SIG:
  - `rechazar` cierra la DD como `NO APTO`;
  - `observar` deja el expediente `OBSERVADA` y notifica al cliente;
  - `aprobar` devuelve el expediente a Logística/SIG; no es un APTO final.
- La **conclusión final** es del expediente; la matriz solo la refleja y no debe
  tener una conclusión final independiente por vínculo.

## 7. Pendientes

- Backfill general de casos legacy (`vinculo_id = NULL`).
- Inventario y normalización de estados reputacionales antiguos
  (`sin_hallazgos`, `con_hallazgos`, `requiere_informacion`) en producción.
- Normalización de resultados reputacionales antiguos al nuevo par resultado/conclusión.
- Mantener compatibilidad de lectura para valores legacy hasta completar el backfill.
- Conciliación automática o asistida para casos legacy sin coincidencia de nombre.
- Evitar duplicados al derivar sobre expedientes que aún tengan casos legacy.
- Pruebas de regresión para nombres repetidos en dos vínculos.
- Aplicar en producción las migraciones 117, 118, 119 y 120 después del respaldo.
- Verificar en `/reputacion` y `/matriz/[id]` el flujo
  `resultado de Comunicaciones → conclusión SIG → conclusión final del expediente`.
- Definir si `Marcar APTO` de la matriz ejecutará también la transición legacy
  `aprobada` o solo registrará el resultado de matriz.
- Ejecutar el dry-run de diferencias entre `debida_diligencia.estado` y
  `dd_matriz_vinculo.resultado_final` antes del despliegue.

## 8. Referencias de código

- `src/application/debida-diligencia/debida-diligencia-service.ts`
- `src/infrastructure/persistence/debida-diligencia-repository.ts`
- `src/infrastructure/persistence/dd-matriz-evaluacion-repository.ts`
- `src/components/debida-diligencia/dd-reputacion.tsx`
- `src/components/debida-diligencia/dd-matriz-bandeja.tsx`
- `src/components/debida-diligencia/dd-matriz-decision-vinculo.tsx`
- `src/components/debida-diligencia/dd-revision-matriz-tab.tsx`
- `src/controllers/debida-diligencia.controller.ts`
- `src/domain/ports/debida-diligencia-repository.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20261115180000_dd_reputacion_por_vinculo/migration.sql`
- `prisma/migrations/20261115190000_drop_reputacion_nombre_unique/migration.sql`
- `prisma/migrations/20261115200000_add_dd_maestra/migration.sql`
## 9. Historial de cambios

### 2026-11-15

- Se aplicó la migración de dictamen reputacional por vínculo.
- Se corrigió el índice antiguo por nombre que omitía casos repetidos.
- Se reparó FEJUCY y se documentó el incidente.
- Se agregó el catálogo maestro `dd_maestra` y su seed.

### 2026-11-16

- Comunicaciones pasó a registrar resultado (`ACEPTADO`/`OBSERVADO`),
  observación y fuente.
- SIG/Logística define la conclusión reputacional en el modo edición del vínculo.
- La conclusión final quedó únicamente a nivel expediente.
- Se eliminaron botones de conclusión final del detalle del vínculo.
- Se corrigió el contador de Comunicaciones para que sea por vínculo.
- Se ajustó la UI de estados de Comunicaciones a una secuencia lineal.
- Se documentó el runbook de normalización para producción y el checklist de
  despliegue de la sección 10.
- Se agregó compatibilidad visual para estados/resultados legacy de Comunicaciones;
  la migración definitiva de datos sigue pendiente para producción.
- `DOCUMENTACIÓN OBSERVADA` desde la matriz ahora reutiliza el estado `OBSERVADA`:
  registra observaciones, documentos a subsanar y notifica al cliente.
## 10. Checklist de despliegue a producción

> **Estado:** despliegue no habilitado todavía. Antes de publicar hay que resolver
> el puente de APTO y ejecutar el dry-run/backfill de datos legacy.

### 10.1 Bloqueos antes de desplegar

1. **APTO desde la matriz**: hoy solo escribe `dd_matriz_vinculo.resultado_final`.
   No ejecuta la transición legacy a `aprobada` ni la notificación al cliente.
   Definir si se conecta a `revisar({ accion: APROBAR })` o si se mantiene como
   registro interno; en ambos casos debe quedar explícito en la UI.
2. **Validación legacy de `aprobar`**: `revisar` todavía compara resultados antiguos
   (`sin_hallazgos` / `sin_observaciones`). Debe normalizar `aceptado`/`observado`
   antes de cualquier aprobación nueva.
3. **Backfill pendiente**: 508 expedientes `aprobada`, 84 `en_revision`, 12
   `rechazada`, 6 `observada` y 1 `en_legal` en la referencia local; no asumir que
   producción es igual, pero sí que habrá una mayoría de estados legacy.
4. **Casos reputacionales legacy**: `vinculo_id = NULL`, resultados antiguos y
   duplicados por nombre deben revisarse con dry-run.
5. **Labels de matriz**: la matriz todavía usa `DD_MATRIZ_*_LABELS` de constantes;
   cambiar solo `dd_maestra.nombre` no cambia toda la UI.

### 10.2 Respaldo y ventana

1. Ejecutar respaldo completo de la base de datos y verificar restauración.
2. Guardar la definición de índices y constraints:
   ```sql
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename IN (
     'debida_diligencia',
     'debida_diligencia_reputacion',
     'dd_matriz_vinculo',
     'dd_maestra'
   );
   ```
3. Congelar cambios de datos de DD durante la migración y el backfill.
4. Tener disponible la versión anterior del contenedor/aplicación.

### 10.3 Migraciones

No ejecutar `prisma migrate dev` en producción.

```bash
npx prisma migrate deploy
```

Migraciones esperadas:

- `20261115170000_add_dd_vinculos_completos`
- `20261115180000_dd_reputacion_por_vinculo`
- `20261115190000_drop_reputacion_nombre_unique`
- `20261115200000_add_dd_maestra`

Después de aplicar:

```sql
-- Debe existir la unicidad por vínculo.
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'debida_diligencia_reputacion';

-- No debe existir el índice viejo por nombre.
SELECT indexname
FROM pg_indexes
WHERE indexname = 'debida_diligencia_reputacion_expediente_id_nombre_a_revisar_key';
```

La migración no repara casos omitidos por el índice viejo. La reparación es un
procedimiento de datos separado y auditado.

### 10.4 Catálogo dd_maestra

`npm run db:seed` ejecuta el seed completo y está bloqueado en producción. No usarlo
para este despliegue.

Cargar/actualizar únicamente los catálogos DD con un upsert controlado a partir de
`DD_MAESTRA_SEED` (52 filas), sin tocar usuarios, roles ni planos:

- `expediente_estado`
- `reputacion_estado`
- `reputacion_resultado`
- `matriz_resultado`
- `matriz_conclusion`
- `matriz_resultado_final`
- `matriz_tipo_vinculo`
- `documento_estado`
- `estado_evaluacion`
- `estado_relacion`

Verificar:

```sql
SELECT tipo, count(*)
FROM dd_maestra
GROUP BY tipo
ORDER BY tipo;
```

No borrar filas ni cambiar `codigo`; solo se permite ajustar `nombre`, `orden`,
`descripcion` y `activo`.

### 10.5 Dry-run obligatorio

Ejecutar y adjuntar resultados antes de modificar datos:

```sql
-- 1. Inventario de estados.
SELECT estado, count(*) FROM debida_diligencia GROUP BY estado ORDER BY count(*) DESC;

-- 2. Casos reputacionales legacy y sus resultados.
SELECT estado, resultado, count(*)
FROM debida_diligencia_reputacion
GROUP BY estado, resultado
ORDER BY estado, resultado;

-- 3. Duplicados por expediente + nombre.
SELECT expediente_id, nombre_a_revisar, count(*) AS total,
       array_agg(COALESCE(vinculo_id::text, 'LEGACY')) AS vinculos,
       array_agg(estado) AS estados
FROM debida_diligencia_reputacion
GROUP BY expediente_id, nombre_a_revisar
HAVING count(*) > 1;

-- 4. Filas de matriz sin resultado final pero con expediente ya cerrado.
SELECT e.codigo, e.estado, v.nombre, v.resultado_final
FROM debida_diligencia e
JOIN dd_matriz_vinculo v ON v.expediente_id = e.id AND v.tipo = 'empresa'
WHERE v.resultado_final IS NULL
  AND e.estado IN ('aprobada', 'observada', 'rechazada');

-- 5. Resultados reputacionales antiguos en matriz.
SELECT rep_resultado, rep_conclusion, count(*)
FROM dd_matriz_vinculo
GROUP BY rep_resultado, rep_conclusion
ORDER BY count(*) DESC;

-- 6. Casos vinculados a vínculos inexistentes.
SELECT r.id, r.vinculo_id
FROM debida_diligencia_reputacion r
LEFT JOIN dd_matriz_vinculo v ON v.id = r.vinculo_id
WHERE r.vinculo_id IS NOT NULL AND v.id IS NULL;
```

Revisar manualmente los casos ambiguos: mismo nombre en representante y
beneficiario, casos legacy sin match y expedientes con más de una fila de empresa.

### 10.6 Backfill de datos

Orden recomendado:

1. Conciliar casos legacy (`vinculo_id = NULL`) con la fila de matriz correcta.
2. No borrar casos legacy hasta validar el match.
3. Normalizar resultados reputacionales con el mapeo aprobado en 6.1.
4. Copiar `repResultado`, `repConclusion`, observaciones, responsable y fecha a la
   fila de matriz cuando corresponda.
5. Backfill de `resultado_final` desde el estado legacy:
   - `aprobada` → `APTO`;
   - `observada` → `DOCUMENTACIÓN OBSERVADA`;
   - `rechazada` → `NO APTO`;
   - `en_legal` / `en_revision` → no inventar un final.
6. No cambiar `debida_diligencia.estado` durante el backfill salvo que negocio lo
   apruebe explícitamente.
7. Registrar auditoría de cada ajuste y guardar el script/consulta utilizado.

Si un expediente ya tiene `resultado_final`, no sobrescribirlo sin revisión.

### 10.7 Despliegue de la aplicación

1. Aplicar migraciones.
2. Ejecutar backfill aprobado.
3. Desplegar la versión nueva.
4. Verificar que las lecturas legacy sigan funcionando antes de retirar cualquier
   compatibilidad.

La versión nueva mantiene compatibilidad de lectura para:

- casos reputacionales legacy por nombre;
- resultados antiguos de Comunicaciones;
- filas de matriz sin `resultado_final`;
- decisiones legacy de `revisar`.

### 10.8 Smoke test en producción

Probar con un expediente legacy aprobado, uno observado, uno en revisión y uno con
Comunicaciones:

- `/dashboard/debida-diligencia/reputacion`
  - listado por estados y fechas;
  - inicio de revisión;
  - guardar borrador;
  - cerrar revisión y enviar a SIG;
  - caso legacy visible sin duplicados.
- `/dashboard/debida-diligencia/matriz`
  - resultado y conclusión de Comunicaciones;
  - estado `Pendiente dictamen SIG`;
  - `Revisar expediente`;
  - `DOCUMENTACIÓN OBSERVADA`: estado `observada`, observaciones y correo;
  - `Derivar a Legal`: motivo, informe y estado `en_legal`;
  - APTO: verificar si actualiza o no el expediente según la decisión tomada.
- `/dashboard/debida-diligencia/matriz/[id]`
  - resultado de Comunicaciones visible;
  - conclusión SIG editable;
  - no se expone la conclusión final del expediente.

Verificar auditoría:

```sql
SELECT entidad, actor, mensaje, created_at
FROM audit_log
WHERE entidad LIKE 'debida_diligencia%'
ORDER BY created_at DESC
LIMIT 30;
```

### 10.9 Rollback

- Si falla la aplicación, volver a la imagen anterior.
- Las migraciones son principalmente aditivas; no revertirlas manualmente sin
  revisar el estado de los índices.
- No recrear el índice único por nombre si existen duplicados: fallará.
- Si hay corrupción de datos, restaurar el respaldo completo y volver a ejecutar el
  backfill aprobado.
- Documentar cualquier diferencia entre `debida_diligencia.estado` y
  `dd_matriz_vinculo.resultado_final` antes de reintentar.

### 10.10 Monitoreo posterior

- Errores de `/api/debida-diligencia/*`.
- Correos de `expedienteObservado` y cambios inesperados de estado.
- Casos con `resultado_final` distinto al estado legacy.
- Casos reputacionales duplicados por expediente/nombre.
- Filas de matriz sin conclusión reputacional cuando el expediente ya está aprobado.
- Crecimiento de casos `por_revisar` después de una derivación.
