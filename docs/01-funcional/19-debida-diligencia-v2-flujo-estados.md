# Debida Diligencia V2 - Flujo de revisión, estados y decisión final

> **Fuente:** transcripción de la reunión de transferencia del 27/10/2026,
> `docs/01-funcional/14-debida-diligencia-v2-alcance.md`,
> `docs/01-funcional/15-debida-diligencia-navegacion.md`,
> `docs/01-funcional/16-debida-diligencia-actividades.md`,
> `docs/01-funcional/18-debida-diligencia-v2-matriz-ui.md` y código actual de `/matriz`.
>
> **Objetivo:** dejar a la mano el flujo real, los estados que existen en cada nivel y
> lo que hoy implementa la matriz. **No es un documento de cambios ya realizados**: las
> diferencias se marcan como hallazgos para corregirlas antes de cerrar el flujo.

## 1. Resumen ejecutivo

Sí existe un flujo de revisión, pero **hoy no está implementado de extremo a extremo en
`/matriz`**. La matriz muestra y persiste estados por vínculo, pero el proceso real tiene
tres niveles que no deben mezclarse:

1. **Expediente:** trámite global de la empresa.
2. **Área:** resultado y conclusión de SIG, Comunicaciones y Legal.
3. **Relación comercial/vínculo:** resultado final, vigencia y bloqueo.

La decisión final del proceso la consolida **SIG/Logística**; Comunicaciones solo reporta
hallazgos y sustento; Legal decide sobre la DD reforzada y su rechazo es vinculante. Hoy
el código permite que SIG o Legal registren el resultado final y que la bandeja marque
`APTO` en bloque sin validar el flujo. Eso debe corregirse.

## 2. Flujo real según la reunión

1. El cliente completa el formulario y envía su DD.
2. Asociados prevalida la relación comercial declarada y, si corresponde, la corrige.
3. SIG/Logística valida datos, documentos y personas; completa listas restrictivas y
   adjunta evidencias.
4. SIG deriva nombres, cargos y sitio web a Comunicaciones.
5. Comunicaciones revisa prensa, entrevistas, sanciones y fuentes. Devuelve:
   - `SIN OBSERVACIONES`; o
   - una observación con su fuente/enlace.
6. SIG evalúa el resultado reputacional. **Puede concluir `SIN OBSERVACIONES` aunque
   Comunicaciones haya observado algo, si la observación no tiene sustento suficiente.**
7. Si SIG concluye `REQUIERE DEBIDA DILIGENCIA REFORZADA`, adjunta informe y sustento y
   deriva el expediente a Legal.
8. Legal revisa:
   - **Aprueba:** devuelve a SIG para la decisión final.
   - **Observa / pide información:** el cliente subsana y el expediente vuelve.
   - **Rechaza:** el resultado es `NO APTO` y el rechazo es vinculante.
9. SIG registra la decisión final de la relación: `APTO`, `APTO CON OBSERVACIONES`,
   `DOCUMENTACIÓN OBSERVADA`, `EN REVISIÓN`, `NO APTO` o `SIN RESPUESTA`.
10. La vigencia de 6 meses corre desde la **fecha de la decisión final**, no desde el
    envío ni desde la aprobación de un área.
11. Si cambia la relación comercial o el evento, se evalúa la reutilización o se genera
    una nueva DD según las reglas de vigencia.

## 3. Estados por nivel

### 3.1 Expediente

| Código | Etiqueta | Uso |
|---|---|---|
| `borrador` | Borrador | Formulario aún editable |
| `pendiente` | Pendiente | Enviado, aún no tomado por revisión |
| `doc_recibida` | Documentación recibida | Primer envío del cliente; SIG aún no inicia la revisión |
| `en_revision` | En revisión | En SIG o en revisión de áreas |
| `observada` | Observada | Cliente debe corregir documentos u observaciones |
| `en_legal` | En revisión legal | Derivado a Legal |
| `aprobada` | APTO | Expediente aprobado |
| `rechazada` | NO APTO | Rechazado por Legal o por decisión final |

**Documentación recibida (`doc_recibida`, desde 2026-11-25).** Orden lineal:
`borrador → doc_recibida → en_revision → …`.

- Solo el **primer envío** del cliente deja la DD en `doc_recibida`. La subsanación vuelve a
  `en_revision` (o a `en_legal` si observó Legal); nunca regresa a `doc_recibida`.
- Pasa a `en_revision` cuando SIG: guarda un borrador o una evaluación en cualquier vínculo de
  la matriz, sube o automatiza una evidencia, deriva a Comunicaciones o declara los vínculos
  completos. Abrir el detalle o la matriz no cuenta. Queda historial "Revisión iniciada" y
  auditoría con el motivo exacto.
- Mientras está en `doc_recibida` no se registra ninguna conclusión (aprobar, observar,
  derivar a Legal, documentación observada ni resultado final): el servidor responde 409.
- El código es corto porque la columna `estado` es `VarChar(20)`.
- Backfill: `scripts/dd-documentacion-recibida/backfill-documentacion-recibida.cjs` (simulación
  por defecto) pasa a `doc_recibida` las DD del portal en `en_revision` sin trabajo de SIG.

`SIN RESPUESTA` no es un estado del expediente legacy: pertenece a la relación comercial.
No debe confundirse con `DD_ESTADOS` ni usarse para cerrar el expediente sin decisión.

### 3.2 Resultado por área

| Código | Etiqueta | Significado |
|---|---|---|
| `aceptado` | ACEPTADO | El área no encontró un hallazgo relevante |
| `observado` | OBSERVADO | El área encontró un hallazgo |
| `no_aplica` | NO APLICA | El criterio no corresponde al ámbito/tipo |

Regla clave: **`OBSERVADO` es un resultado del área, no el resultado final**. Un área
puede quedar observada y, después del análisis, concluir `SIN OBSERVACIONES`.

### 3.3 Conclusión por área

**SIG y Reputacional/Comunicaciones**

| Código | Etiqueta | Uso |
|---|---|---|
| `sin_observaciones` | SIN OBSERVACIONES | Puede continuar sin revisión reforzada |
| `requiere_dd_reforzada` | REQUIERE DEBIDA DILIGENCIA REFORZADA | Debe ir a Legal |
| `en_revision` | EN REVISIÓN | Aún no hay conclusión definitiva |

**Compliance/Legal**

| Código | Etiqueta | Uso |
|---|---|---|
| `aceptado` | ACEPTADO | Legal aprueba |
| `aceptado_con_observaciones` | ACEPTADO CON OBSERVACIONES | Aprueba con seguimiento |
| `rechazado` | RECHAZADO | Rechazo vinculante; la relación queda `NO APTO` |

### 3.4 Resultado final por relación/vínculo

| Código | Etiqueta | Cuándo aplica | Efecto |
|---|---|---|---|
| `apto` | APTO | Sin observaciones relevantes y sin pendientes de áreas/Legal | Habilita continuar |
| `apto_con_observaciones` | APTO CON OBSERVACIONES | Observaciones menores, subsanadas o con seguimiento | Habilita con control; puede requerir nueva evaluación al cambiar de relación |
| `documentacion_observada` | DOCUMENTACIÓN OBSERVADA | Falta documento o evidencia | Cliente debe subsanar; no es una aprobación |
| `documentacion_recibida` | DOCUMENTACIÓN RECIBIDA | Derivado del estado `doc_recibida`: el cliente envió y SIG no inició | No es decisión final; no se registra a mano |
| `en_revision` | EN REVISIÓN | SIG, Comunicaciones o Legal aún no concluyen | No es decisión final |
| `no_apto` | NO APTO | Legal rechaza o existe un riesgo crítico | Bloquea la relación/empresa según la regla global |
| `sin_respuesta` | SIN RESPUESTA | Venció el plazo sin respuesta del cliente | Cierra la relación; requiere nueva DD |

La fecha de decisión final solo debe grabarse cuando el estado sea un resultado final
real, no mientras esté `EN REVISIÓN` o `DOCUMENTACIÓN OBSERVADA`.

### 3.5 Estados de relación comercial

`DD_ESTADOS_RELACION` ya define el modelo objetivo:

`pendiente`, `en_revision`, `observada`, `en_legal`, `aprobada`, `rechazada`,
`sin_respuesta`.

La relación debe ser la unidad de resultado final. Hoy el resultado final se guarda en
`DdMatrizVinculo`, mientras `DdRelacionComercial` existe en Prisma pero todavía no está
conectada al servicio ni a la UI.

### 3.6 Estados de evidencia y documentos

- Documentos base: `pendiente`, `cargado`, `observado`, `aprobado`, `rechazado`.
- Evidencias de matriz: se consideran cargadas al adjuntarse; `N.A.` exime del requisito.
- La evidencia debe asociarse a relación, sujeto, área/campo, resultado, autor y fecha.

## 4. Mapa de implementación actual

| Elemento | Dónde está | Qué hace hoy |
|---|---|---|
| Bandeja de matriz | `dd-matriz-bandeja.tsx` | Muestra estados por área y final; filtra y exporta; permite seleccionar y ejecutar acciones masivas |
| Acción “Marcar APTO” | `dd-matriz-bandeja.tsx` | Escribe `resultadoFinal = APTO` directamente en los vínculos seleccionados |
| Acción “Enviar a Comunicaciones” | `dd-matriz-bandeja.tsx` | Deriva el expediente al flujo legacy de Comunicaciones |
| Acción “Derivar a Legal” | `dd-matriz-bandeja.tsx` | Usa `debidaDiligenciaService.revisar` sobre el expediente legacy |
| Revisión de vínculo | `dd-matriz-revision-vinculo.tsx` | Muestra datos, listas, conclusiones y permite solo dos acciones finales: `APTO` y `DOCUMENTACIÓN OBSERVADA` |
| Edición de vínculo | `dd-matriz-decision-vinculo.tsx` | Edita criterios y SIG; registra final `APTO`, `APTO CON OBSERVACIONES` o `EN REVISIÓN` |
| Editor completo por áreas | `dd-matriz-evaluacion-detalle.tsx` | Tiene formularios de SIG, Reputacional y Compliance, adjuntos y final; **no está montado en `/matriz/[id]`** |
| Persistencia de matriz | `dd-matriz-evaluacion-repository.ts` | Guarda resultados de áreas y `resultadoFinal`, `finalFecha`, `finalPor` |
| Servicio de matriz | `dd-matriz-evaluacion-service.ts` | Valida permisos y reglas de cada área; permite final si `editarFinal` es verdadero |
| Revisión legacy | `dd-revision-modal.tsx` y `debida-diligencia-service.ts` | Cambia estados del expediente (`revisar`, `derivar`, `resolverLegal`) |
| Relación comercial | `DdRelacionComercial` en Prisma | Modelo creado; sin servicio, UI ni integración con matriz |
| Evidencia V2 | `DdEvidencia` en Prisma | Modelo creado; la UI actual usa `DdMatrizAdjunto` |

## 5. Hallazgos que no debemos dejar pasar

### P0 - Rompen el flujo

1. **Hay dos fuentes de verdad.** El resultado final de la matriz
   (`DdMatrizVinculo.resultadoFinal`) y el estado legacy del expediente
   (`DebidaDiligencia.estado`) se actualizan por caminos distintos. Una acción en
   `/bandeja` o `/matriz` puede dejar el expediente y la matriz en estados diferentes.
2. **El detalle de `/matriz/[id]` no permite completar las tres áreas.** El editor
   completo existe en `dd-matriz-evaluacion-detalle.tsx`, pero la ruta monta
   `DdMatrizRevisionVinculo` y `DdMatrizDecisionVinculo`. Estos no editan Reputacional ni
   Compliance; por tanto, el flujo SIG -> Comunicaciones -> Legal no se puede ejecutar
   completo desde la matriz.
3. **Faltan transiciones finales en la UI.** La revisión solo permite `APTO` y
   `DOCUMENTACIÓN OBSERVADA`; no permite `APTO CON OBSERVACIONES`, `EN REVISIÓN`,
   `NO APTO` ni `SIN RESPUESTA`.
4. **“Marcar APTO” salta el flujo.** La bandeja puede registrar `APTO` masivamente sin
   comprobar conclusión de áreas, reputación, Legal, evidencia o pendientes.
5. **Autoridad de decisión inconsistente.** El backend permite `editarFinal` a SIG o
   Legal, pero el proceso define a SIG/Logística como responsable de la decisión final.
   Legal debe poder rechazar y observación de Legal debe volver al flujo; no debería
   fijar arbitrariamente cualquier final.
6. **`OBSERVADO` se confunde con el resultado final.** En la edición actual, un veredicto
   `observado` implica `APTO CON OBSERVACIONES`. En la reunión, un SIG observado puede
   concluir `SIN OBSERVACIONES` y terminar `APTO`. Hay que separar resultado del área,
   conclusión y decisión final.

### P1 - Reglas incompletas

7. **No hay regla automática de consolidación.** No está implementado qué combinación de
   resultados de SIG/Reputacional/Legal produce cada uno de los seis finales.
8. **No hay control de `SIN RESPUESTA`.** Existe el estado y el plazo configurable, pero
   no el job/transición que cierre por vencimiento.
9. **No hay transición obligatoria a Legal.** SIG puede registrar final sin que Legal
   haya intervenido cuando la conclusión es `REQUIERE DD REFORZADA`.
10. **No se exige evidencia por campo para aprobar.** `N.A.` exime, pero la UI no bloquea
    el final si faltan archivos o links obligatorios.
11. **La fecha final no está condicionada al estado.** `guardar` graba `finalFecha` al
    recibir cualquier `resultadoFinal`, incluso si luego se corrige o se deja pendiente.
12. **`APTO CON OBSERVACIONES` se muestra como pendiente en la revisión.** La revisión
    solo considera aprobado `APTO`; el texto y el color deben distinguir los finales
    válidos.
13. **No hay historial de transiciones de matriz.** Se audita `matriz_guardar`, pero no
    una máquina de estados con entrada/salida, actor, motivo y evidencia.
14. **No está integrada la relación comercial.** El resultado final se guarda por vínculo,
    no por `DdRelacionComercial`; no se aplica el bloqueo global ni la regla de nueva DD
    al cambiar de relación.

### P2 - Consistencia de catálogo y textos

15. El legacy usa `APROBADA/RECHAZADA`; la matriz usa `APTO/NO APTO`. Hay que mapear
    explícitamente y no comparar etiquetas de UI.
16. `DOCUMENTACION OBSERVADA` y `EN REVISION` tienen variantes sin tilde en alias de
    importación; normalizar sin perder la etiqueta oficial.
17. `DdMatrizResultados` incluye `NO_APLICA` para áreas; no debe confundirse con
    `NO APTO`.
18. El documento 14 dice que `APTO CON OBSERVACIONES` puede renovar con declaración si
    mantiene la misma relación; la reunión exige nueva evaluación al cambiar de relación.
    Falta cerrar esa regla en un solo lugar.

## 6. Regla propuesta para la decisión final

Esta regla debe implementarse en un servicio de dominio, no repetirse en componentes:

| Condición | Resultado |
|---|---|
| Legal rechazó | `NO APTO` |
| Venció el plazo sin respuesta | `SIN RESPUESTA` |
| Falta documentación/evidencia obligatoria | `DOCUMENTACIÓN OBSERVADA` |
| SIG/Comunicaciones/Legal aún pendientes | `EN REVISIÓN` |
| Todo aceptado, sin hallazgos relevantes | `APTO` |
| Observación menor, subsanada o con seguimiento | `APTO CON OBSERVACIONES` |

Reglas de autoridad:

- **SIG/Logística** registra la decisión final y la fecha de decisión.
- **Comunicaciones** registra resultado, observación y fuente; no registra final.
- **Legal** puede aprobar, observar o rechazar; su rechazo produce `NO APTO`.
- Un resultado de área `OBSERVADO` no implica por sí solo un final observado.
- `APTO` y `APTO CON OBSERVACIONES` requieren que no exista un pendiente de Legal.
- La fecha de vigencia se calcula desde la decisión final y no desde el envío.

## 7. Checklist para cerrar el flujo

- [ ] Un solo servicio calcula y persiste el final por relación.
- [ ] `/matriz/[id]` permite editar las tres áreas y adjuntar evidencia.
- [ ] La bandeja no permite saltar a `APTO` sin validaciones.
- [ ] Los seis finales tienen entrada, salida, actor y motivo.
- [ ] `SIN RESPUESTA` tiene plazo, recordatorio y cierre automático.
- [ ] `NO APTO` de Legal bloquea la relación/empresa según la regla global.
- [ ] `APTO CON OBSERVACIONES` se muestra como final válido.
- [ ] El final de matriz y el estado del expediente quedan sincronizados.
- [ ] La relación comercial es la unidad de resultado y vigencia.
- [ ] Cada transición genera historial y auditoría.
- [ ] Los estados legacy y V2 tienen un mapper único y probado.
- [ ] Los tests cubren todas las combinaciones de áreas y finales.

## 8. Próximo paso recomendado

Antes de agregar más botones, definir y aprobar la **máquina de estados**. Después:

1. Crear el servicio/repositorio de `DdRelacionComercial`.
2. Implementar `calcularResultadoFinal` y sus guardas.
3. Montar el editor completo por áreas en `/matriz/[id]`.
4. Reemplazar las acciones masivas por transiciones validadas.
5. Sincronizar matriz, expediente y relación.
6. Implementar plazo, `SIN RESPUESTA` e historial.
7. Probar los escenarios de la transcripción: limpio, observado menor, reforzado aprobado, reforzado observado, rechazado y sin respuesta.

## 9. Referencias de código

- `src/lib/shared/constants.ts`: `DD_ESTADOS`, `DD_ESTADOS_RELACION`,
  `DD_MATRIZ_RESULTADOS`, `DD_MATRIZ_CONCLUSIONES`,
  `DD_MATRIZ_CONCLUSIONES_COMPLIANCE`, `DD_MATRIZ_RESULTADOS_FINALES`.
- `src/components/debida-diligencia/dd-matriz-bandeja.tsx`: bandeja y acciones masivas.
- `src/components/debida-diligencia/dd-matriz-revision-vinculo.tsx`: revisión y final
  limitado.
- `src/components/debida-diligencia/dd-matriz-decision-vinculo.tsx`: edición SIG y
  veredicto.
- `src/components/debida-diligencia/dd-matriz-evaluacion-detalle.tsx`: editor completo no
  montado en la ruta.
- `src/application/debida-diligencia/dd-matriz-evaluacion-service.ts`: permisos y guardado
  de áreas/final.
- `src/application/debida-diligencia/debida-diligencia-service.ts`: flujo legacy,
  `revisar`, `resolverLegal` y `derivarComunicaciones`.

## 10. Declaración del sujeto: empresa, persona y ámbito

La evaluación debe declarar dos dimensiones **independientes**:

- **Tipo de sujeto:** empresa, representante, beneficiario o persona/empresa vinculada.
- **Ámbito:** nacional o extranjero.

No se debe deducir “empresa o persona” a partir del país, ni “nacional o
extranjero” a partir del tipo de sujeto.

### 10.1 Lo que está correcto

- La empresa se crea como fila `EMPRESA`.
- El representante se crea como fila `REPRESENTANTE`.
- Los beneficiarios se crean como filas independientes.
- Cada fila tiene su propio `ambito`.
- Las listas nacionales de empresa y de persona están separadas.
- Las listas extranjeras se muestran solo para sujetos extranjeros.
- Una misma empresa puede tener filas nacionales y extranjeras.
- El país se puede corregir manualmente y recalcula el ámbito, salvo que se fije
  explícitamente.

### 10.2 Problemas detectados

1. **Todos los beneficiarios se guardan como `BENEFICIARIO`.** El sync ignora
   `DebidaDiligenciaBeneficiario.tipoVinculoPersona`. Un director, apoderado, gerente,
   socio o empresa vinculada termina mostrado como “Beneficiario final”.
2. **Una empresa vinculada se evalúa con listas de persona.** `listasAplicables` solo
   distingue `EMPRESA` del resto. Un sujeto `BENEFICIARIO` con
   `tipoVinculoPersona = empresa_vinculada` recibe listas de persona, no listas de
   empresa. Esto es un error de negocio.
3. **El cargo de los beneficiarios es genérico.** Se guarda
   `Beneficiario final (x%)` aunque el rol real sea director, apoderado, gerente o
   empresa vinculada.
4. **El tipo de documento de la empresa está fijo en `RUC`.** Una empresa extranjera
   puede identificarse con otro ID; la matriz debe mostrar `RUC / ID` y no asumir RUC.
5. **El tipo de documento de los beneficiarios es `null`.** Si no hay nacionalidad, el
   ámbito cae por defecto en `NACIONAL`; no se infiere desde DNI, RUC, CE o pasaporte.
6. **`VINCULADO` es ambiguo.** La etiqueta dice “Persona / empresa vinculada”, pero el
   motor de listas siempre lo trata como persona.
7. **El wizard no persiste el rol de la persona vinculada.** `DdGuardarData` y el
   formulario actual no envían `tipoVinculoPersona`; el campo existe en Prisma, pero no
   se alimenta desde el flujo regular.
8. **El Título de la tabla muestra el tipo, no el rol.** En Vista extendida un director
   puede aparecer como “Beneficiario final” porque `tipo` es la única etiqueta visible.
9. **`esEmpresa` se compara con el literal `"empresa"`** en algunos componentes. Debe
   usar `DD_MATRIZ_TIPOS_VINCULO.EMPRESA`.
10. **No existe todavía `DdRelacionComercial` conectada.** El resultado y la evaluación
    siguen por vínculo, no por relación comercial.

### 10.3 Regla objetivo

| Sujeto | `tipo` | Documento | Listas |
|---|---|---|---|
| Empresa nacional | `EMPRESA` | RUC | Empresa nacional |
| Empresa extranjera | `EMPRESA` | RUC / ID extranjero | Empresa extranjera |
| Representante nacional | `REPRESENTANTE` | DNI / documento | Persona nacional |
| Representante extranjero | `REPRESENTANTE` | CE / pasaporte / ID | Persona extranjera + conflicto |
| Beneficiario nacional | `BENEFICIARIO` | DNI / RUC | Persona nacional |
| Beneficiario extranjero | `BENEFICIARIO` | CE / pasaporte / ID | Persona extranjera + conflicto |
| Empresa vinculada | `VINCULADO` o tipo específico | RUC / ID | Listas de empresa, no de persona |
| Persona vinculada | `VINCULADO` | DNI / CE / pasaporte | Persona nacional o extranjera |

El `cargo` debe mostrar el rol real (`director`, `apoderado`, `gerente`,
`beneficiario final`, `socio 10%+`, `empresa vinculada`), no un texto genérico.

### 10.4 Cambios necesarios

- Persistir `tipoVinculoPersona` desde el wizard y el expediente.
- Propagar ese rol al vínculo de matriz.
- Separar `empresa_vinculada` de `persona` en `listasAplicables`.
- Inferir `tipoDocumento` y `ambito` con documento + nacionalidad.
- Usar constantes también en las comparaciones de tipo.
- Añadir pruebas para empresa/persona, nacional/extranjero, empresa vinculada y
  beneficiario sin nacionalidad.

### 10.5 Porcentaje de participación

El porcentaje no es una propiedad de toda relación comercial. La relación comercial
responde a “cómo participa la empresa en el IIMP” (exhibidor, auspiciador, proveedor,
alquiler, etc.). El porcentaje pertenece a las **personas o empresas vinculadas**:
beneficiarios finales, socios con 10% o más y, cuando aplique, empresas vinculadas.

Hoy:

- La fuente correcta del porcentaje es `DebidaDiligenciaBeneficiario.porcentaje`.
- El wizard lo captura en “Beneficiarios finales (10% o más)”.
- `DdMatrizVinculo` **no tiene un campo numérico `porcentaje`**; el sync lo mete en el
  texto `cargo` como `Beneficiario final (10%)`.
- La **Bandeja DD** muestra `% Particip.` y lo obtiene con una expresión regular sobre
  `cargo`. Por eso el porcentaje se ve ahí, pero es una solución frágil.
- En la **Vista extendida** no hay columna de porcentaje porque la tabla de Stitch no la
  incluye; el porcentaje no debe inventarse en esa vista.
- Para empresa y representante, la bandeja muestra `0.00%` cuando no hay porcentaje; eso
  debe ser `—` o “No aplica”, no un cero.
- El modal de revisión muestra el porcentaje en la lista de beneficiarios, leyendo
  `detalle.beneficiarios`.

Corrección recomendada:

- Agregar `porcentaje` numérico a `DdMatrizVinculo` (nullable).
- Propagarlo desde el beneficiario/socio.
- Dejar de parsear `cargo`.
- Mostrar `—` cuando el sujeto no tenga participación declarada.
- No mostrar porcentaje para la empresa o el representante si no son socios.

## 11. Decisión de consolidación: Matriz como fuente única de DD

Esta decisión queda registrada para no volver a crear dos flujos paralelos:

1. **`/matriz` es la fuente operativa de la Debida Diligencia del backoffice.**
2. **Bandeja DD no desaparece como funcionalidad**: queda como una **vista dentro de
   Matriz**, no como módulo/ruta independiente.
3. La vista **Bandeja** de Matriz conserva búsqueda, filtros, paginación, selección,
   acciones, exportación e importación.
4. El detalle de la Matriz (`/matriz/[id]`) debe ser el lugar donde se revisa y resuelve
   el vínculo: datos, documentos, SIG, Comunicaciones/Reputacional, Legal/Compliance,
   evidencias, historial y decisión final.
5. **Revisar desde Matriz debe usar exactamente el mismo flujo de revisión que usaba
   Bandeja DD**; no debe existir un modal o criterio distinto por entrar desde una u otra
   ruta.
6. `/bandeja` quedará como **redirect de compatibilidad** hacia Matriz. No se mantendrán
   dos implementaciones con estados diferentes.
7. El portal del cliente (`/dashboard/debida-diligencia`) sigue siendo un flujo separado
   de consulta y carga; no es la fuente operativa del backoffice.
8. La fuente de verdad del resultado final será la **relación comercial**. Mientras
   `DdRelacionComercial` no esté conectada, el interino es `DdMatrizVinculo`, pero no debe
   tratarse como fuente definitiva.
9. Toda acción de revisión debe pasar por el mismo servicio de estados y dejar historial:
   actor, fecha, estado anterior, estado nuevo, motivo y evidencia.
10. No se elimina `/bandeja` del código hasta que Matriz tenga completas las capacidades
    de revisión, documentos, reputación, Legal, historial y decisión final.

### Estado actual de esta decisión

- La vista **Bandeja dentro de Matriz** ya existe.
- El botón **Revisar expediente** de Matriz ya reutiliza `DdRevisionModal`, igual que
  Bandeja.
- La ruta `/bandeja` y su flujo legacy todavía existen.
- Matriz todavía **no** absorbe por completo las pestañas, acciones y estados de Bandeja.
- Por tanto: la dirección es correcta, pero la consolidación está **en curso**, no
  terminada.

### Regla de trabajo desde ahora

Cualquier nueva acción de revisión, decisión o evidencia se implementa en Matriz y en el
servicio compartido. No se agrega una nueva acción a `/bandeja` ni se duplica la lógica en
el modal legacy. Si una capacidad falta, se migra desde Bandeja a Matriz.

## 12. Homologación del resultado de Bandeja DD

El resultado final que ya mostraba Bandeja DD **sigue siendo el resultado final** de la
empresa/relación. Lo que cambia es que ahora debe expresarse con los seis estados de la
matriz y calcularse por relación comercial, no solo con la acción binaria
aprobar/desaprobar.

| Resultado/estado anterior de Bandeja DD | Nuevo resultado final | Regla |
|---|---|---|
| `APTO` / `aprobada` | `APTO` | Sin pendientes ni observaciones relevantes |
| `APTO CON OBSERVACIONES` | `APTO CON OBSERVACIONES` | Observación menor, subsanada o con seguimiento |
| `NO APTO` / `rechazada` | `NO APTO` | Rechazo de Legal o riesgo crítico |
| `PENDIENTE` / `EN REVISIÓN` / `EN LEGAL` | `EN REVISIÓN` | Todavía no hay decisión final |
| `OBSERVADA` por documentos | `DOCUMENTACIÓN OBSERVADA` | Falta documento/evidencia obligatoria |
| Sin respuesta del cliente | `SIN RESPUESTA` | Venció el plazo de respuesta |

Reglas de adaptación:

1. **Aprobar/desaprobar ya no es suficiente.** La UI debe ofrecer los seis resultados
   finales, con guardas para cada uno.
2. `OBSERVAR` de Bandeja DD no siempre significa `APTO CON OBSERVACIONES`; si falta un
   documento, el estado correcto es `DOCUMENTACIÓN OBSERVADA`.
3. `APTO CON OBSERVACIONES` es un final válido, no un “pendiente”.
4. `EN REVISIÓN` no debe grabar fecha de decisión final ni iniciar vigencia.
5. `SIN RESPUESTA` pertenece a la relación comercial y requiere plazo/cierre automático.
6. El resultado final debe guardarse en la relación comercial; mientras eso no exista,
   `DdMatrizVinculo.resultadoFinal` es el interino.
7. El estado del expediente legacy debe mapearse desde el resultado de la relación, no
   mantenerse por separado.

### 12.1 Alcance de las derivaciones a Comunicaciones y Legal

Hoy **no se puede derivar por vínculo** desde Matriz. Aunque la matriz tenga una fila por
sujeto evaluado, las acciones de revisión siguen trabajando sobre el **expediente
completo**:

| Acción | Unidad que usa hoy | Resultado |
|---|---|---|
| `Enviar a Comunicaciones` en Bandeja | `expedienteId` | Deriva empresa, representante y todos los beneficiarios |
| `Derivar a Comunicaciones` en el modal | `expedienteId` | Deriva todos los nombres del expediente |
| `Derivar a Legal` en Bandeja | `expedienteId` | Cambia el expediente completo a `EN_LEGAL` |
| Revisión de un vínculo | `expedienteId` del vínculo | El modal sigue mostrando y enviando el expediente completo |
| Observación/resultado de área | `DdMatrizVinculo.id` | Sí es por fila mientras se guarda en la matriz |

Por tanto:

- **La observación de las áreas sí puede ser por vínculo** en `dd_matriz_vinculo`.
- **La derivación a Comunicaciones y Legal no es por vínculo**; se ejecuta sobre el
  expediente y arrastra todos sus nombres.
- La unidad correcta para la decisión y el envío no es el expediente ni la fila aislada:
  es la **relación comercial** (`DdRelacionComercial`), con sus sujetos asociados.
- El modal “Revisar expediente” no recibe el id del vínculo seleccionado; recibe el id
  del expediente. Por eso no puede distinguir qué sujeto o relación se está revisando.

### Qué se necesita para hacerlo bien

1. Abrir la revisión desde la fila de matriz con `vinculoId` y
   `relacionComercialId`.
2. Guardar observaciones, resultados y evidencias contra la relación/fila seleccionada.
3. Cambiar `derivarComunicaciones` para recibir la relación o los vínculos elegidos, no
   solo `expedienteId`.
4. Cambiar `revisar`/`resolverLegal` para operar por relación comercial.
5. Crear casos reputacionales por los sujetos de esa relación, no por todos los nombres
   del expediente.
6. Mantener una acción explícita para “enviar todo el expediente” solo si negocio la
   necesita; no como comportamiento por defecto.
7. Refrescar la tabla por fila después de cada acción.

### 12.2 Modal “Revisar expediente” actual

El modal que se abre desde Matriz con **Revisar expediente** sigue siendo el modal legacy
de Bandeja DD (`dd-revision-modal.tsx`). Hoy ofrece solo tres acciones:

| Acción actual | Efecto actual | Problema |
|---|---|---|
| `APTO` | Marca el expediente como `aprobada` | No diferencia resultado final por relación ni `APTO CON OBSERVACIONES` |
| `DOCUMENTACIÓN OBSERVADA` | Marca el expediente como `observada` | Se usa para cualquier observación, aunque no sea documental |
| `DERIVAR A LEGAL` | Envía el expediente a `en_legal` | No es un resultado final; es una transición del flujo |

`EN REVISIÓN`, `NO APTO`, `SIN RESPUESTA` y `APTO CON OBSERVACIONES` no están disponibles
como decisiones finales en ese modal. Por eso el modal **no cubre** los seis estados de la
matriz.

La corrección no es solo agregar botones: hay que separar:

- **Acciones de flujo:** derivar a Comunicaciones, derivar a Legal, solicitar información,
  aprobar/observar/rechazar desde Legal.
- **Resultados finales:** `APTO`, `APTO CON OBSERVACIONES`, `DOCUMENTACIÓN OBSERVADA`,
  `EN REVISIÓN`, `NO APTO`, `SIN RESPUESTA`.
- **Estados automáticos:** `EN REVISIÓN` mientras haya áreas pendientes y `SIN RESPUESTA`
  al vencer el plazo.

### Qué falta para cerrar la homologación

- Reemplazar las acciones `Aprobar / Observar / Desaprobar` por las transiciones de los
  seis estados.
- Agregar `APTO CON OBSERVACIONES`, `DOCUMENTACIÓN OBSERVADA`, `EN REVISIÓN`, `NO APTO` y
  `SIN RESPUESTA` en la revisión de Matriz.
- Evitar que “Marcar APTO” masivo salte las validaciones.
- Implementar la decisión final por relación y su sincronización con el expediente.
- Implementar plazo, recordatorios y cierre `SIN RESPUESTA`.
- Mantener la fecha de decisión y la vigencia de 6 meses en el servicio de estados.
- Añadir historial/auditoría de cada transición y pruebas de todos los escenarios.
