# Debida Diligencia - Estrategia de dictamen reputacional por vínculo

> **Fecha:** 2026-11-15
> **Rama de trabajo:** `feature/dd-v2`
> **Estado:** migraciones 118 y 119 aplicadas en local; backend y UI adaptados. Pendiente dry-run/backfill general y despliegue en producción. Ver [`23-dd-bitacora.md`](./23-dd-bitacora.md).
> **Referencias:** `prisma/schema.prisma`, `20261115180000_dd_reputacion_por_vinculo`, `docs/01-funcional/20-debida-diligencia-post-lanzamiento.md`.

## 1. Hallazgo

En `main` y `qa` el modelo reputacional siempre se almacenó por:

```text
expediente_id + nombre_a_revisar
```

La UI muestra el caso como "Vínculo evaluado", pero no existe `vinculo_id` en
`debida_diligencia_reputacion`. Por eso:

- el mismo nombre en dos filas de matriz se unifica en un solo caso;
- no se puede emitir un dictamen distinto para representante y beneficiario si
  comparten nombre;
- al agregar un nuevo vínculo con un nombre ya existente no se crea un caso nuevo.

La decisión funcional es avanzar a **un dictamen por fila de matriz**
(`DdMatrizVinculo`), sin perder los casos históricos.

## 2. Modelo objetivo

`DebidaDiligenciaReputacion` conserva el nombre para presentación, pero agrega:

```text
vinculo_id TEXT NULL
  -> dd_matriz_vinculo.id
```

Reglas:

- Un caso nuevo debe tener `vinculo_id`.
- `vinculo_id = NULL` identifica un caso legacy derivado por expediente/nombre.
- La unicidad nueva es `(expediente_id, vinculo_id)`.
- Los casos legacy mantienen unicidad por `(expediente_id, nombre_a_revisar)`
  mediante un índice parcial.
- Eliminar un vínculo deja el caso con `vinculo_id = NULL` (`ON DELETE SET NULL`);
  no se borra el historial.

## 3. Migración creada

Archivo:

`prisma/migrations/20261115180000_dd_reputacion_por_vinculo/migration.sql`

Incluye:

1. Agregar `vinculo_id TEXT NULL`.
2. Eliminar la restricción única anterior
   `(expediente_id, nombre_a_revisar)`.
3. Crear índice único `(expediente_id, vinculo_id)`.
4. Crear índice único parcial para legacy
   `(expediente_id, nombre_a_revisar) WHERE vinculo_id IS NULL`.
5. Crear índice por `vinculo_id`.
6. Crear FK hacia `dd_matriz_vinculo(id)` con `ON DELETE SET NULL`.

Se usó `TEXT`, no `UUID`, porque los IDs existentes de `dd_matriz_vinculo` son
`text` en la base actual.

La migración fue aplicada en local. En producción debe aplicarse en una ventana
controlada y después ejecutar el backfill.

### Implementación actual del código

- `derivarComunicaciones` acepta `vinculoIds` opcional.
- La bandeja envía los IDs de las filas seleccionadas.
- El modal del expediente mantiene la derivación de todos los vínculos.
- `reputacionResolver` sincroniza `repResultado` y `repConclusion` en la matriz.
- `/reputacion` muestra tipo y documento del vínculo; los casos antiguos aparecen como legacy.
- El backfill de producción sigue pendiente.

## 4. Compatibilidad con producción

No se requiere rollback de `main` ni `qa`. La estrategia es evolutiva:

1. La columna nueva es nullable.
2. Los casos existentes quedan con `vinculo_id = NULL` y siguen siendo visibles.
3. El código antiguo que derive por expediente sigue funcionando.
4. Los casos nuevos pueden crearse por vínculo.
5. El bloqueo estricto de APTO se activa recién después del backfill.

## 5. Backfill de casos históricos

No asignar automáticamente sin auditar. Ejecutar primero un dry-run:

### 5.1 Dry-run

Para cada caso legacy:

- normalizar `nombre_a_revisar`;
- buscar filas de `dd_matriz_vinculo` del mismo expediente con el mismo nombre
  normalizado;
- clasificar:
  - **único:** un solo vínculo coincide;
  - **múltiple:** más de un vínculo coincide;
  - **sin match:** no existe vínculo compatible.

Reportar conteos y ejemplos por expediente.

### 5.2 Asignación

- **Único:** asignar `vinculo_id`.
- **Múltiple:** duplicar el caso por cada vínculo, copiando estado, resultado,
  comentario, link, revisor, fechas y auditoría; agregar una marca de migración.
- **Sin match:** mantener `vinculo_id = NULL` y marcarlo como legacy para revisión
  manual.

No duplicar automáticamente casos con hallazgos sin aprobación de negocio, porque
cambia el histórico de Comunicaciones.

### 5.3 Verificación

- Todos los casos nuevos tienen `vinculo_id`.
- No se perdió ningún caso legacy.
- La suma de casos duplicados coincide con el reporte del dry-run.
- Cada vínculo tiene como máximo un caso.
- Los índices y FK existen.

## 6. Adaptación de backend

### 6.1 Derivación

Contrato compatible:

```text
POST /api/debida-diligencia/derivar-comunicaciones
{
  expedienteId: string,
  vinculoIds?: string[]
}
```

Comportamiento:

- Sin `vinculoIds`: compatibilidad con el flujo actual por expediente.
- Con `vinculoIds`: derivar solo las filas seleccionadas.
- Crear un caso por `vinculoId`.
- Idempotencia por `(expedienteId, vinculoId)`.
- Mantener la declaración `vinculosCompletos`. La evaluación SIG no bloquea la
  derivación; se valida la presencia de todos los vínculos en la matriz.

### 6.2 Resolución

- `reputacionObservar` registra el resultado (`ACEPTADO` u `OBSERVADO`),
  observaciones y fuentes de Comunicaciones, actualiza el estado del caso y
  refleja `repResultado`/`repObservaciones` en `DdMatrizVinculo`.
- La conclusión reputacional (`repConclusion`) la registra SIG desde
  `/matriz/[id]`, en modo edición.
- Ambas operaciones actualizan el caso por `id` y la matriz por `vinculoId`.
- El endpoint legacy `reputacionResolver` queda por compatibilidad, pero la UI de
  Comunicaciones ya no lo usa.

### 6.3 Nuevo vínculo

Al agregar o sincronizar un vínculo nuevo:

- marcar `vinculosCompletos = false`;
- crear un caso pendiente o exigir una nueva derivación;
- invalidar un `APTO` previo;
- volver a `EN REVISIÓN` o `DOCUMENTACIÓN OBSERVADA`;
- impedir el cierre hasta que el nuevo vínculo tenga SIG, Comunicaciones y
  decisión final.

## 7. Adaptación de UI

- `/reputacion` debe mostrar el vínculo real: tipo, nombre y documento.
- Los casos con `vinculo_id = NULL` deben mostrarse como **Legacy / expediente**.
- La bandeja de matriz debe enviar los IDs de las filas seleccionadas.
- El modal del expediente puede mantener "derivar todos", enviando sin
  `vinculoIds`.
- La confirmación debe indicar si deriva uno, varios o todos los vínculos.

## 8. Rollout

### Fase 1 - Preparación

- Aplicar migración.
- Desplegar código que lee y escribe `vinculo_id` de forma opcional.
- Mantener el flujo legacy sin cambios.

### Fase 2 - Auditoría y backfill

- Ejecutar dry-run.
- Revisar casos múltiples y sin match.
- Ejecutar backfill con respaldo previo.
- Verificar índices y conteos.

### Fase 3 - Activación

- Cambiar la derivación de bandeja para enviar `vinculoIds`.
- Activar validación estricta por vínculo.
- Invalidar APTO al agregar vínculos nuevos.
- Activar visualización de vínculo en `/reputacion`.

## 9. Rollback

No se recomienda un rollback destructivo de la migración.

- Los cambios de código pueden revertirse mientras no se active la derivación por
  vínculo.
- La columna y los índices pueden quedar en la base sin afectar el flujo legacy.
- Si hay que revertir la unicidad, restaurar desde respaldo y ejecutar una migración
  correctiva; no usar `prisma migrate reset`.
- Mantener respaldo de `debida_diligencia_reputacion` antes del backfill.

## 10. Criterios de aceptación

- Un representante y un beneficiario con el mismo nombre generan dos casos
  independientes.
- Cada caso se resuelve contra su `vinculoId`.
- El dictamen actualiza la fila correcta de matriz.
- Los casos históricos siguen visibles como legacy.
- Un vínculo nuevo obliga a reabrir la evaluación y bloquea un APTO previo.
- La derivación por expediente sigue funcionando para clientes antiguos.
- No se duplican casos al reintentar la derivación del mismo vínculo.
- Tests cubren: único match, múltiples matches, sin match, reintento, nuevo vínculo
  y resolución por vínculo.

