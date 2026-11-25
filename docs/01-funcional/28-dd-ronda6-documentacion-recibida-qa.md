# DD — Ronda 6 E2E en QA: estado "Documentación recibida"

Fecha: 2026-11-25 · Imagen QA: `937ff3b6` · Script: `scripts/e2e-dd-qa/ronda6.mjs` · Empresas: `E2E RONDA2 R70..R81`.

Se corrió en un contenedor temporal (`ctrst-e2e`) con la misma imagen y BD de QA, **sin** correo ni Pusher, y se eliminó al terminar.

## Resultado

**29/29 OK.** En la primera corrida hubo 26/29: los 3 FAIL (D3 y D4) eran de la prueba, no del sistema. Esas DD no tenían la matriz sincronizada; en la UI se sincroniza al abrir el modal. Se repitieron con R80/R81 sincronizando primero y pasaron.

| Caso | Qué se probó | Resultado |
|---|---|---|
| D1 | Primer envío → `doc_recibida` (SIG y cliente); hito "Documentación recibida" en historial | OK |
| D1 | Cliente no puede editar (409 "Recibimos tu documentación…") ni reenviar, ni abrir otra DD en el evento | OK |
| D1 | Abrir detalle, historial y matriz **no** inicia la revisión | OK |
| D1 | Bandeja: filtro Documentación recibida la trae, En revisión no; `resumen.documentacionRecibida` | OK |
| D1 | Matriz: filas con estado recibida, filtro y exportación con `documentacion_recibida`; resumen y panel sin error | OK |
| D1 | SIG no concluye: aprobar/observar/derivar Legal → 409; APTO, APTO c/obs, NO APTO, SIN RESPUESTA, EN REVISIÓN, DOC. OBSERVADA → 409; DOCUMENTACIÓN RECIBIDA manual → rechazada. Nada se guarda | OK |
| D1 | Legal no puede resolver una DD recibida | OK |
| D1 | Borrador en un vínculo → `en_revision`, un solo hito "SIG inició la revisión" + auditoría; segundo borrador no duplica | OK |
| D1 | Ya en revisión: Comunicaciones + conclusiones → APTO; un borrador posterior no cambia el estado | OK |
| D2 | Subir evidencia → `en_revision`; eliminarla no regresa | OK |
| D3 | Declarar vínculos completos → `en_revision`; retirar la declaración no regresa | OK |
| D4 | Derivar a Comunicaciones → `en_revision` (motivo en historial) | OK |
| D5 | Evaluación SIG → `en_revision`; evaluación + resultado final estando recibida → 409 y no inicia (todo o nada) | OK |
| D6 | 3 acciones simultáneas → un solo hito de inicio | OK |
| D7 | recibida → borrador → DOC. OBSERVADA → cliente subsana → **en_revision** (no recibida) → APTO | OK |
| D8 | recibida → revisión → Legal observa → subsana → **en_legal** → Legal aprueba → en_revision → APTO | OK |
| D9 | recibida → borrador → NO APTO en matriz | OK (ver nota 3) |
| D10 | Mis DD del cliente, empresas `resultado=pendiente` y clientes `estado=doc_recibida` sin error | OK |

## Verificación visual (navegador, QA)

- Bandeja SIG: tarjeta "Documentación recibida" y chip "N por iniciar".
- Modal desde bandeja: badge "Documentación recibida", aviso y decisiones deshabilitadas.
- Modal "Conclusión final" (desde la matriz): DOCUMENTACIÓN RECIBIDA marcada "Actual", demás deshabilitadas, botón Registrar deshabilitado.
- Al declarar vínculos completos dentro del modal: pasa a "En revisión" y se habilitan las conclusiones sin cerrar el modal.
- Matriz DD: tarjeta DOC. RECIBIDA (las seis tarjetas suman el total) y filas con el badge DOCUMENTACIÓN RECIBIDA.
- Panel: KPI "En revisión" con la nota "Incluye documentación recibida".

## Hallazgos

1. **Detalle de vínculo (matriz):** el chip FINAL mostraba "Sin evaluar" en DD recibidas (y en revisión) porque usaba el valor guardado, no el efectivo. **Corregido:** el badge recibe el estado del expediente y muestra el efectivo en el encabezado, el selector de vínculos, las evidencias y la vista extendida.
2. **Modal Conclusión final en recibida:** se seguían viendo el texto "Los estados automáticos también se pueden registrar manualmente" y la ayuda "Falta este comentario para habilitar el botón". **Corregido.**
5. **Informes DD:** la bandeja y el informe (vista y PDF) usaban el valor guardado. Filtrando "Documentación recibida" las filas salían "Sin evaluar" y la conclusión mostraba "EN REVISIÓN" por defecto. **Corregido:** se usa el resultado efectivo. "Con final" y la recomendación del PDF solo cuentan conclusiones reales (no EN REVISIÓN ni DOCUMENTACIÓN RECIBIDA). La conclusión explica que SIG aún no inició la revisión.
6. **Correo "Debida diligencia recibida":** decía siempre "Estado: En revisión por Logística". **Corregido:** según la etapa dice "Documentación recibida (pendiente de revisión)", "En revisión por Logística" (subsanación) o "En revisión legal".
7. **Historial visible al cliente:** el hito de inicio mostraba el vínculo y la acción interna. **Corregido:** ahora dice "Revisión iniciada" con un texto neutro; el motivo exacto queda en metadata y auditoría.
8. **Estado fijo `"en_revision"`** al abrir el modal desde la Matriz y el Repositorio (el badge mostraba "En revisión" hasta cargar). **Corregido:** usa el estado real.
9. **Manual del cliente, flujo de estados y OpenAPI:** actualizados con el estado nuevo.
3. **Comportamiento previo, no relacionado:** NO APTO desde la matriz guarda el resultado en el vínculo pero no cambia el estado del expediente (sigue en revisión). Solo el rechazo de Legal lo pasa a rechazada.
4. Agregar un vínculo manual en la matriz no inicia la revisión: no está en la lista de disparadores acordada.

## Backfill — simulación en la BD de QA (solo lectura)

105 en revisión → **45** pasarían a Documentación recibida. Se quedan 32 importadas y 28 del portal con trabajo de SIG. No se aplicó.
