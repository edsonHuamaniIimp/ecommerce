# Debida Diligencia V2 - Tareas pendientes para abordar

> **Fecha:** 2026-11-15
> **Fuente funcional:** `docs/01-funcional/20-debida-diligencia-post-lanzamiento.md`
> **Alcance:** backlog accionable posterior a la sesión interna del 2026-11-13.
> **Estado:** todas las tareas están pendientes salvo que se indique lo contrario.

## Reglas de trabajo

- Cada tarea debe implementarse en el servicio de dominio compartido, no duplicarse en
  componentes.
- Toda transición debe registrar actor, fecha, estado anterior, estado nuevo, motivo y
  evidencia cuando corresponda.
- No se considera terminada una tarea sin pruebas, `tsc`, ESLint y verificación del
  flujo en local.
- El informe final no se implementa antes de estabilizar el resultado final y la
  revisión por vínculo.

## P0 - Necesario para cerrar el proceso

### [ ] DD-P0-01 - Motor de decisión final de la empresa

**Objetivo:** calcular y persistir el resultado final de la empresa/relación a partir de
los vínculos y áreas.

- [ ] Implementar una función de dominio única para calcular el resultado final.
- [ ] Aplicar la regla: todos los vínculos `APTO` ⇒ empresa `APTO`.
- [ ] Si existe al menos un vínculo observado, no cerrar automáticamente y habilitar
  decisión manual de SIG.
- [ ] Aplicar `NO APTO` cuando Legal rechace o exista riesgo crítico.
- [ ] Aplicar `DOCUMENTACIÓN OBSERVADA` cuando falte documentación o evidencia.
- [ ] Mantener `EN REVISIÓN` mientras existan áreas pendientes.
- [ ] Reservar `SIN RESPUESTA` para el cierre por plazo vencido.
- [ ] Sincronizar el resultado con `DebidaDiligencia.estado`.
- [ ] Guardar fecha de decisión, autor, comentario interno y vigencia.
- [ ] Impedir que “Marcar APTO” masivo omita las validaciones.
- [ ] Agregar pruebas para todas las combinaciones de vínculos y áreas.

**Referencias:** `src/application/debida-diligencia/dd-matriz-evaluacion-service.ts`,
`src/application/debida-diligencia/debida-diligencia-service.ts`,
`src/components/debida-diligencia/dd-matriz-bandeja.tsx`,
`prisma/schema.prisma`.

### [ ] DD-P0-02 - Revisión por vínculo en “Revisar expediente”

**Objetivo:** que el modal de revisión muestre las conclusiones de todos los vínculos.

- [ ] Cargar todos los vínculos de la matriz del expediente.
- [ ] Mostrar una fila por vínculo con SIG, Comunicaciones, Legal y resultado final.
- [ ] Mostrar pendientes y observaciones por vínculo.
- [ ] Permitir abrir el detalle completo de cada vínculo.
- [ ] Evitar que la decisión de la empresa se tome sin ver el desglose por vínculo.
- [ ] Agregar pruebas de renderizado y de carga de datos.

**Referencias:** `src/components/debida-diligencia/dd-revision-modal.tsx`,
`src/components/debida-diligencia/dd-revision-matriz-tab.tsx`.

### [ ] DD-P0-03 - Comunicaciones y Legal por vínculo/relación

**Objetivo:** que los resultados de Comunicaciones y Legal se asocien al vínculo o
relación correcta, no solo al expediente.

- [ ] Definir la unidad: vínculo de matriz o relación comercial.
- [ ] Agregar referencia estable al vínculo/relación en los casos reputacionales.
- [ ] Cambiar la derivación a Comunicaciones para aceptar vínculos seleccionados.
- [ ] Mostrar el vínculo exacto en la bandeja de Comunicaciones.
- [ ] Cambiar la revisión legal para operar por relación/vínculo cuando corresponda.
- [ ] Mantener una acción explícita para “derivar todo el expediente” si negocio la
  necesita.
- [ ] Agregar pruebas de derivación y decisión por vínculo.

**Referencias:** `src/application/debida-diligencia/debida-diligencia-service.ts`,
`src/components/debida-diligencia/dd-reputacion.tsx`,
`src/components/debida-diligencia/dd-legal-modal.tsx`,
`prisma/schema.prisma` (`DebidaDiligenciaReputacion`, `DdRelacionComercial`).

### [ ] DD-P0-04 - Plazo de respuesta y cierre `SIN RESPUESTA`

**Objetivo:** cerrar automáticamente la relación cuando venza el plazo configurado.

- [ ] Registrar la fecha de inicio del plazo por cada observación.
- [ ] Calcular días hábiles con el calendario definido por negocio.
- [ ] Implementar job/worker que detecte plazos vencidos.
- [ ] Cambiar el resultado a `SIN RESPUESTA`.
- [ ] Cerrar la relación y el expediente según corresponda.
- [ ] Notificar al cliente y a los responsables.
- [ ] Impedir la reutilización de esa DD; exigir una nueva.
- [ ] Confirmar si el plazo se reinicia con cada observación o corre desde la primera.
- [ ] Agregar pruebas con reloj simulado y feriados.

**Referencias:** `src/application/debida-diligencia/dd-configuracion-service.ts`,
`src/application/debida-diligencia/debida-diligencia-service.ts`,
`prisma/schema.prisma`.

### [ ] DD-P0-05 - Informe PDF con plantilla oficial

**Objetivo:** generar el informe final en PDF con el formato esperado por negocio.

- [ ] Obtener de Lesly el ejemplo completo del informe y el orden de anexos.
- [ ] Implementar la plantilla oficial.
- [ ] Generar PDF en servidor o con un generador reproducible.
- [ ] Incluir datos generales, relación comercial, vínculos, áreas, observaciones y
  conclusión final.
- [ ] Incluir como anexos las evidencias de todos los vínculos.
- [ ] Generar el informe también cuando no haya observaciones.
- [ ] Registrar autor, fecha y versión del PDF generado.
- [ ] Agregar prueba de generación y verificación de contenido.

**Bloqueo:** ejemplo completo del informe enviado por Lesly.

**Referencias:** `src/components/debida-diligencia/dd-informe-detalle.tsx`,
`src/lib/shared/utils/dd-informe.ts`, `dd_configuracion.plantillaInformeUrl`.

### [ ] DD-P0-06 - Aplicar la configuración administrativa

**Objetivo:** hacer que las reglas configuradas se cumplan en los servicios.

- [ ] Aplicar `plazoDiasHabiles` y `estadoCierreAutomatico`.
- [ ] Aplicar `exigirEvidencia`.
- [ ] Aplicar `permitirNaSinEvidencia`.
- [ ] Aplicar `vigenciaMeses` en el cálculo de vencimientos.
- [ ] Aplicar `revalidacionDeclaracion`.
- [ ] Aplicar `legalSoloDerivacionSig`.
- [ ] Aplicar `permitirReutilizacionVinculo`.
- [ ] Probar cada regla con valor activo e inactivo.
- [ ] Mantener `noAptoBloqueaEmpresa`, que ya se aplica.

**Referencias:** `src/application/debida-diligencia/dd-configuracion-service.ts`,
`src/application/debida-diligencia/debida-diligencia-service.ts`,
`src/components/debida-diligencia/dd-configuracion.tsx`.

### [ ] DD-P0-07 - Evidencia obligatoria por campo aplicable

**Objetivo:** exigir evidencia por cada criterio aplicable y eximir solo `N.A.`.

- [ ] Decidir si se usará `DdEvidencia` o una extensión de `DdMatrizAdjunto`.
- [ ] Asociar evidencia a vínculo, campo, resultado, autor y fecha.
- [ ] Exigir archivo y/o link por campo aplicable.
- [ ] Permitir `N.A.` solo con justificación.
- [ ] Validar en backend al guardar y al cerrar.
- [ ] Mostrar la evidencia por celda o grupo de criterios en la matriz.
- [ ] Migrar las evidencias existentes sin perder trazabilidad.
- [ ] Agregar pruebas de campos completos, faltantes y `N.A.`.

**Referencias:** `prisma/schema.prisma` (`DdEvidencia`),
`src/infrastructure/persistence/dd-matriz-evaluacion-repository.ts`,
`src/components/debida-diligencia/dd-matriz-evaluacion-detalle.tsx`.

## P1 - Necesario para la operación completa

### [ ] DD-P1-01 - Documentos adicionales del informe

- [ ] Permitir adjuntar documentos adicionales a la evaluación de empresa o al informe.
- [ ] Mantenerlos como opcionales.
- [ ] Etiquetarlos como `informe` para enviarlos a Araceli/Legal.
- [ ] Incluirlos en la sección de anexos del PDF.
- [ ] Distinguirlos de los cuatro documentos base y de las evidencias de criterios.

### [ ] DD-P1-02 - Publicación del resultado en el portal del cliente

- [ ] Publicar el resultado final de la relación/empresa.
- [ ] Publicar las observaciones que correspondan al cliente.
- [ ] Notificar cambios de estado.
- [ ] Mantener separado el comentario interno de la matriz.
- [ ] Confirmar si el cliente ve el desglose por vínculo o solo el consolidado.

### [ ] DD-P1-03 - Integrar `DdRelacionComercial`

- [ ] Crear repositorio y servicio.
- [ ] Enlazar los vínculos de matriz a la relación comercial.
- [ ] Guardar resultado final, fecha de decisión, vigencia y plazo en la relación.
- [ ] Usar la relación como unidad de bloqueo y reutilización.
- [ ] Migrar los datos existentes sin romper el historial.
- [ ] Agregar pruebas de relación única y múltiples relaciones.

### [ ] DD-P1-04 - Historial y auditoría de transiciones

- [ ] Registrar estado anterior, estado nuevo, actor, fecha, motivo y evidencia.
- [ ] Cubrir aprobaciones, observaciones, derivaciones, reaperturas y cierres.
- [ ] Exponer el historial en el detalle del vínculo y del expediente.
- [ ] No reemplazar la auditoría existente; complementarla.

### [ ] DD-P1-05 - Endurecer automatización de evidencias

- [ ] Evaluar automatización masiva por vínculo.
- [ ] Implementar automatización nacional donde sea viable.
- [ ] Definir manejo de fuentes con login; no automatizarlas sin credenciales.
- [ ] Mover la captura a worker/cola para no bloquear el request.
- [ ] Agregar timeout, reintentos, trazabilidad y validación de PDF.
- [ ] Verificar selectores de Canadá, Banco Mundial, INTERPOL y DEA.
- [ ] Documentar que Australia entrega XLSX y no PDF.
- [ ] Asegurar Chrome/Chromium y `CHROME_PATH` en producción.

## P2 - Calidad, datos y UX

### [ ] DD-P2-01 - Calidad de datos de vínculos

- [ ] Resolver ambigüedad entre representante y beneficiario con el mismo nombre.
- [ ] Revisar `tipoVinculoPersona` para empresas vinculadas.
- [ ] Inferir tipo de documento y ámbito desde documento y nacionalidad.
- [ ] Mostrar `-` o “No aplica” en porcentajes no aplicables.
- [ ] Revisar nombres y cargos genéricos de beneficiarios.
- [ ] Completar links oficiales de fuentes nacionales y criterios faltantes.

### [ ] DD-P2-02 - Consistencia de términos y estados

- [ ] Unificar “vínculo”, “sujeto evaluado” y “relación comercial” en la UI.
- [ ] Normalizar estados legacy y V2 con un mapper único.
- [ ] Revisar que `EN REVISIÓN` no grabe fecha final ni inicie vigencia.
- [ ] Revisar que `APTO CON OBSERVACIONES` se muestre como final válido.
- [ ] Revisar que `SIN RESPUESTA` no se use como estado del expediente legacy.

## Bloqueos externos

- [ ] Ejemplo completo del informe PDF y orden de anexos enviado por Lesly.
- [ ] Confirmación de la regla exacta “todos APTO ⇒ empresa APTO”.
- [ ] Definición del reinicio del plazo y calendario de días hábiles.
- [ ] Definición de si Legal decide por expediente, relación o vínculo.
- [ ] Definición del alcance de los documentos adicionales.
- [ ] Definición de qué resultado ve el cliente en el portal.
- [ ] Links y credenciales de fuentes nacionales y OhMyFin.
- [ ] Chrome/Chromium disponible en producción.

## Orden recomendado

1. `DD-P0-01` Motor de decisión final.
2. `DD-P0-02` Revisión por vínculo.
3. `DD-P0-03` Comunicaciones y Legal por vínculo.
4. `DD-P0-06` Aplicar configuración.
5. `DD-P0-07` Evidencia por campo.
6. `DD-P0-04` Plazo y `SIN RESPUESTA`.
7. `DD-P0-05` Informe PDF.
8. `DD-P1-01` Documentos adicionales.
9. `DD-P1-02` Portal del cliente.
10. `DD-P1-03` `DdRelacionComercial`.
11. `DD-P1-04` Historial y auditoría.
12. `DD-P1-05` Automatización.
13. `DD-P2-*` Calidad y UX.
