# Plan — Reserva de stands pre-reservados por la empresa dueña

Estado: **propuesta** (2026-10-13). No implementado.
Reemplaza al diseño con lista blanca multi-empresa (descartado: enfocamos solo a la empresa dueña).

## 1. Lógica actual (verificada en código)

| Pieza | Comportamiento | Referencia |
|---|---|---|
| Pre-reservar | Valida `disponible` → pasa a **`pre_reservado`** con snapshot editable (razón social, RUC, SIE, título, logo, nota, por, at). Todo o nada, ≤ 500. | `gess-service.ts:105-137` |
| Bloqueo visual | El mapa no permite seleccionar nada que no sea `disponible`; `pre_reservado` se pinta "Reservado" **para todos (incluida la empresa dueña)**. | `plano-stands.tsx:32`, `plano-dinamico.tsx:342` |
| Reserva real (crear solicitud) | Bloquea `en_evaluacion`/`reservado`; **`pre_reservado` NO se valida server-side** (gap: solo lo bloquea la UI). | `reserva-service.ts:10,62` |
| Editar pre-reserva | `actualizarPreReserva` ya permite fijar razón social / RUC / SIE / título / logo / nota. | `gess-service.ts:160-175` |
| Liberar | Solo `pre_reservado` → `disponible`. | `gess-service.ts:140-147` |
| Borrado lógico | Baja de solicitud y rechazo de reevaluación → stand a `disponible`. Listados excluyen `flgActivo=false`. | `solicitudes-repository.ts:427-459` |
| Re-importación API | No pisa estado/empresa de un `pre_reservado`. | `gess-service.ts:253-268` |

## 2. Requerimiento (final)

- La pre-reserva bloquea el stand para el público general, **como hoy**.
- La **empresa dueña de la pre-reserva** (la que quedó en `preReservaRuc` / `preReservaSie`) **sí lo ve disponible** y puede solicitar la reserva desde su cuenta.
- Ninguna otra empresa (sin lista blanca; "editar la pre-reserva a nombre de la empresa" es el mecanismo para habilitarla).
- Si existe solicitud en curso (`en_evaluacion`/`reservado`): **bloqueado para todos**, incluida la dueña (flujo regular manda).
- Jerarquía/reviviscencia: la pre-reserva **no se destruye**; si la solicitud se da de baja (o rechazo de reevaluación), **revive** con su snapshot.

## 3. Diseño

### 3.1 Sin cambios de esquema (cero migración)

Se reutiliza lo existente en `gess_stand`: `preReservaRuc`, `preReservaSie`, `preReservaRazonSocial`,
`preReservaTitulo`, `preReservaLogoUrl`, `preReservaNota`, `preReservaPor`, `preReservaAt` + `estado`.
- "Tiene pre-reserva" = `estado = pre_reservado` **o** snapshot presente (`preReservaAt`/título/razón social).
- Si la pre-reserva es solo título (sin RUC/SIE), ninguna empresa matchea → bloqueado para todos hasta editarla (comportamiento esperado).

### 3.2 Regla única de disponibilidad efectiva

```
disponibleEfectivo(estado, stand, empresaViewer):
  disponible                             -> true
  pre_reservado + esEmpresaDuena(viewer) -> true   (ve "Disponible" y puede reservar)
  pre_reservado                          -> false
  en_evaluacion | reservado | legacy     -> false  (SIEMPRE; ni la dueña)
```

`esEmpresaDuena(viewer)`: empresa del usuario (`user_role.empresa`) coincide con
`stand.preReservaRuc` (match primario) o `stand.preReservaSie`; fallback recomendado:
razón social normalizada idéntica. La empresa del viewer se resuelve una vez por request.

### 3.3 Puntos de aplicación

1. **Gate server-side** — `ReservaApplicationService.crear`:
   - Agregar `pre_reservado` a la validación (cierra el gap actual).
   - Exonerar solo si `esEmpresaDuena(viewer)`.
   - Mantener `en_evaluacion`/`reservado`/legacy bloqueados para todos.
2. **Lectura efectiva del mapa cliente** — `/api/gess/listar` (lo consumen `plano-dinamico`,
   `plano-isometrico`, `plano-stands`, `plano-grid`):
   - Rol cliente + empresa dueña → estado efectivo `disponible` y **enmascarar** el snapshot
     `preReserva*` (no debe ver que está pre-reservada).
   - Staff/mantenedores → sin cambios (siguen viendo `pre_reservado`).
   - Detección de rol: por rol/perfil de sesión (a definir: rol `cliente` vs permisos de gestión).
3. **Contadores de ocupación** (macro/secciones): vista cliente cuenta los stands de la dueña como
   disponibles; vista staff igual que hoy.
4. **Reviviscencia** — `darDeBajaSolicitud` y `atenderReevaluacionRechazo`:
   - Si el stand conserva snapshot de pre-reserva → restaurar `pre_reservado` + etiqueta original.
   - Si no → `disponible` (comportamiento actual, sin cambio).
5. **Concurrencia** — claim atómico por stand en `crear` (`updateMany` con filtro de estado
   esperado + conteo de afectados; el segundo pierde con conflicto; liberar claims parciales
   si el lote falla a mitad).
6. **UI** (`pre-reservas-manager`): al pre-reservar/editar, dejar claro que **"a nombre de la
   empresa" (RUC/SIE) habilita a esa empresa a reservar**; si se pre-reserva con solo título,
   nadie podrá romperla (hint en el formulario). Editar ya existe.

### 3.4 Qué NO se rompe (verificado)

- **Sin migración** y sin tabla nueva: no hay riesgo de datos.
- Flujo regular (solicitud en camino): intacto; `en_evaluacion`/`reservado` siguen bloqueando a todos.
- Bajas/rechazos de stands **sin** pre-reserva: siguen volviendo a `disponible` exactamente como hoy.
- Re-importación liststand, mockup, mantenedor manual, M2M montaje (solo asigna montajista): sin cambios.
- Vistas staff: sin cambios.
- Pre-reservas antiguas (con o sin RUC): mientras nadie matchee, se comportan como hoy.
- Todo queda **inerte** con el feature flag apagado.

## 4. Fases

| Fase | Alcance | Criterio de aceptación |
|---|---|---|
| F1 | Util `disponibleEfectivo` + gate en `reserva-service` + tests | Dueña reserva; no-dueña recibe conflicto; `reservado` bloquea a todas |
| F2 | `/api/gess/listar` vista efectiva + masking + contadores cliente | La dueña ve "Disponible" y puede reservar desde el mapa; staff no cambia |
| F3 | Reviviscencia (baja/rechazo) + claim atómico + tests | Baja de solicitud → revive pre-reserva con su snapshot |
| F4 | E2E + docs (este archivo + `01-funcional/README`) | Ciclo completo: pre-reservar a nombre de X → X reserva → baja → revive |

## 5. Decisiones tomadas (2026-10-13)

1. **Modelo A**: solo la empresa dueña; **sin lista blanca** (descartado el diseño multi-empresa).
2. **Jerarquía**: solicitud en camino manda (bloqueo para todos); al darse de baja, **revive** la pre-reserva.
3. La dueña ve el stand **"Disponible"**; si hay solicitud en proceso, se muestra **"Reservado"** para todos.
4. Pendiente menor a definir en implementación: fallback de match por razón social normalizada (recomendado: sí).

## 6. Despliegue seguro

- **Feature flag** `PRE_RESERVA_EMPRESA_DUENA` (default `off`): apagado = comportamiento actual
  exacto (incluido el no-bloqueo server-side de `pre_reservado`). Rollback = flag `off`.
- Suite completa (`tsc`/`eslint`/`vitest`) + tests nuevos antes de commitear.
- No tocar trabajo sin commitear de otras sesiones.

## 7. Estado de implementación (2026-10-13)

Implementado en el working tree (**sin commit**; sin flag — el único cambio global es el cierre
del gap server-side, cubierto por tests):

- `estado-stand.ts`: `EmpresaViewer` + `esEmpresaDuenaPreReserva` (RUC → SIE → razón social normalizada).
- `reserva-service.ts`: gate server — la dueña puede reservar su pre-reserva; terceros y solicitantes
  sin empresa reciben conflicto (`"<stand> esta pre-reservado para otra empresa"`).
- `gess-service.listar` + `gess.controller.listar`: vista efectiva — la empresa cliente dueña ve el
  stand como `disponible` con el snapshot enmascarado; el staff no cambia.
- `solicitudes-repository.ts`: `liberarStandGess` — baja de solicitud y rechazo de reevaluación
  restauran `pre_reservado` si el stand conserva snapshot (reviviscencia por jerarquía).
- Tests nuevos: 5 de `esEmpresaDuenaPreReserva` + 3 de flujo en `reserva-service`.
- Verificación: `tsc` 0, `eslint` 0, `vitest` 596 passed.

Pendiente menor (no bloquea): contadores de ocupación del mapa (macro/secciones) aún no son
conscientes de la vista efectiva; `findByBloque` no aplica el viewer (verificar si alguna vista
cliente lo usa).
