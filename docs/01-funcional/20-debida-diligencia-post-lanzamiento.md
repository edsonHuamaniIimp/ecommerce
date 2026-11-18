# Debida Diligencia V2 - Resumen de lanzamiento interno y brechas pendientes

> **Fecha de análisis:** 2026-11-15
> **Fuente principal:** transcripción de la sesión interna del 2026-11-13.
> **Fuentes de contraste:** `docs/01-funcional/11-debida-diligencia.md`,
> `docs/01-funcional/14-debida-diligencia-v2-alcance.md`,
> `docs/01-funcional/18-debida-diligencia-v2-matriz-ui.md`,
> `docs/01-funcional/19-debida-diligencia-v2-flujo-estados.md` y código actual del
> worktree `C:\Proyectos\IIMP\ContratosStands-dd-v2` (rama `feature/dd-v2`).
> **Naturaleza:** análisis funcional y técnico. No se implementaron cambios de código
> para las tareas descritas en este documento.

## 1. Resumen ejecutivo

El módulo ya se puede demostrar de extremo a extremo en varias capacidades:
bandeja de matriz, vista Excel de 54 columnas, detalle por vínculo, automatización de
evidencias para fuentes públicas, importación masiva por carpeta con apoyo de IA,
configuración de reglas y bloqueo de empresa por `NO APTO`.

Sin embargo, el lanzamiento interno confirmó que todavía faltan piezas para cerrar el
proceso real de negocio. Las brechas más importantes no son visuales; son de reglas de
dominio y de cierre:

1. El resultado final de la empresa todavía no se calcula automáticamente desde los
   resultados de sus vínculos.
2. La revisión del expediente no muestra la conclusión por cada vínculo; muestra
   principalmente la fila de la empresa.
3. Comunicaciones y Legal siguen trabajando por expediente, no por vínculo o relación
   comercial.
4. El informe final todavía no se genera con la plantilla PDF oficial ni con los anexos
   y documentos adicionales solicitados.
5. El plazo de respuesta, el cierre `SIN RESPUESTA` y varias reglas de administración
   están configurados en pantalla, pero no se aplican en los servicios.
6. La matriz no exige todavía evidencia por campo aplicable; la evidencia sigue siendo
   un adjunto por vínculo/categoría, no una evidencia vinculada a cada criterio.

En conclusión: el módulo está listo para una **demo operativa**, pero no para declarar
cerrado el flujo de **decisión final, informe oficial y cierre automático**.

## 2. Resumen de la sesión del 2026-11-13

### 2.1 Demostración realizada

- La bandeja de Debida Diligencia se presenta ahora como bandeja de Matriz.
- La bandeja tiene tres vistas: bandeja operativa, matriz de evaluación tipo Excel y
  vista extendida con analíticas.
- La bandeja muestra empresas, vínculos, país, estado por área, resultado final y
  acciones.
- El detalle de un vínculo permite editar criterios, revisar listas, ver conclusiones
  de SIG, Comunicaciones y Legal, adjuntar evidencias y registrar el resultado final.
- Se mostró la automatización de evidencia para fuentes públicas: el sistema abre el
  portal, busca por el nombre/documento y genera una captura/PDF como evidencia.
- Se mostró que las fuentes con login, como OhMyFin, no tienen automatización porque
  requieren credenciales de la entidad.
- Se mostró la importación por carpeta en el centro documental: el sistema lee los
  nombres, permite sugerir clasificación con IA, previsualiza vínculo/categoría e
  importa los archivos.
- Se mostró la configuración administrativa: vigencia, plazo, cierre automático,
  exigencia de evidencia, revalidación, bloqueo por `NO APTO`, reglas de Legal,
  plantillas y auditoría.
- Se mostró la revisión del expediente completo y la selección de conclusiones finales
  de la empresa.

### 2.2 Decisiones y reglas confirmadas en la sesión

1. **La bandeja es el punto de trabajo principal.** Las vistas Excel y extendida se
   conservan para análisis y exportación.
2. **La evaluación es por vínculo**, pero el cierre del proceso se declara sobre la
   empresa/expediente.
3. **Si todos los vínculos quedan APTO, la empresa debe quedar APTO automáticamente**,
   sin obligar a una nueva decisión manual.
4. **Si uno o más vínculos quedan observados, el cierre no debe ser automático**: SIG
   debe poder intervenir manualmente y decidir el resultado del expediente.
5. La revisión de la empresa debe mostrar también **la conclusión por cada vínculo**,
   no solo la conclusión consolidada de la fila de empresa.
6. Comunicaciones deja su resultado por vínculo; SIG toma la decisión final del vínculo
   y, después, la decisión de la empresa.
7. Legal puede aprobar, observar o rechazar. El rechazo de Legal es vinculante.
8. El informe final debe generarse en PDF con la **plantilla oficial** y debe incluir
   los anexos de evidencias de la matriz.
9. Se deben poder adjuntar **documentos adicionales al informe**, especialmente los que
   sustentan observaciones y se envían a Araceli/Legal. Deben ser opcionales.
10. El informe debe generarse también para empresas sin observaciones; en ese caso debe
    indicar que no hay hallazgos.
11. El plazo de respuesta es configurable. En la sesión se mencionó **3 días hábiles**
    como valor operativo inicial.
12. Si vence el plazo sin respuesta, el proceso se cierra como **SIN RESPUESTA** y la
    empresa debe iniciar una nueva DD.
13. La vigencia es configurable; el valor de negocio es **6 meses** desde la decisión
    final.
14. La revalidación con declaración jurada aplica para la misma relación comercial y
    dentro de la vigencia.
15. Si cambia la relación comercial, se inicia una nueva DD.
16. El `NO APTO` de cualquier relación/vínculo bloquea toda la empresa, si la regla
    global está activa.
17. La automatización debe seguir funcionando como captura/PDF de la búsqueda real; las
    fuentes con login quedan fuera del alcance inmediato.
18. Se dejó abierta la posibilidad de un botón de **automatización masiva** para todos
    los criterios de un vínculo, pero no es obligatorio para esta etapa.

## 3. Qué está implementado hoy

### 3.1 Implementado y utilizable

- Bandeja, matriz Excel de 54 columnas y vista extendida.
- Filtro por evento y modo `Todos los eventos` en la matriz.
- Filtro de evento y paginación completa en el repositorio documental.
- Detalle por vínculo con listas, áreas, adjuntos, autor, fecha y resultado final.
- Selección de evento y visualización de país/ámbito por vínculo.
- Resultado final por vínculo con seis estados y comentario interno obligatorio.
- Bloqueo de empresa por vínculo `NO APTO` cuando la configuración está activa.
- Importación por carpeta, incluyendo arrastre de carpetas y lectura recursiva.
- Clasificación opcional con Gemini usando solo nombres de archivo.
- Automatización de evidencia para varias fuentes públicas: OFAC, ONU,
  OpenSanctions, Canadá, Unión Europea, Reino Unido, Banco Mundial, INTERPOL y DEA.
- Evidencia generada como PDF y asociada al vínculo.
- Repositorio documental con documentos base y evidencias, incluyendo estado
  `Sin evidencia` por vínculo.
- Configuración administrativa visible y persistida.

### 3.2 Implementado parcialmente

- **Informe:** existe una vista previa y el botón `Imprimir / PDF`, pero usa la
  impresión del navegador; no usa la plantilla oficial ni genera un PDF de servidor.
- **Comunicaciones:** existen casos reputacionales y se pueden resolver, pero se
  agrupan por expediente/nombre; no están ligados explícitamente al vínculo de matriz.
- **Legal:** existe revisión legal y solicitud de documento adicional, pero opera sobre
  el expediente; no sobre la relación comercial o el vínculo seleccionado.
- **Configuración:** los valores se guardan y se auditan, pero la mayoría no se aplica
  en los servicios de negocio.
- **Evidencias:** se adjuntan por vínculo y categoría, pero no por campo aplicable.
- **Automatización:** funciona para fuentes públicas, pero es síncrona, individual y no
  cubre todavía las fuentes nacionales ni las fuentes con login.

### 3.3 No implementado

- Cálculo automático del resultado final de la empresa a partir de los vínculos.
- Regla "todos APTO ⇒ empresa APTO" y excepción manual si hay observaciones.
- Lista de conclusiones por vínculo dentro del modal `Revisar expediente`.
- Casos reputacionales vinculados formalmente a la fila de matriz/relación.
- Revisión legal por vínculo/relación.
- Informe PDF con la plantilla oficial y anexos ordenados.
- Documentos adicionales opcionales al informe, con etiqueta `informe`.
- Cierre automático `SIN RESPUESTA` por plazo de días hábiles.
- Publicación del resultado final en el portal del cliente.
- Evidencia obligatoria por campo aplicable y exención por `N.A.`.
- Uso real de `DdRelacionComercial` y `DdEvidencia`.
- Historial completo de transiciones con estado anterior/nuevo y motivo.

## 4. Brechas y tareas pendientes

### P0 - Necesario para cerrar el proceso

#### P0.1 Calcular y sincronizar el resultado final de la empresa

**Estado actual**

- `DdMatrizVinculo.resultadoFinal` se guarda por vínculo.
- La fila de empresa se usa como resumen, pero su resultado se registra manualmente
  desde `Revisar expediente` o desde la bandeja.
- No existe una función de dominio que aplique la regla "todos APTO ⇒ empresa APTO" ni
  la excepción "si hay observaciones, decidir manualmente".
- El estado del expediente legacy y el resultado de la matriz pueden divergir.

**Qué falta**

- Crear un servicio de dominio único que calcule el resultado de la relación/empresa.
- Aplicar la regla acordada:
  - todos los vínculos `APTO` ⇒ empresa/relación `APTO`;
  - si hay al menos un vínculo observado ⇒ no cerrar automáticamente y permitir
    decisión manual;
  - `NO APTO` de Legal o riesgo crítico ⇒ `NO APTO`;
  - falta de evidencia/documento ⇒ `DOCUMENTACIÓN OBSERVADA`;
  - áreas pendientes ⇒ `EN REVISIÓN`;
  - plazo vencido ⇒ `SIN RESPUESTA`.
- Guardar fecha, autor, comentario y vigencia en la unidad correcta.
- Sincronizar `DebidaDiligencia.estado` y el resultado de la relación.
- Impedir que se marque `APTO` masivo sin validar áreas, evidencias y pendientes.
- Añadir pruebas de todas las combinaciones.

**Archivos relacionados**

- `src/application/debida-diligencia/dd-matriz-evaluacion-service.ts`
- `src/components/debida-diligencia/dd-matriz-bandeja.tsx`
- `src/components/debida-diligencia/dd-revision-modal.tsx`
- `src/infrastructure/persistence/dd-matriz-evaluacion-repository.ts`
- `src/application/debida-diligencia/debida-diligencia-service.ts`
- `prisma/schema.prisma` (`DdMatrizVinculo`, `DdRelacionComercial`)

#### P0.2 Revisión por vínculo en `Revisar expediente`

**Estado actual**

- El tab Matriz del modal carga la fila de la empresa.
- El resumen del expediente muestra empresa, representante y beneficiarios.
- No se listan las conclusiones de cada vínculo en el mismo modal.
- `dd-revision-matriz-tab.tsx` recibe un solo detalle de matriz.

**Qué falta**

- Cargar todos los vínculos del expediente en el tab Matriz.
- Mostrar una fila/resumen por vínculo con SIG, Comunicaciones, Compliance y resultado
  final.
- Permitir abrir el detalle del vínculo desde esa fila.
- Mostrar pendientes por vínculo y no solo pendientes del expediente.
- Evitar que la decisión de la empresa se tome sin ver el desglose por vínculo.

#### P0.3 Comunicaciones y Legal por vínculo/relación

**Estado actual**

- `DdReputacion` guarda `expedienteId` y `nombreARevisar`, no `vinculoId`.
- `derivarComunicaciones` recibe `expedienteId`.
- `resolverLegal` recibe `expedienteId`.
- El modelo `DdRelacionComercial` existe, pero no está conectado a servicios ni a UI.

**Qué falta**

- Definir si el caso reputacional se abre por vínculo o por nombre dentro de la
  relación.
- Agregar referencia estable al vínculo/relación en los casos reputacionales.
- Mostrar en Comunicaciones el vínculo exacto y su sustento.
- Permitir que Legal revise y decida por relación/vínculo cuando corresponda.
- Mantener una acción explícita para derivar todo el expediente, si negocio la
  necesita.

#### P0.4 Plazo de respuesta y cierre `SIN RESPUESTA`

**Estado actual**

- La configuración guarda `plazoDiasHabiles` y `estadoCierreAutomatico`.
- No existe job, cron o worker que cierre por vencimiento.
- No se registra de forma consistente el inicio del plazo por observación de cada área.
- `SIN RESPUESTA` existe como estado, pero no se activa automáticamente.

**Qué falta**

- Registrar la fecha de la observación que abre el plazo.
- Calcular días hábiles con calendario/configuración.
- Ejecutar un job programado o worker que cierre las relaciones vencidas.
- Cambiar el resultado a `SIN RESPUESTA`, cerrar la relación y auditar.
- Notificar al cliente y a los responsables.
- Impedir la reutilización de esa DD; exigir una nueva.
- Definir si el plazo se reinicia con cada observación o si corre desde la primera.

#### P0.5 Informe PDF con plantilla oficial

**Estado actual**

- `DdInformeDetalle` arma una vista HTML con datos, vínculos, áreas, observaciones,
  anexos y conclusión final.
- El botón `Imprimir / PDF` usa `window.print()`.
- `plantillaInformeUrl` existe en la configuración, pero no se usa.
- No hay un generador de PDF de servidor ni una plantilla oficial integrada.
- Los anexos son únicamente los adjuntos de la matriz; no incluyen documentos
  adicionales del informe.

**Qué falta**

- Obtener de negocio el ejemplo completo del informe en PDF.
- Implementar la plantilla oficial y el orden de secciones.
- Generar el PDF en servidor o mediante un generador reproducible, no solo imprimir la
  pantalla.
- Incluir anexos de evidencias de todos los vínculos.
- Incluir documentos adicionales opcionales, etiquetados como `informe`.
- Generar el informe también cuando no hay observaciones.
- Versionar el PDF generado y registrar autor/fecha.

**Bloqueo externo:** Lesly se comprometió a enviar un ejemplo completo del formato de
informe. Sin ese insumo no se puede cerrar la maqueta exacta.

#### P0.6 Aplicar la configuración administrativa

**Estado actual**

- La configuración se guarda en `dd_configuracion`.
- `noAptoBloqueaEmpresa` sí se usa en la evaluación de empresa y en clientes.
- Los demás valores no se aplican en el flujo:
  - `plazoDiasHabiles`
  - `estadoCierreAutomatico`
  - `exigirEvidencia`
  - `permitirNaSinEvidencia`
  - `revalidacionDeclaracion`
  - `legalSoloDerivacionSig`
  - `vigenciaMeses`
  - `permitirReutilizacionVinculo`

**Qué falta**

- Inyectar la configuración en los servicios de matriz, cierre, revalidación y Legal.
- Bloquear el cierre si falta evidencia y la regla está activa.
- Permitir `N.A.` sin evidencia solo si la regla lo autoriza.
- Usar la vigencia configurada para calcular vencimientos.
- Respetar la revalidación y la reutilización de relación.
- Impedir que Legal actúe sin derivación de SIG cuando la regla esté activa.
- Probar cada regla con valores activos e inactivos.

#### P0.7 Evidencia por campo aplicable

**Estado actual**

- `DdMatrizAdjunto` guarda un archivo por vínculo y categoría.
- `DdEvidencia` existe en el esquema con `relacionComercialId`, `matrizVinculoId`,
  `campo`, `resultado`, `archivoUrl` y `linkExterno`, pero no se usa.
- La UI permite adjuntar un archivo; no exige uno por cada lista o campo aplicable.
- La importación puede asignar una categoría de criterio, pero no completa una matriz
  de evidencia por campo de forma obligatoria.

**Qué falta**

- Decidir si se usará `DdEvidencia` o una extensión de `DdMatrizAdjunto`.
- Asociar evidencia a vínculo + campo + resultado + autor + fecha.
- Exigir archivo y/o link en cada campo aplicable.
- Eximir solo `N.A.` y registrar la justificación.
- Mostrar evidencia por celda o grupo de criterios en la matriz.
- Validar en backend al guardar/cerrar, no solo en UI.

### P1 - Necesario para operación completa

#### P1.1 Documentos adicionales del informe

- Permitir adjuntar documentos adicionales a la evaluación de empresa o al informe.
- Deben ser opcionales.
- Deben poder etiquetarse como `informe` para enviarlos a Araceli/Legal.
- Deben aparecer en la sección de anexos del PDF.
- Deben distinguirse de los adjuntos de criterios y de los cuatro documentos base.

#### P1.2 Publicación en el portal del cliente

- Publicar el resultado final y las observaciones en el portal.
- Notificar al cliente cuando el resultado cambie.
- Mantener separado el comentario interno de la matriz del mensaje visible al cliente.
- Validar si el cliente debe ver el desglose por vínculo o solo el resultado de la
  empresa/relación.

#### P1.3 Integrar `DdRelacionComercial`

- Crear repositorio y servicio.
- Enlazar los vínculos de matriz a la relación comercial.
- Guardar resultado final, fecha de decisión, vigencia y plazo en la relación.
- Usar la relación como unidad de bloqueo y reutilización.
- Migrar los datos existentes sin romper el historial.

#### P1.4 Historial y auditoría de transiciones

- Registrar estado anterior, estado nuevo, actor, fecha, motivo y evidencia.
- Cubrir aprobaciones, observaciones, derivaciones, reaperturas y cierres.
- Exponer el historial en el detalle del vínculo y del expediente.
- No sustituir la auditoría existente; complementarla con una máquina de estados.

#### P1.5 Cierre de automatización de evidencias

- Agregar automatización masiva por vínculo si negocio la confirma.
- Añadir automatización para fuentes nacionales donde sea viable.
- Definir el manejo de fuentes con login; no automatizarlas sin credenciales formales.
- Mover la captura a un worker/cola para no bloquear el request HTTP.
- Agregar timeout, reintentos, trazabilidad y manejo de PDFs inválidos.
- Validar selectores y resultados de Canadá, Banco Mundial, INTERPOL y DEA.
- Documentar que Australia entrega XLSX y no PDF.

### P2 - Calidad, datos y UX

- Corregir la duplicidad de nombres que impide distinguir representante y beneficiario
  en la importación; el usuario debe elegir explícitamente.
- Revisar `tipoVinculoPersona`: una empresa vinculada no debe evaluarse con listas de
  persona.
- Inferir `tipoDocumento` y `ámbito` desde documento y nacionalidad.
- No mostrar `0.00%` para empresa o representante sin participación.
- Mostrar `-` o `No aplica` cuando corresponda.
- Completar links oficiales de fuentes nacionales y criterios sin URL.
- Revisar el estado de la declaración de vigencia y su bloqueo en Solicitudes.
- Unificar términos `vínculo`, `sujeto evaluado` y `relación comercial` en la UI.

## 5. Bloqueos y decisiones externas

| Tema | Qué necesitamos | Impacto |
|---|---|---|
| Plantilla de informe | Ejemplo PDF completo y orden de anexos enviado por Lesly | Bloquea P0.5 |
| Regla de cierre | Confirmar si "tres APTO" significa todos los vínculos o solo tres sujetos | Bloquea P0.1 |
| Plazo | Confirmar si se reinicia por cada observación y qué calendario de días hábiles se usa | Bloquea P0.4 |
| Legal | Confirmar si la decisión es por relación, vínculo o expediente | Bloquea P0.3 |
| Documentos adicionales | Confirmar si son por empresa, por evaluación o por observación | Bloquea P1.1 |
| Portal | Confirmar qué resultado y qué observaciones ve el cliente | Bloquea P1.2 |
| Fuentes | Credenciales/links oficiales para fuentes nacionales y OhMyFin | Bloquea automatización nacional |
| Producción | Chrome/Chromium disponible en el servidor y `CHROME_PATH` | Bloquea automatización en producción |

## 6. Orden recomendado

1. **Cerrar el dominio de decisión final:** P0.1, P0.2 y P0.3.
2. **Aplicar reglas de negocio reales:** P0.6 y P0.7.
3. **Implementar plazo y cierre:** P0.4.
4. **Implementar informe oficial:** P0.5 y P1.1.
5. **Publicar en portal y conectar relación comercial:** P1.2 y P1.3.
6. **Endurecer automatización y auditoría:** P1.4 y P1.5.
7. **Cerrar calidad de datos y UX:** P2.

No conviene implementar el PDF antes de estabilizar el resultado final y la decisión por
vínculo, porque el informe depende de ambos.

## 7. Escenarios de aceptación

- Tres vínculos APTO ⇒ resultado de empresa APTO automático, con fecha de decisión y
  vigencia.
- Un vínculo APTO CON OBSERVACIONES ⇒ el sistema no cierra automáticamente y SIG puede
  decidir el resultado de la empresa.
- Un vínculo NO APTO ⇒ empresa bloqueada si la configuración lo indica.
- Un vínculo sin evidencia obligatoria ⇒ no se permite APTO; se marca DOCUMENTACIÓN
  OBSERVADA.
- Un `N.A.` correctamente justificado ⇒ no exige evidencia.
- Un cliente no responde dentro del plazo ⇒ cierre `SIN RESPUESTA`, notificación y
  exigencia de nueva DD.
- Comunicaciones registra hallazgo en un vínculo ⇒ la conclusión queda visible en la
  fila de ese vínculo, no solo en el expediente.
- Legal rechaza una relación ⇒ la relación queda NO APTO y la empresa se bloquea.
- Informe sin observaciones ⇒ PDF generado con sección "sin hallazgos".
- Informe con observaciones ⇒ PDF con observaciones y documentos adicionales como
  anexos.
- Revalidación de la misma relación dentro de vigencia ⇒ declaración jurada y sin nueva
  DD.
- Cambio de relación comercial ⇒ nueva DD, sin reutilizar la anterior.

## 8. Preguntas para negocio

1. ¿La regla "tres APTO" significa todos los vínculos evaluados o solo los tres
   primeros?
2. Si un vínculo queda observado, ¿quién puede forzar el cierre de la empresa y con qué
   justificación?
3. ¿El plazo de respuesta corre desde la primera observación o se reinicia con cada
   observación de SIG, Comunicaciones y Legal?
4. ¿Qué calendario de días hábiles se usa y qué pasa con feriados?
5. ¿Legal decide por expediente, por relación comercial o por vínculo?
6. ¿El informe se genera para todas las empresas o solo para las que tienen
   observaciones?
7. ¿Los documentos adicionales del informe son por empresa, por evaluación o por
   observación?
8. ¿El cliente debe ver el resultado por vínculo o solo el resultado consolidado de la
   relación?
9. ¿Qué plantilla exacta y qué orden de anexos debe usar el PDF?
10. ¿Qué fuentes nacionales se automatizarán y con qué links/credenciales?
