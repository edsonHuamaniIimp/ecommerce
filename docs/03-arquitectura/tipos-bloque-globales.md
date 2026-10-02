# Tipos de bloque globales (transversalidad)

Estrategia para que los tipos de bloque del Laboratorio 3D dejen de ser copias por mapa
y pasen a un catálogo transversal, sin perder los datos existentes.

## Problema

Hoy los tipos viven por mapa: `plano_tipo_bloque.plano_id` con `@@unique([planoId, codigo])`.
Un mapa nuevo arranca sin tipos y el editor los ofrece solo como sugerencia
(`GET /api/planos/tipos-sugeridos`) o mediante el botón "Traer tipos de otros mapas".
En producción ya existen tipos y bloques creados; cualquier cambio debe ser no destructivo.

## Modelo de datos relevante

- `plano_tipo_bloque`: tipo por mapa (codigo, label, nombre, W/D/H, color, ambito, flg_activo).
- `plano_bloque`: bloque de un mapa; guarda `tipo_id` (FK al tipo del mapa), `tipo_codigo`
  (redundante) y `bloque_id` (clave de vínculo con `gess_stand.bloqueId`).
- El render del visor y el export TypeScript resuelven el tipo por `tipo_codigo`.

## Fases

### Fase 1 — Catálogo global aditivo (implementada en local)

- Tabla nueva `tipo_bloque_global` (modelo Prisma `TipoBloqueGlobal`), `codigo` único.
- Migración `0027_add_tipo_bloque_global`: crea la tabla y hace backfill desde
  `plano_tipo_bloque` agrupando por `UPPER(BTRIM(codigo))`.
  - Gana la variante activa con más bloques asignados; empates por `id` (determinista).
  - `INSERT ... ON CONFLICT ("codigo") DO NOTHING` → idempotente.
- No se altera ninguna tabla existente: cero `UPDATE`/`DELETE` sobre `plano_tipo_bloque`
  ni `plano_bloque`.
- Interruptor de lectura: `TIPOS_BLOQUE_GLOBALES.USAR_CATALOGO` (`src/lib/shared/constants.ts`).
  Con `false` (valor actual) la lectura sigue siendo por mapa; con `true`,
  `listarTiposSugeridos` lee del catálogo.
- Reporte de conflictos: `npm run tipos:conflictos` lista códigos con medidas/color/ámbito
  distintos entre mapas y qué variante quedó en el catálogo.

### Fase 2 — Lectura/escritura sobre el catálogo (implementada en local, tras flag)

- Lecturas: `detalle`/`detallePorCodigo` (editor, visor público y export) devuelven los tipos
  del catálogo global cuando el flag está activo, mapeados con el `planoId` consultado.
  El listado de planos muestra el conteo global de tipos activos.
- Escrituras: `guardar-tipos` y `guardar-layout` siguen escribiendo la tabla por mapa
  (respaldo y FK `plano_bloque.tipo_id`) y además sincronizan el catálogo:
  - Alta/actualización por código normalizado (`UPPER(BTRIM(codigo))`).
  - Baja lógica de códigos activos que desaparecen del payload solo si no tienen bloques
    en ningún mapa; si están en uso quedan bloqueados (no se desactivan).
  - Marcar inactivo un tipo con uso global también queda bloqueado.
  - La lógica pura vive en `planSincronizacionCatalogo` (`src/lib/shared/utils/catalogo-tipos.ts`)
    con tests unitarios.
- Activación: `TIPOS_BLOQUE_GLOBALES.USAR_CATALOGO` se controla con env
  `TIPOS_BLOQUE_GLOBALES=1` (default `false`). En local se validó con el flag activo:
  lectura cruzada entre mapas, alta propagada al instante y baja lógica sin uso.
- Rollback: quitar la env (o revertir deploy). Las tablas por mapa siguen íntegras y
  alimentadas, por lo que la lectura vieja no pierde nada.
- `plano_bloque.tipo_codigo` se mantiene como clave de render: visor, export TS y GESS
  no cambian de contrato.

Nota: `guardar-layout` (botón Guardar del editor) no elimina tipos del catálogo ni reasigna
códigos por sí solo; la sincronización ocurre sobre los tipos que envía el editor.

### Fase 3 — Contraer

- Backfill de `plano_bloque.tipo_id` al id global por código y retiro de `plano_tipo_bloque`
  cuando el catálogo esté validado en producción.

## Garantías y verificación

- Migraciones solo aditivas; el backfill puede re-ejecutarse sin duplicar filas.
- Verificación local Fase 1 ejecutada: tipos por mapa = códigos únicos = catálogo global,
  conteo de bloques sin cambios y segunda corrida del backfill sin inserciones nuevas.
- Verificación local Fase 2 con `TIPOS_BLOQUE_GLOBALES=1`: un mapa sin tipos propios lee los 5
  del catálogo; el alta de un tipo en un mapa de prueba se reflejó al instante en otro;
  la baja sin uso quedó `flgActivo=false`; limpieza final con el catálogo y los 58 bloques intactos.
- Guard anti-drift del CI replicado en local: `No difference detected`.
- Rollback: revertir el deploy y/o quitar la env; las tablas originales permanecen
  intactas. En Fase 1 ninguna FK apunta a la tabla nueva.
- Suite completa: 317 tests en verde, `tsc` y eslint sin errores.

## Riesgos pendientes

- Conflictos de medidas entre mapas para un mismo código (resueltos en Fase 1 por uso,
  listados por el script). En Fase 2 conviene revisar el reporte antes de activar.
- Códigos guardados con distinto casing/espacios: la normalización del catálogo es
  `UPPER(BTRIM(codigo))`; el editor ya normaliza al crear.
