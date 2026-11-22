# Debida Diligencia - Reunión de transferencia de conocimiento (SIG)

> **Fecha de la reunión:** 2026-10-27 (sesión de 10:00 a 15:00 aprox., con pausa de almuerzo).
> **Participantes:** Lesly Alvarado (SIG / Sistema Integrado de Gestión, quien opera la matriz) y Edson Huamani (desarrollo).
> **Objetivo:** transferir el proceso real de Debida Diligencia (DD) para alinear el módulo con la operación y la matriz Excel de SIG.
> **Alcance de este documento:** solo lo que impacta a DD. Quedan fuera los temas de contratos, facturación y otros asuntos tratados de paso.
> **Documentos relacionados:** [`14-debida-diligencia-v2-alcance.md`](./14-debida-diligencia-v2-alcance.md), [`19-debida-diligencia-v2-flujo-estados.md`](./19-debida-diligencia-v2-flujo-estados.md), [`22-dd-dictamen-por-vinculo-estrategia.md`](./22-dd-dictamen-por-vinculo-estrategia.md), [`24-dd-pruebas-integracion-qa.md`](./24-dd-pruebas-integracion-qa.md).

## 1. Cómo opera SIG hoy (proceso manual)

1. El cliente llena un formulario (Google Forms) con sus datos y adjunta ficha RUC, vigencia de poderes y DNI del representante. Los adjuntos llegan a la cuenta de Logística.
2. SIG traslada los datos a la **matriz Excel** (una fila por vínculo evaluado) y guarda las evidencias en una carpeta de Drive por empresa, con un número que coincide con la columna A de la matriz.
3. SIG evalúa listas restrictivas, consulta Sentinel y arma las evidencias de cada vínculo.
4. SIG envía a **Comunicaciones** (equipo reputacional) la lista de empresas y personas, en grupos al final del día (no uno por uno).
5. Comunicaciones devuelve por correo su resultado por nombre (aceptado u observado, con comentario y fuente).
6. SIG concluye. Si corresponde, deriva a **Legal** con un informe en el formato de SIG y un link de Drive con todas las evidencias.
7. Legal responde por correo (acepta, observa o rechaza). SIG registra el resultado final en la matriz y se refleja en el Excel de resultados que consultan Asociados y Comercial.

Cola real al día de la reunión: 411 empresas habían enviado el formulario; avanzaban unas por día.

## 2. Qué se evalúa: vínculos

- Siempre se evalúa a la **empresa**, y después a las personas y empresas vinculadas:
  representantes legales, apoderados, directores, gerentes, socios y accionistas.
- **Regla del 10 %:** si la SUNAT (ficha RUC, "otras personas vinculadas") muestra porcentaje, solo se evalúa a quien tenga **más del 10 %**. Si **no hay porcentaje** (director, apoderado, gerente), se evalúa de todos modos. Los cargos importantes se evalúan aunque tengan una participación mínima.
- Una persona puede aparecer dos veces (representante y socio): es el mismo sujeto con dos vínculos y se evalúa una vez.
- Una empresa vinculada con RUC peruano también es un vínculo y se evalúa. **Se evalúa un solo nivel**: no se baja a los vínculos de esa empresa vinculada.
- Si una persona figura como **inactiva** en el documento de una empresa extranjera, no se evalúa (ya no tiene vínculo).
- Cada vínculo genera una fila. Los datos de la empresa se repiten idénticos en todas las filas del mismo expediente.
- El documento de identidad debe estar bien escrito: si no, la consulta en Sentinel trae a otra persona.

### Nacionales y extranjeros

| | Nacional | Extranjero |
|---|---|---|
| Fuente principal | Sentinel (créditos, listas restrictivas, PEP), INDECOPI | OFAC, Naciones Unidas, OpenSanctions, OhMyFin, Banco Mundial, Interpol, DEA |
| Listas por país | No aplica | Sanciones de Canadá, Unión Europea y Australia solo si el vínculo pertenece a ese país |
| Interpol y DEA | No aplica | Solo para personas, no para empresas |
| Estado SUNAT activo/habido | Sí | No aplica |
| Fecha de inicio de actividades | Sí | No se pide |

- Una misma empresa puede tener vínculos nacionales y extranjeros; a cada uno se le habilitan sus criterios.
- Las listas internacionales son búsquedas individuales y gratuitas con límites de consultas.
- Los identificadores de empresas extranjeras no tienen un formato único (largo y nombre varían por país).
- El formulario es una declaración jurada: se asume veraz lo que el cliente declara cuando no hay otro documento.

## 3. Criterios de evaluación y evidencias

- Cada criterio se responde SI / NO / N.A. y **todo se respalda con evidencia** (PDF o captura con fecha visible).
  SIG la necesita para auditorías y para responder si alguien pregunta "¿por qué lo aprobaron?".
- Criterios típicos: corrupción/soborno/lavado, PEP, OEFA, OSCE, INDECOPI, central de riesgo, conflicto de interés con el IIMP (se compara con el comité directivo de 16 personas) y bancarización. Los dos últimos son criterio propio de SIG sobre lo que se vio en Sentinel.
- Un **SI en un criterio no implica por sí solo un problema grave**: SIG investiga la fuente y decide. Ejemplos:
  - PEP por haber sido candidato sin antecedentes: se observa, pero la conclusión puede quedar sin observaciones.
  - Sanciones administrativas de OEFA a mineras (plazos incumplidos): sin observaciones. Derrames o contaminación sí requieren Legal.
  - Deuda menor en Sentinel (por ejemplo, S/ 98 o S/ 1 360 en una empresa grande): no limita.
  - Lavado de activos: **siempre va a Legal**.
- Las evidencias se nombran con un orden y un concepto (lista + persona). En la plataforma se acordó un **formato de nombre de archivo** que permita reconocer a qué vínculo pertenece y de qué tipo es. Ejemplo acordado: `01. <concepto/lista> - <nombre de la empresa o DNI de la persona>`.
- Se necesita un repositorio donde una persona de SIG pueda ver, en una sola vista, **todos los documentos de una empresa**, agrupados primero por la empresa y luego por cada representante o socio, con filtros y fecha de carga.

## 4. Áreas y resultados

| Área | Qué hace | Qué registra | Quién concluye |
|---|---|---|---|
| **SIG (Logística)** | Evalúa listas y datos de cada vínculo | Resultado (aceptado / observado) + observación + conclusión | SIG |
| **Comunicaciones** | Revisa prensa, entrevistas y fuentes abiertas por nombre | Resultado (aceptado / observado) con comentario y **fuente (link)**. No elabora informe | SIG decide la conclusión reputacional |
| **Legal (Compliance)** | Revisa el informe y las evidencias del expediente | Resultado y observación; puede observar, aceptar o rechazar | Legal (su decisión es final en su parte) |

- Comunicaciones recibe solo datos básicos de la empresa (RUC, nacionalidad) y la lista de personas con documento, nacionalidad y cargo. Su resultado por nombre es una **alerta con fuente**.
- Si Comunicaciones observa, **SIG puede refutarlo**: sin sustento suficiente o con una noticia antigua o inconsistente, la conclusión reputacional puede quedar sin observaciones. Si el link no menciona a la persona, SIG pide a Comunicaciones el link correcto.
- Si Comunicaciones acepta, la conclusión reputacional debe **autocompletarse como sin observaciones**. Si observa, SIG debe poder editarla.
- Lo mismo en SIG: un resultado aceptado debe autocompletar "sin observaciones".

### Conclusiones posibles

- **Sin observaciones**: continúa sin Legal.
- **Requiere debida diligencia reforzada**: va a Legal.
- Una observación grave de **cualquier** vínculo o de la empresa marca a **todo el expediente** como "requiere debida diligencia reforzada", porque Legal recibe el expediente completo, no una persona.

## 5. Derivación a Legal

- **Cuándo:** cuando la conclusión de SIG y/o la reputacional es "requiere debida diligencia reforzada" (en la práctica, ambas áreas coinciden). Los casos de lavado de activos siempre van.
- **Qué recibe Legal:**
  - Un informe de SIG (formato propio, ver sección 8).
  - El acceso a todas las evidencias del expediente (hoy un link de Drive por empresa). Con la plataforma, el sistema reemplaza el link con el repositorio, pero se pidió mantener el link como compatibilidad al inicio.
  - Los documentos que subió el cliente (ficha RUC, vigencia de poderes y DNI), que también sirven a Legal para el contrato.
- **Qué responde Legal:**
  - **Acepta (conformidad):** el expediente queda APTO aunque SIG y Comunicaciones hubieran pedido reforzar.
  - **Observa / pide más información:** solicita documentos al cliente (ej.: declaración firmada por el representante sobre prácticas anticompetitivas, carta de aclaración, declaración jurada de integridad). Antes pasaba por SIG; ahora **el cliente lo recibe directo** y subsana en la plataforma.
  - **Rechaza:** el resultado es **NO APTO**. El texto del correo de Legal no lo interpreta el sistema, por eso **Legal debe marcar el estado**.
- Casos reales que ilustran los desenlaces: aprobado a pesar de sanción de INDECOPI; aprobado tras recibir una declaración del representante; rechazado por un gerente con investigación por lavado de activos; sin respuesta de la empresa tras pedir información.

## 6. Observación y subsanación con el cliente

- SIG y Legal pueden **observar** al cliente. La empresa vuelve a entrar y completa o corrige.
- Casos reales de observación de SIG: ficha RUC desactualizada (debe tener 3 meses de antigüedad, no un año), representantes incompletos (falta un socio que figura en la ficha RUC).
- Si el cliente envía datos incompletos, SIG **no** debe derivar a Comunicaciones hasta validar que la información está completa: evaluar datos incorrectos es esfuerzo perdido.
- Con la plataforma, la derivación a Comunicaciones es **por empresa, en el momento de la validación**, no por grupos al final del día.
- **Tiempo límite de respuesta del cliente:** no existía; se propuso establecerlo para no dejar expedientes abiertos indefinidamente (ejemplo hablado: 2 a 3 días; está por definir). Caso real sin respuesta: una empresa que no respondió y volvió a postular meses después.
- Tras subsanar, el expediente vuelve a la bandeja del área que observó.

## 7. Conclusión final del expediente (resultado final)

Solo se usa "apto / no apto" en el **resultado final**; en las áreas se usa aceptado, observado, sin observaciones o rechazado.

| Resultado final | Cuándo |
|---|---|
| **APTO** | Todo limpio, o Legal aceptó. Es lo que ven Asociados y Comercial |
| **APTO CON OBSERVACIONES** | Se observó y la empresa subsanó (ej.: entregó una declaración). En la práctica equivale a apto, pero marca un antecedente para ser más rigurosos si vuelve |
| **DOCUMENTACIÓN OBSERVADA** | El cliente debe corregir o reenviar documentos |
| **EN REVISIÓN** | En proceso: SIG, Comunicaciones o Legal aún no terminan. Ayuda a Comercial a saber que no está olvidada |
| **NO APTO** | Legal rechaza |
| **SIN RESPUESTA DE LA EMPRESA** | El cliente no respondió a una observación |

- El resultado final es **por empresa**: se registra el mismo valor en todas las filas de sus vínculos.
- **SIG registra el resultado final**, incluso si Legal o Comunicaciones tuvieron otra opinión; si Legal rechaza, el sistema debe pasar a NO APTO automáticamente.
- **Fecha de la decisión final:** hay que registrarla porque **desde ahí corre la vigencia de 6 meses**. La matriz de SIG no la tenía. El historial de eventos del sistema ya guarda cuándo se derivó, observó, aprobó o rechazó, por lo que se puede derivar de ahí.
- Tiempo de revisión interno: máximo 7 días hábiles; en el peor caso unos 15.

## 8. Informe para Legal

- Es un respaldo de SIG ("mi informe de lo que encontré"), no un dictamen. Legal puede aprobarlo y la responsabilidad de la decisión pasa a Legal.
- Estructura: datos de la empresa y representante; cumplimiento legal (SUNAT, INDECOPI); reputación y ética (corrupción, PEP, OSCE, OEFA, conflicto de interés); reporte tributario (Sentinel: centrales de riesgo, beneficio mutuo, motivo de la evaluación); evaluación final con recomendación; observaciones y conclusiones; y anexos.
- Se **completa solo desde la matriz**, salvo estos campos de redacción manual:
  - **3.1 Detalle del hallazgo** (solo si hay corrupción, soborno o lavado de activos).
  - **Detalle de las observaciones** (sección 6): redacción larga por hallazgo (por ejemplo: fecha del acto, resolución, detalle, qué hizo la empresa, estado actual).
  - **Conclusiones** y **anexos** (reporte periodístico, resoluciones).
  - La recomendación ("requiere reforzar la revisión") debería leerse de la decisión, pero puede marcarse a mano.
- El informe se redacta sobre la persona observada cuando la empresa está limpia: "Aquí sigo poniendo la empresa porque son datos de la empresa, pero en el cuerpo me dirijo a la persona observada".
- Deseo de desarrollo: poder ver la **vista previa** y **descargar el informe con un clic**, y que el sistema lo envíe a Legal sin que SIG suba una plantilla.
- **Pendiente de Lesly:** ejemplo completo del informe y orden de anexos; links de las plataformas de consulta para extranjeros.

## 9. Vigencia y reutilización de una DD

- La DD vale **6 meses**. Cuenta desde la fecha de la decisión final.
- Si la empresa fue APTA y está vigente, y vuelve a postular a otro evento (por ejemplo, de Proexplo a Perumín) o cambia a una categoría de **riesgo similar**, **no se rehace**: basta la **declaración jurada de vigencia** de que sus datos siguen iguales.
- Si cambia a una categoría de **riesgo mayor** (de exhibidor a auspiciador, o a asociado adherente), se hace **una nueva debida diligencia**, porque el riesgo reputacional del auspiciador es mayor.
- Los alquileres cortos de ambientes (por ejemplo, una sala por una noche) tienen un riesgo mucho menor y no requieren DD nueva.
- **Acuerdo final de la reunión (cambió durante la sesión):** tanto "apto" como "apto con observaciones" que estén dentro de los 6 meses se renuevan con la declaración de vigencia. No se crea una regla distinta para "apto con observaciones". Lo que queda con ese estado sirve a SIG como alerta interna para revisar con más rigor en el futuro.
- Una empresa que ya no tiene la declaración y está fuera de los 6 meses repite la DD completa.
- **Para Comercial y Asociados:** una empresa con vigencia pero sin declaración de vigencia **no debe verse como APTA**; debe verse como "no apta" hasta que la envíe.
- Categorías de vínculo comercial hoy: alquileres, exhibidores, auspiciadores, medios aliados (media partner), asociados (personas), asociados adherentes (empresas) y proveedores. La plataforma cubre por ahora a los exhibidores.
- El cliente puede marcar **varios vínculos** (por ejemplo, exhibidor y proveedor), y debe existir la opción **Otros** con texto libre. Para los casos que irán a Legal, SIG (o Asociados) debería **validar el motivo declarado**, porque un exhibidor que en realidad quiere ser auspiciador tiene más riesgo.
- Datos que informan al informe pero **no cambian la conclusión**: historial con el IIMP y beneficio mutuo. El historial importa de todos los años (una empresa nueva recibe una revisión más rigurosa de Legal). No existe un caso real de beneficio unilateral.

## 10. Reglas y requerimientos que se derivan para el sistema

| # | Regla o requerimiento | Origen |
|---|---|---|
| R1 | Evaluar empresa + vínculos con regla del 10 % cuando hay porcentaje; sin porcentaje se evalúa siempre; un solo nivel de profundidad | Sección 2 |
| R2 | Habilitar criterios distintos para vínculos nacionales y extranjeros; Interpol/DEA solo personas; listas por país solo si el vínculo es de ese país | Sección 2 |
| R3 | Evidencia por criterio y por vínculo, con fecha; nombrado de archivos acordado | Sección 3 |
| R4 | Resultado de Comunicaciones por vínculo con fuente (links o archivo); SIG decide la conclusión reputacional | Sección 4 |
| R5 | Autocompletar "sin observaciones" cuando el resultado es aceptado; permitir editar cuando es observado | Sección 4 |
| R6 | Observación grave de cualquier vínculo marca a todo el expediente "requiere DD reforzada" | Sección 4 |
| R7 | Derivar a Legal con informe y acceso a todas las evidencias; Legal observa, acepta o rechaza y marca el estado | Sección 5 |
| R8 | SIG y Legal pueden observar al cliente; el cliente subsana directo; plazo límite de respuesta por definir | Sección 6 |
| R9 | No derivar a Comunicaciones hasta validar que los datos del cliente están completos | Sección 6 |
| R10 | Resultado final por empresa; Legal rechaza implica NO APTO; registrar la **fecha de decisión** | Sección 7 |
| R11 | Estados finales: APTO, APTO CON OBSERVACIONES, DOCUMENTACIÓN OBSERVADA, EN REVISIÓN, NO APTO, SIN RESPUESTA | Sección 7 |
| R12 | Informe automático desde la matriz con campos manuales (3.1, observaciones, conclusiones, anexos), vista previa y descarga | Sección 8 |
| R13 | Vigencia de 6 meses; declaración de vigencia para apto y apto con observaciones; nueva DD si sube el riesgo; sin declaración no se muestra como apto | Sección 9 |
| R14 | Varios vínculos comerciales por solicitud y opción "Otros"; validación del motivo antes de Legal | Sección 9 |
| R15 | Repositorio de documentos con vista única por empresa, filtros por vínculo, tipo y fecha, e importación de carpeta por nombres | Sección 3 |
| R16 | Excel de resultados para Asociados y Comercial: una fila por empresa con resultado final y vigencia | Sección 7 y 9 |

## 11. Pendientes acordados al cierre de la reunión

1. Lesly envía la plantilla/ejemplo del informe y los links de consulta para extranjeros.
2. Desarrollo digitaliza el proceso y entrega el mockup de todas las vistas para su validación.
3. Se habilita a Lesly un usuario de la plataforma para ver las empresas.
4. Plan de contingencia: SIG actualiza cada día el Excel de resultados (sube al final del día, entre las 18:00 y las 21:00) y desarrollo lo carga; solo se necesita el resultado final y la vigencia.
5. La plataforma por ahora solo cubre exhibidores; el resto de categorías sigue en la matriz de SIG, por lo que habrá un periodo con dos Excel.
