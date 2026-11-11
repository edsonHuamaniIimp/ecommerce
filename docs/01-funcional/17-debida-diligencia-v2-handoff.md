# Debida Diligencia V2 — Handoff de sesión (2026-11-06)

> Documento de traspaso para la sesión de trabajo dedicada a DD en el worktree
> `C:\Proyectos\IIMP\ContratosStands-dd-v2` (branch `feature/dd-v2`).
> Resume el ambiente creado, lo implementado, las fuentes de verdad y los próximos pasos.

## 1. Ambiente (ya creado y funcionando)

| Elemento | Valor |
|---|---|
| Branch | `feature/dd-v2` (desde `qa`, base `8a92319`) |
| Worktree | `C:\Proyectos\IIMP\ContratosStands-dd-v2` |
| Base de datos | `contratos_dd` (copia de `contratos_stands`) en el contenedor `ctrst-db`, puerto 5433 |
| Puerto app | `3008` (`npm run dev:dd` / `npm run start:dd`) |
| Env | `.env` propio del worktree (no versionado) apuntando a `contratos_dd` |

Comandos útiles:

```powershell
# Levantar el ambiente DD (puerto 3008)
npm run dev:dd

# Ver la BD (mismo contenedor Postgres, database distinta)
docker exec -it ctrst-db psql -U ctrst -d contratos_dd

# Estado de migraciones
npx prisma migrate status

# Pruebas
npx vitest run
```

Reglas del ambiente:

- **No hacer merge a `qa`** hasta terminar DD.
- Migraciones **aditivas** y del contexto DD (tablas `dd_*`); no tocar tablas core en la
  misma migración.
- DD solo escribe en sus tablas; lee entidades core por puertos.
- Nunca ejecutar `db:reset` ni `db push --accept-data-loss` contra `contratos_stands`.

## 2. Commits en `feature/dd-v2`

- `cc82269` — chore(ambiente): segundo ambiente DD v2 (puerto 3008, BD contratos_dd).
- `2fe2359` — merge de `qa` con los docs de DD (alcance, navegación, actividades).
- `0f8c35e` — feat(dd): modelo v2 de relación comercial, evidencias y tipo de vínculo de personas.

Sin push al remoto.

## 3. Fuentes de verdad (leer antes de codificar)

- `docs/01-funcional/11-debida-diligencia.md` — implementación DD v1 vigente.
- `docs/01-funcional/14-debida-diligencia-v2-alcance.md` — **alcance definitivo V2**
  (actores, permisos, rutas, términos, modelo objetivo, matriz 54 columnas, evidencias,
  plazos, inventario de 23 vistas, decisiones cerradas y pendientes).
- `docs/01-funcional/15-debida-diligencia-navegacion.md` — matriz de navegación y conexiones.
- `docs/01-funcional/16-debida-diligencia-actividades.md` — diagrama de actividades.
- Transcript de la reunión con la dueña del proceso (27/10/2026).
- Excel oficial de la matriz: `MATRIZ EVALUACIÓN DE DEBIDA DILIGENCIA actualizado_Vsist (1).xlsx`.

Reglas del repo: `.opencode/reglas/` (api-design-patterns, lineamientos-bd, constants-first,
strict-boundaries, utility-services, iimp-ui-kit). Cargar solo la que aplique.

## 4. Implementado (commit `0f8c35e`)

**Modelo Prisma (migración aditiva `20261106120000_dd_v2_relacion_comercial`)**

- `DdRelacionComercial` (`dd_relacion_comercial`): unidad de resultado (empresa + relación
  comercial) con `tipoRelacion`, `estado`, `resultadoFinal`, `fechaDecision`,
  `vigenciaHasta`, `plazoVence`, informes y observaciones;
  `@@unique([debidaDiligenciaId, tipoRelacion])`.
- `DdEvidencia` (`dd_evidencia`): evidencia por campo (archivo y/o link), `area`
  (sig/reputacional/compliance), `campo`, `resultado`, autor y fecha; se enlaza a la
  relación y opcionalmente a la fila de matriz.
- `DebidaDiligenciaBeneficiario.tipoVinculoPersona` (rol de la persona).
- `DdMatrizVinculo.relacionComercialId` (nullable, FK con `SetNull`) + índice.

**Constantes (`src/lib/shared/constants.ts`)**

- `DD_ESTADOS_RELACION` (+ labels), `DD_TIPOS_VINCULO_PERSONA` (+ labels),
  `DD_VINCULOS_PERSONA_CON_PORCENTAJE`, `DD_PLAZO_RESPUESTA_DIAS_DEFAULT`.

**Utilidades (`src/lib/shared/utils/debida-diligencia-v2.ts`)**

- `requierePorcentajeParticipacion` y `porcentajeParticipacionValido`
  (porcentaje obligatorio y ≥10% solo para beneficiario final y socio 10%+).
- `calcularVigenciaHasta` (6 meses en UTC con ajuste de fin de mes).
- `empresaBloqueadaPorRelaciones` (bloqueo global si alguna relación es `NO APTO`).
- `calcularResultadoEmpresa` (consolidado por prioridad:
  NO APTO > EN REVISIÓN > DOCUMENTACIÓN OBSERVADA > APTO CON OBSERVACIONES > APTO).

**Verificación**: 16/16 tests, `tsc --noEmit` y `eslint` sin errores, app responde 200 en
`localhost:3008`. Docs actualizados: `modelo-datos.md` y `14-...alcance.md §17`.

## 5. Stitch (mockups)

- Proyecto original de DD V2: `14622015890478812512` — design system
  `assets/6071594238167036225`; inventario de screens en el doc 14 §14.
- Proyecto nuevo de rediseño (matriz/multiárea): `13385005972649419830`
  ("DD V2 — Matriz de Debida Diligencia (Rediseño)") — design system
  `assets/7918146955823625563`. Pantallas generadas:
  - Matriz DD: `33e6136a425d40eebade35281914ac29`
  - Expediente de empresa: `272d44ffb0e940b5acf4a2f1681b1cab`
  - Evaluación SIG por vínculo: `d9397599a2a04307a853d57ef7fa7f1e`
  - Comunicaciones: `1118da3c7cb743b88d1545c5f79b18d7`
  - Legal (DD reforzada): `f072cd3ec12247139669b8c6d04cc2c0`
  - Documentos e importación: `251e717607e34830a2b5a3eee4aa9dae`
  - Vigencias: `21d447d966494e3caf4d0d06bb548705`

## 6. Próximos pasos sugeridos (en orden)

1. **Servicio/repositorio de `DdRelacionComercial`**: alta desde el wizard, migración de
   los valores actuales de `DebidaDiligencia.tipoRelacionComercial` a relaciones V2
   (default "Empresa" si no hay), cálculo del resultado por relación y bloqueo global.
2. **`tipoVinculoPersona` en el wizard/revisión** y porcentaje condicional
   (hacer `porcentaje` nullable y ajustar mapeos/UI; usar las utilidades ya creadas).
3. **`relacionComercialId` en matriz, reputación y legal** (contexto por relación).
4. **Evidencias**: endpoints `[...slug]` + repositorio + UI (archivo/link por campo,
   `N.A.` exime), importación de carpeta con nomenclatura
   `01. [nombre] [concepto] [RUC/DNI]`.
5. **Plazo y `SIN RESPUESTA`**: configurable, recordatorios, cierre administrativo.
6. **Bloqueo global `NO APTO` en Solicitudes** (columna/cards) y bypass solo `admin:full`.
7. **Prevalidación de Asociados** (`dd:prevalidacion`) y **Administración** (`dd:admin`).
8. **Informe por relación comercial** (vista previa y PDF).

## 7. Decisiones abiertas (doc 14 §17) — cerrar antes de codificar lo que dependa de ellas

1. Relación comercial: ¿entidad maestra reutilizable entre eventos o hija del expediente?
   (recomendación del doc: maestra con expediente de evento asociado).
2. ¿Persona con un rol principal + roles adicionales? (UI actual así lo plantea).
3. ¿Matriz enlazada a la relación comercial o reconstruida como detalle de evaluación?
4. ¿Declaración de vigencia por relación comercial o por expediente?
5. Permiso/área de la prevalidación de Asociados.
6. Plazo inicial y disparador de recordatorios.
7. Campos exactos de la matriz que exigen evidencia obligatoria.

## 8. Gotchas del ambiente

- **Drift de migraciones**: la BD clonada tiene aplicadas migraciones de `qa` que no están
  commiteadas en este branch (`20261104120000_add_moneda_tipo_cambio` y el renombre
  `20261021190000_evento_contrato_posterior`). Por eso `prisma migrate dev` intenta
  resetear. Flujo usado para la migración DD: escribir el SQL en
  `prisma/migrations/<fecha>_<nombre>/migration.sql`, aplicarlo con psql al contenedor y
  registrarlo con `npx prisma migrate resolve --applied <nombre>`.
  Alternativa cuando se alinee el historial: migrar normal con `migrate dev`.
- La BD `contratos_dd` incluye 2 tablas de respaldo de pruebas de la original
  (`dd_empresa_estado_bak_ddtest`, `empresa_bak_ddtest`); no son parte del schema.
- `.env` del worktree no se versiona; no exponer credenciales.
- El `qa` principal tiene cambios sin commit **no relacionados a DD** (moneda, contratos,
  eventos/presala, reservas, plano): no traerlos a este branch.

## 9. Referencias del trabajo en Monday (contexto de gestión)

- Proyecto 12 — Matriz DD V2 (modelo/vista/migración): item `13490668741`.
- Proyecto 13 — Refinamientos funcionales DD: item `13490782338`.
- Item 10 — Módulo de Debida Diligencia EXTEMIN 2027 (base): item `13346041383`.

## 10. Estado del working tree al 2026-11-09 (avance grande SIN COMMIT)

Además del commit `0f8c35e`, el worktree tiene trabajo avanzado por otra sesión, aún
**sin commitear**:

### Matriz DD (decisión de UI — doc 18)

- `dd-matriz-bandeja.tsx`: bandeja operativa con KPIs, agrupación por empresa, sujetos
  por área, acciones masivas y paginación por empresa.
- `dd-matriz-excel.tsx`: hoja horizontal con las **54 columnas A–BB**, columnas fijas
  de contexto y exportación.
- `dd-matriz-revision-vinculo.tsx` y `dd-matriz-decision-vinculo.tsx`.
- `matriz/page.tsx` con tres vistas (Bandeja / Matriz de evaluación 54 columnas /
  Extendida) y `matriz/[id]/page.tsx`.
- Ajustes en `dd-matriz-badges`, `dd-matriz-resumen` y evaluación (lista/detalle).

### Repositorio documental e importación

- Página `/debida-diligencia/repositorio`, `dd-repositorio.tsx`,
  `dd-documentos-base-dialog.tsx` y `dd-importar-carpeta.tsx`.
- `utils/dd-repositorio-import.ts` (+ tests): nomenclatura y clasificación por nombre.
- Clasificación de archivos con IA: puerto, adaptador OpenAI
  (`OPENAI_API_KEY`, `OPENAI_CLASSIFIER_MODEL=gpt-4o-mini`), servicio, DTOs, validator
  y endpoint.

### Informes

- Página `/debida-diligencia/informes`, `dd-informe-bandeja.tsx`,
  `dd-informe-detalle.tsx` y `utils/dd-informe.ts` (+ tests).

### Wizard V2

- `dd-wizard-paso2.tsx` (relaciones comerciales múltiples + opción "Otro") y
  `dd-wizard-paso3.tsx` (personas vinculadas con tipo de vínculo), integrados en
  `dd-wizard.tsx`.

### Backend y flujo de estados (doc 19)

- Actualizaciones en servicio, repositorio, controller, validators, DTOs, mapper y
  constantes DD (estados por nivel, homologación de bandeja, decisión por relación).
- Migración aditiva `20261109120000_add_dd_tipo_relacion_otro`
  (`tipo_relacion_comercial_otro` en `debida_diligencia`), aplicada en `contratos_dd`.

### Documentos nuevos

- `18-debida-diligencia-v2-matriz-ui.md` — decisión de UI de la matriz (Stitch base
  `d5697867c569404d92a1d5fbd73dba80`).
- `19-debida-diligencia-v2-flujo-estados.md` — flujo real de estados, hallazgos P0/P1/P2
  y homologación de la bandeja.

### Verificación al 2026-11-09

- `npx tsc --noEmit`: sin errores.
- `npx vitest run src/lib/shared/utils src/application/debida-diligencia`:
  **49 archivos / 526 tests passed**.
- Migración `tipo_relacion_otro` registrada en `_prisma_migrations`.

### Notas para continuar

- **Commitear este avance** en `feature/dd-v2` antes de seguir (todo es trabajo DD).
- `qa` avanzó con commits **no-DD** (contratos en soles/moneda, SGC contrato observado,
  etc.); el branch DD está detrás de `qa` y no debe traerlos hasta coordinar.
- Pendiente del doc 18 §9: enlazar la matriz a `DdRelacionComercial`, edición en línea
  con evidencia por celda, resultado/bloqueo por relación y validación de los 54 campos
  contra el Excel oficial.
