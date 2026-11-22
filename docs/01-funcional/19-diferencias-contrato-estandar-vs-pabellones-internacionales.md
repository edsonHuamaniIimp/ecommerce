# Diferencias entre el contrato estándar y el contrato de Pabellones Internacionales

**Fecha:** 17/11/2026 · **Actualizado:** 22/11/2026  
**Vigencia:** el análisis de cláusulas sigue vigente. Desde el 17/11 la plantilla Pabellones Internacionales cambió: **Anexo 3-A eliminado**, **cuotas dinámicas de 1 a 9**, **moneda y cuentas dinámicas USD/PEN**, y el representante se toma del **representante legal de la empresa**. Donde el texto histórico diga lo contrario, está marcado como *(superado)*. El flujo de la solicitud está en el documento [18](18-reserva-administrativa-empresas-extranjeras.md).  
**Alcance:** comparación documental y funcional de contenido, anexos, firmas y placeholders. No es un dictamen legal.  
**Plantilla A — Estándar:** `plantillas/contrato-perumin38-tags.docx`  
**Plantilla B — Pabellones Internacionales:** `plantillas/contrato-p38-operador-tags.docx`  
**Versión EN:** `plantillas/contrato-perumin38-tags-en.docx` es la traducción de la estándar. La plantilla Pabellones Internacionales no tiene versión EN propia; el backend usa la versión ES también para solicitudes en inglés.

---

## 1. Resumen ejecutivo

No son dos versiones de un mismo contrato con cambios de formato. Son **dos contratos de naturaleza distinta**:

- **A — Contrato de Exhibición:** contrato directo entre el IIMP y un exhibidor para usar uno o varios módulos en EXTEMIN.
- **B — Contrato de Participación del Operador Internacional:** contrato entre el IIMP y un operador que recibe un bloque de módulos para formar un pabellón internacional y asignarlos temporalmente a empresas de su país.

Las diferencias principales son:

| Tema | Contrato estándar | Pabellones Internacionales |
|---|---|---|
| Contraparte | EL EXHIBIDOR | EL OPERADOR |
| Objeto | Uso directo de módulos por el exhibidor | Uso y asignación de módulos a exhibidores de un país |
| Cesión a terceros | Prohibida sin autorización del IIMP | Autorizada a favor de los EXHIBIDORES del pabellón |
| Relación IIMP–exhibidores | Directa con el exhibidor | El IIMP no contrata con los exhibidores; el operador responde |
| Anexo 1 | Tabla detallada por módulo, con frente y fondo | Tabla resumen por pabellón, sin frente/fondo |
| Anexo 2 | 4 modalidades de pago y cronograma dinámico | Cuotas dinámicas de 1 a 9, moneda y cuentas USD/PEN dinámicas *(antes: 3 cuotas fijas 33/33/34, superado)* |
| Descuento | No aparece descuento de operador en el Anexo 2 | Incluye “descuentos aplicables por ser operadores” |
| Devolución / desistimiento | Desistimiento con penalidades 10/50/80/100% | No hay desistimiento libre; devolución limitada de módulos 20% + 15% |
| Declaraciones | Un Anexo 3 del exhibidor | Anexo 3 del operador. El Anexo 3-A del exhibidor **fue eliminado** de la plantilla y no se reintroduce |
| Firmas | Loop de firmas, representantes adicionales y fecha | Tabla fija de 2 columnas; sin loop de representantes adicionales |
| Idioma | ES y EN | Solo ES |

---

## 2. Estructura del cuerpo principal

### 2.1 Plantilla estándar

| Orden | Cláusula | Contenido |
|---|---|---|
| 1 | **PRIMERA: ANTECEDENTES** | Identifica al IIMP y al EXHIBIDOR; el exhibidor declara su objeto social y actividad. |
| 2 | **SEGUNDA: OBJETO** | El IIMP cede en uso temporal uno o varios módulos al EXHIBIDOR para su participación directa en EXTEMIN. |
| 3 | **TERCERA: DOCUMENTOS INTEGRANTES** | Contrato, Condiciones Generales, Anexos 1 a 4. |
| 4 | **CUARTA: ACEPTACIÓN DE LAS CONDICIONES GENERALES** | Aceptación integral y sin reservas por EL EXHIBIDOR. |
| 5 | **QUINTA: COMUNICACIONES Y NOTIFICACIONES** | Correos del IIMP y del EXHIBIDOR; validez de comunicaciones. |
| 6 | Firma | Bloque `Lima, {firmante_fecha}` + loop `firmas_tabla`. |
| 7 | Condiciones Generales | 20 cláusulas generales. |
| 8 | Anexos 1 a 4 | Módulos, economía, declaración del exhibidor y reglamento. |

### 2.2 Plantilla Pabellones Internacionales

| Orden | Cláusula | Contenido |
|---|---|---|
| 1 | **PRIMERA: ANTECEDENTES** | Identifica al IIMP y al OPERADOR; el operador representa a un país (`{pais_operador}`). |
| 2 | **SEGUNDA: OBJETO** | El IIMP cede módulos al OPERADOR para conformar un pabellón internacional y asignarlos a empresas de su país. |
| 3 | **TERCERA: DOCUMENTOS INTEGRANTES** | Contrato, Condiciones Generales, Anexos 1 a 4; incluye reglas de transmisión de obligaciones y prevalencia. |
| 4 | **CUARTA: ALCANCE DE LAS OBLIGACIONES DEL OPERADOR INTERNACIONAL** | Obligaciones específicas 4.1 a 4.14. |
| 5 | **QUINTA: CONTRAPRESTACIÓN Y FORMA DE PAGO** | Obligación de pago, Anexo 2, gastos bancarios y consecuencias de mora. |
| 6 | **SEXTA: VIGENCIA** | Vigencia hasta devolución, retiro y pago de obligaciones pendientes. |
| 7 | Firma | Tabla fija de dos columnas: IIMP / EL OPERADOR. |
| 8 | Condiciones Generales | 20 cláusulas generales adaptadas al operador. |
| 9 | Anexos 1, 2, 3, 3-A y 4 | Incluye una declaración adicional para el exhibidor. |

### 2.3 Cláusulas que existen solo en una plantilla

**Solo en la estándar:**

- `CUARTA: ACEPTACIÓN DE LAS CONDICIONES GENERALES`, como cláusula autónoma del cuerpo.
- `QUINTA: COMUNICACIONES Y NOTIFICACIONES`, con correos `extemin@iimp.org.pe` y el correo del exhibidor.
- Fecha de firma `Lima, {firmante_fecha}`.
- Anexo 3 único, con firma automática del exhibidor.
- Loop de firmas para representantes adicionales.

**Solo en Pabellones Internacionales:**

- Toda la cláusula `CUARTA` (4.1 a 4.14) sobre asignación de módulos a exhibidores, debida diligencia, devoluciones y responsabilidad del operador.
- `QUINTA: CONTRAPRESTACIÓN Y FORMA DE PAGO` (5.1 a 5.4).
- `SEXTA: VIGENCIA`.
- Reglas de prevalencia y transmisión de referencias al EXHIBIDOR (3.3 a 3.5).
- Anexo 3 del operador.
- Anexo 3-A del exhibidor.
- Campos `pais_operador`, `area_total`, `cantidad_modulos`, `pabellones_modulos`, `tipos_modulos` y `metraje_total`.

---

## 3. Diferencias de contenido en el cuerpo principal

### 3.1 Partes y legitimación

**Estándar:**

> “...de la otra parte, `{razon_social}`, con RUC/RUT/TaxID ... debidamente representada por `{representantes_clausula}`, a la que en adelante se le denominará simplemente como **EL EXHIBIDOR**.”

La plantilla estándar usa una cláusula combinada de representantes (`representantes_clausula`) que puede incluir al representante principal y a representantes adicionales.

**Pabellones Internacionales:**

> “...de la otra parte, `{razon_social}`, con RUC/RUT/TaxID ... debidamente representada por `{representante_legal}`, identificada con DNI N° `{dni_representante}`, con poderes inscritos en la Partida Electrónica N° `{partida_electronica}` ... a la que en adelante se le denominará simplemente como **EL OPERADOR**.”

Pabellones Internacionales separa los campos del representante y no usa `representantes_clausula`. Tampoco tiene un loop de representantes adicionales en la firma.

### 3.2 Objeto

**Estándar:** el IIMP cede el uso temporal del o de los módulos al EXHIBIDOR para **su participación directa** en EXTEMIN.

**Pabellones Internacionales:** el IIMP cede módulos al OPERADOR para **conformar un pabellón internacional** y lo autoriza a asignarlos temporalmente a empresas de su país. El área total se muestra con `{area_total}` y el país con `{pais_operador}`.

Consecuencia: en Pabellones Internacionales el operador no es solo un usuario del espacio; es un intermediario autorizado que organiza un pabellón.

### 3.3 Obligaciones exclusivas del operador (4.1 a 4.14)

Estas obligaciones no tienen equivalente en la plantilla estándar:

| Numeral | Obligación / efecto |
|---|---|
| 4.1 | Autorización expresa para ceder temporalmente módulos a los EXHIBIDORES. El operador contrata directamente con ellos; el IIMP no asume vínculo contractual. |
| 4.2 | Informar a los exhibidores sobre las Condiciones Generales, el Reglamento y las disposiciones operativas antes de su incorporación. |
| 4.3 | Comunicar al IIMP la identidad de los exhibidores y las características de sus exhibiciones; la participación queda sujeta a conformidad del IIMP. |
| 4.4 | Exigir homologación o habilitación a constructores, montajistas y proveedores cuando corresponda. |
| 4.5 | Responder frente al IIMP por actos y omisiones de los exhibidores; mantener indemne al IIMP. |
| 4.6 | Presentar la relación definitiva de exhibidores hasta el **16 de julio de 2027**, con documentación para registro y debida diligencia. |
| 4.7 | Devolución de hasta **20%** de módulos hasta el **31 de enero de 2027** y hasta **15% adicional** hasta el **28 de febrero de 2027**, formalizada por adenda; sin penalidad dentro de esos límites. |
| 4.8 | Solicitar módulos adicionales solo cuando haya asignado la totalidad de los contratados. |
| 4.9 | Obtener y remitir las constancias de aceptación de los exhibidores hasta el **16 de julio de 2027**; el IIMP puede impedir su participación si no se cumple. |
| 4.10 | Usar uno o más módulos para presencia institucional propia, con las mismas reglas de los exhibidores. |
| 4.11 | Asegurar el cumplimiento técnico y operativo de los exhibidores: diseños, planos, permisos, seguros, actas y retiro. |
| 4.12 | Asegurar el cumplimiento de propiedad intelectual, marca, datos personales, seguridad, ESG, integridad, PLAFT y anticorrupción. |
| 4.13 | Realizar debida diligencia de los exhibidores antes de asignarles módulos y reportar alertas al IIMP. |
| 4.14 | Si no ocupa módulos, pierde solo esos módulos, pero sigue obligado a pagar su contraprestación y no genera derecho a devolución. |

### 3.4 Contraprestación y pago

**Estándar:** el cuerpo principal no contiene una cláusula económica autónoma; las modalidades y el cronograma están en el Anexo 2.

**Pabellones Internacionales:** incorpora la cláusula `QUINTA`:

- 5.1: pagar el importe del Anexo 2.
- 5.2: el Anexo 2 contiene número y valor de módulos, condición comercial del operador, tributos y cronograma.
- 5.3: gastos, comisiones bancarias, retenciones y cargos por transferencias nacionales o internacionales son asumidos por el OPERADOR; el IIMP debe recibir el importe neto.
- 5.4: la mora faculta al IIMP a suspender entrega, montaje o uso de módulos.

### 3.5 Vigencia

**Pabellones Internacionales** agrega `SEXTA: VIGENCIA`: el contrato rige desde la suscripción hasta la devolución de módulos, el retiro total de instalaciones y bienes y el cumplimiento de obligaciones económicas pendientes.

**Estándar** no tiene esa cláusula en el cuerpo; el plazo está en la cláusula `SÉPTIMA: PLAZO` de las Condiciones Generales.

### 3.6 Comunicaciones

La estándar tiene una cláusula `QUINTA` específica con correos. Pabellones Internacionales no la replica en el cuerpo; las comunicaciones quedan en las Condiciones Generales y en las instrucciones de pago del Anexo 2 (`cobranzas@iimp.org.pe`).

### 3.7 Firma y fecha

**Quién firma en el flujo:** en pabellones internacionales el cliente firma digitalmente **o** el Asociado sube el PDF firmado indicando si lo firmaron el cliente, Gerencia o ambos. Con ambas firmas el contrato no se envía al SGC (ver [18](18-reserva-administrativa-empresas-extranjeras.md), sección 4.1).

**Representante:** el contrato toma primero el representante legal de la empresa, luego el representante explícito del contrato y, solo como respaldo, el contacto de facturación.

**Estándar:** bloque `Lima, {firmante_fecha}` y loop `{#firmas_tabla}` con imagen, línea, cargo y nombre para IIMP y hasta dos firmas de exhibidor por fila. Permite representantes adicionales.

**Pabellones Internacionales:** tabla fija de dos columnas:

- Izquierda: `Gustavo Adolfo de Vinatea Bellatin`, `Gerente General`, `IIMP`.
- Derecha: `{representante_legal}`, `{firmante_empresa}`, `EL OPERADOR`.
- Imagen de firma `{%firma_exhibidor}`.
- No tiene `firmante_fecha` ni loop de representantes adicionales.

---

## 4. Condiciones Generales

Ambas plantillas incorporan una sección de Condiciones Generales de Exhibición de PERUMIN 38. La estructura de 20 cláusulas es prácticamente la misma, pero Pabellones Internacionales sustituye al EXHIBIDOR por EL OPERADOR y añade excepciones para la asignación de módulos.

### 4.1 Cláusulas con cambios relevantes

| Cláusula | Estándar | Pabellones Internacionales |
|---|---|---|
| **PRIMERA: Alcance y aplicación** | Regula la participación de EL EXHIBIDOR y remite al Contrato de Exhibición. | Regula la participación de EL OPERADOR; conserva la referencia al “Contrato de Exhibición” en el texto, lo que puede ser una redacción heredada a revisar. |
| **SEGUNDA: Definiciones** | Módulo cedido a EL EXHIBIDOR. | Módulo cedido a EL OPERADOR; el resto de la definición sigue mencionando al EXHIBIDOR para credenciales e invitados. |
| **TERCERA: Obligaciones** | 3.2.3 prohíbe ceder o transferir el espacio a terceros. | 3.2.3 mantiene la prohibición, **salvo** la cesión temporal a los EXHIBIDORES autorizada en el contrato Pabellones Internacionales y en la cláusula Sexta. |
| **SEXTA: Cesión de derechos** | Prohíbe ceder el derecho de uso y la posición contractual sin autorización del IIMP. | Cambia el título a **“Cesión de derechos y asignación de módulos”**; permite la asignación temporal a exhibidores y mantiene la responsabilidad del operador. |
| **OCTAVA: Compromisos específicos** | 8.7: la falta de ocupación se considera desistimiento tácito y remite a las consecuencias de 13.5. | 8.7: la falta de ocupación no libera del pago y remite al numeral 4.14 del contrato Pabellones Internacionales y a 13.5. |
| **DÉCIMO TERCERA: Resolución** | 13.3 y 13.4 se refieren a EL EXHIBIDOR. | Se refieren a EL OPERADOR. |
| **13.5** | **Desistimiento de EL EXHIBIDOR** con tabla de penalidades 10% / 50% / 80% / 100% y penalidad adicional de 10% por cambio de ubicación o titular. | **Prohibición de desistimiento y devolución limitada de módulos**: no hay desistimiento libre ni tabla de penalidades; solo aplica la devolución del numeral 4.7 y, fuera de ella, se paga la contraprestación completa. |
| **DÉCIMO CUARTA a VIGÉSIMA** | Fuerza mayor, postergación, tributos, datos, notificaciones, aplicación supletoria y jurisdicción. | Misma estructura, con referencias al OPERADOR. |

### 4.2 Puntos legales que conviene revisar

- Pabellones Internacionales **13.5** aparece duplicado: primero como “Desistimiento de EL OPERADOR” y luego como “Prohibición de desistimiento y devolución limitada de módulos”. Es una inconsistencia de numeración heredada.
- Pabellones Internacionales **13.1 b) ii** dice que el IIMP usará el nombre y marca de “EL EXHIBIDOR”, aunque la contraparte es EL OPERADOR. Probablemente sea una referencia heredada de la plantilla estándar.
- Pabellones Internacionales **Anexo 3** dice “En relación al Contrato de Exhibición”, no al Contrato de Participación del Operador Internacional. Es otra referencia heredada.
- Pabellones Internacionales **3.3** es una cláusula clave: ordena que toda referencia de las Condiciones Generales al EXHIBIDOR se entienda hecha al OPERADOR, salvo cuando por naturaleza corresponda a los exhibidores del pabellón. Esto no existe en la estándar.
- Pabellones Internacionales **3.4** exceptúa la prohibición de cesión para la asignación temporal a exhibidores. Esto no existe en la estándar.
- Pabellones Internacionales **3.5** establece que, en caso de contradicción, prevalecen el contrato Pabellones Internacionales y sus anexos específicos. La estándar no tiene una regla equivalente en el cuerpo.

---

## 5. Anexo 1 — Módulos y plano

### 5.1 Plantilla estándar

Tabla detallada por módulo:

`N° de módulo | Zona/Pabellón | Tipo de espacio | Metraje (m2) | Frente | Fondo`

- Usa el loop `{#modulos}` y muestra una fila por cada módulo.
- Incluye los campos `{frente}` y `{fondo}`.
- Incluye notas para indicar si el módulo es interior, exterior, esquina o línea, y para beneficios adicionales.
- Incluye el loop `{#planos}` con `{%imagen_plano}` y la leyenda de versión y fecha.
- Incluye la sección “Responsabilidad sobre el diseño y construcción del stand”.

### 5.2 Plantilla Pabellones Internacionales

Tabla resumen por pabellón:

`N° de módulo | Zona/Pabellón | Tipo de espacio | Metraje (m2)`

- No usa loop por módulo.
- Usa campos agregados: `{cantidad_modulos}`, `{pabellones_modulos}`, `{tipos_modulos}` y `{metraje_total}`.
- No muestra frente ni fondo.
- No incluye las notas de interior/exterior/esquina/línea ni la nota de beneficios adicionales de la estándar.
- Conserva el loop de planos y la sección de responsabilidad sobre el diseño, con referencias al OPERADOR.

**Diferencia práctica:** la estándar individualiza cada módulo; Pabellones Internacionales resume el bloque del pabellón y no permite ver el detalle unitario desde el Anexo 1.

---

## 6. Anexo 2 — Condiciones económicas y cronograma

### 6.1 Monto, descuento e IGV

**Estándar:**

> “El monto total de la contraprestación a cargo de EL EXHIBIDOR asciende a: `{simbolo_moneda} {monto_total}`, importe que incluye el Impuesto General a las Ventas (18% de I.G.V.)...”

Detalle:

- Valor Venta (Neto): `{simbolo_moneda} {valor_venta}`
- IGV (18%): `{simbolo_moneda} {igv}`
- Precio Venta (Total a Pagar): `{simbolo_moneda} {precio_venta}`

No menciona descuento de operador.

**Pabellones Internacionales:**

> “El monto total de la contraprestación a cargo de EL OPERADOR asciende a: `{simbolo_moneda} {monto_total}` importe que incluye **los descuentos aplicables por ser operadores** y el Impuesto General a las Ventas (18% de I.G.V.)...”

Detalle:

- Valor Venta incluido descuentos de operador (Neto): `US$ {valor_venta}`
- IGV (18%): `US$ {igv}`
- Precio Venta (Total a Pagar): `US$ {precio_venta}`

**Inconsistencia de Pabellones Internacionales:** la línea del total usa `{simbolo_moneda}`, pero las tres líneas del detalle usan `US$` fijo. Si el contrato se emite en soles, el detalle quedaría en dólares.

### 6.2 Modalidades y cuotas

> **Superado:** la plantilla Pabellones Internacionales ya no usa 3 cuotas fijas. Imprime las cuotas dinámicas de 1 a 9 del plan de la solicitud, con moneda y cuentas bancarias según USD o PEN. Lo que sigue describe el estado del 17/11.

**Estándar:**

- Modalidad 1: 100% contra factura, dentro de 30 días calendario.
- Modalidad 2: 50% / 50%.
- Modalidad 3: 40% / 30% / 30%.
- Modalidad 4: cronograma personalizado.
- Loop `{#cuotas_contrato}` para imprimir todas las cuotas con `{numero}`, `{porcentaje}`, `{monto}` y `{fecha}`.

**Pabellones Internacionales:**

- No usa modalidades 1 a 4.
- Lista tres cuotas fijas:
  - 33% antes del 31 de diciembre de 2026.
  - 33% antes del 30 de abril de 2027.
  - 34% antes del 30 de junio de 2027.
- Usa tags fijos `{cuota_1_monto}`, `{cuota_2_monto}`, `{cuota_3_monto}` y `{fecha_cuota_1}`, `{fecha_cuota_2}`, `{fecha_cuota_3}`.
- El texto todavía dice “bajo una de las siguientes modalidades”, aunque no hay modalidades alternativas: es una redacción heredada.
- El backend puede manejar hasta 9 cuotas, pero la plantilla Pabellones Internacionales solo imprime tres. Si se configura un plan distinto, la plantilla no lo refleja completo.

### 6.3 Moneda, cuentas y detracción

> **Superado:** la plantilla Pabellones Internacionales ya soporta moneda y cuentas dinámicas USD/PEN (tags de moneda, cuenta corriente, interbancaria, detracción y tipo de cuenta). El texto siguiente es histórico.

**Estándar:**

- Usa `{moneda_codigo}`, `{tipo_cuenta}`, `{cta_corriente}`, `{cta_interbancaria}` y `{cta_detraccion}`.
- Permite cuentas en USD o PEN según la moneda del contrato.
- La cuenta de detracción es dinámica.

**Pabellones Internacionales:**

- Las cuentas bancarias están **hardcodeadas** en dólares:
  - Cuenta corriente USD `191-2654294-1-59`.
  - Cuenta interbancaria USD `002-191-002654294159-51`.
  - Cuenta de detracción `000-00-372668`.
- No usa tags de cuentas ni `tipo_cuenta`.
- No tiene una versión dinámica para soles.

**Riesgo:** Pabellones Internacionales está diseñado para operadores en USD; si se emite en otra moneda, el Anexo 2 no se adapta automáticamente.

### 6.4 Instrucciones de pago y mora

Ambas plantillas comparten la estructura de:

- Datos bancarios.
- Gastos y comisiones por cuenta del cliente/operador.
- Instrucciones de facturación.
- Confirmación de pago a `cobranzas@iimp.org.pe`.
- Suspensión por mora.
- Resolución después de 15 días calendario.
- Aplicación de pagos a la reserva y supuestos de devolución.

En Pabellones Internacionales las referencias de devolución remiten al **numeral 4.7 del contrato Pabellones Internacionales**, no al desistimiento de la cláusula 13.5; en la estándar remiten a las cláusulas Décimo Tercera, Décimo Cuarta y Décimo Quinta.

---

## 7. Anexo 3, Anexo 3-A y Anexo 4

### 7.1 Anexo 3

**Estándar:**

- Título: **“DECLARACIÓN DE CUMPLIMIENTO DEL EXHIBIDOR”**.
- Nueve secciones: propiedad intelectual, registro de imágenes, responsabilidad, indemnidad, conducta, fuerza mayor, datos y marca, reglamento e integridad.
- Firma automática:
  - `Nombre y cargo: {firmante_nombre_cargo}`
  - `Empresa: {firmante_empresa}`
  - Loop `{#firmas_declaracion_filas}` con `{%firma_1}`, `{%firma_2}`, líneas, cargos y nombres.
  - `Fecha: {firmante_fecha}`.

**Pabellones Internacionales:**

- Anexo 3: **“DECLARACIÓN DE CUMPLIMIENTO DEL OPERADOR”**.
- Mismas nueve secciones, con referencias al OPERADOR.
- Los campos de firma están en blanco:
  - `Nombre y cargo: __________________________`
  - `Empresa: __________________________`
  - `Firma: __________________________`
  - `Fecha: __________________________`
- No usa tags de firma en ese bloque.

### 7.2 Anexo 3-A *(eliminado)*

> **Superado:** el Anexo 3-A fue eliminado de `plantillas/contrato-p38-operador-tags.docx` junto con las variables `anexo3a_*`. La descripción siguiente es histórica; no reintroducirlo.

**Existía solo en Pabellones Internacionales.**

- Título: **“DECLARACIÓN DE CUMPLIMIENTO DEL EXHIBIDOR”**.
- Está pensado para que el operador lo entregue a cada exhibidor del pabellón.
- Usa `{pais_operador}` en la introducción.
- Los datos del módulo, empresa y firma están en blanco (`______`).
- No usa los tags de firma automática de la estándar.

**Diferencia práctica:** la estándar tiene un solo anexo de declaración y lo firma automáticamente; Pabellones Internacionales tiene dos declaraciones y deja la del operador y la del exhibidor para llenado manual.

### 7.3 Anexo 4

Ambas plantillas incorporan el **Reglamento de Exhibidores de PERUMIN 38** como Anexo 4. La estructura y el contenido general del reglamento se mantienen; la diferencia está en el rol contractual:

- En la estándar, el reglamento se aplica al EXHIBIDOR.
- En Pabellones Internacionales, se aplica al OPERADOR y, a través de él, a los EXHIBIDORES del pabellón.

La plantilla estándar usa tags como `{codigos_stands}` en el asunto de la zona de exhibición de maquinaria; la Pabellones Internacionales no incluye ese tag.

---

## 8. Tags y campos de plantilla

### 8.1 Conteo

| Plantilla | Tags | Observación |
|---|---:|---|
| Estándar ES | 60 | Incluye loops de módulos, cuotas, firmas y declaración. |
| Estándar EN | 60 | Traducción de la estándar; mismos tags. |
| Pabellones Internacionales | 31 | Sin loops de módulos, cuotas ni firmas; usa campos fijos. |

### 8.2 Tags exclusivos de la estándar

- `{representantes_clausula}`
- `{objeto_social}`
- `{actividad}`
- `{#modulos}`, `{modulo}`, `{zona}`, `{tipo}`, `{metraje}`, `{frente}`, `{fondo}`, `{/modulos}`
- `{#cuotas_contrato}`, `{numero}`, `{porcentaje}`, `{monto}`, `{/cuotas_contrato}`
- `{sel_modalidad_1}`, `{sel_modalidad_2}`, `{sel_modalidad_3}`, `{sel_modalidad_4}`
- `{monto_modalidad_1}`
- `{moneda_codigo}`
- `{tipo_cuenta}`, `{cta_corriente}`, `{cta_interbancaria}`, `{cta_detraccion}`
- `{#firmas_tabla}`, `{%firma_iimp}`, `{%firma_1}`, `{%firma_2}`, `{linea_iimp}`, `{cargo_iimp}`, `{nombre_iimp}`, `{linea_1}`, `{linea_2}`, `{cargo_1}`, `{cargo_2}`, `{nombre_1}`, `{nombre_2}`, `{/firmas_tabla}`
- `{#firmas_declaracion_filas}`, `{/firmas_declaracion_filas}`
- `{firmante_nombre_cargo}`
- `{firmante_fecha}`
- `{codigos_stands}`

### 8.3 Tags exclusivos de Pabellones Internacionales

- `{pais_operador}`
- `{area_total}`
- `{cantidad_modulos}`
- `{pabellones_modulos}`
- `{tipos_modulos}`
- `{metraje_total}`
- `{representante_legal}`
- `{dni_representante}`
- `{partida_electronica}`
- `{cuota_1_monto}`, `{cuota_2_monto}`, `{cuota_3_monto}`
- `{fecha_cuota_1}`, `{fecha_cuota_2}`, `{fecha_cuota_3}`
- `{%firma_exhibidor}`

### 8.4 Tags compartidos pero con uso distinto

| Tag | Estándar | Pabellones Internacionales |
|---|---|---|
| `{firmante_empresa}` | Empresa en el Anexo 3. | Empresa en la tabla de firma del cuerpo. |
| `{fecha}` | Fecha de cuota y de plano. | Fecha del plano. |
| `{monto_total}`, `{valor_venta}`, `{igv}`, `{precio_venta}` | Anexo 2 estándar. | Anexo 2 Pabellones Internacionales. |
| `{simbolo_moneda}` | Moneda dinámica en todo el Anexo 2. | Moneda dinámica en el total y cuotas, pero `US$` fijo en el detalle. |
| `{#planos}`, `{%imagen_plano}`, `{pabellon}`, `{version}`, `{fecha}` | Loop de planos. | Loop de planos. |

### 8.5 Tags que la Pabellones Internacionales no tiene y podrían ser necesarios

- `{representantes_clausula}`: Pabellones Internacionales usa campos separados.
- `{firmante_nombre_cargo}`: no se usa en la firma principal ni en el Anexo 3.
- `{firmante_fecha}`: no hay fecha automática en la firma.
- `{tipo_cuenta}` y `{cta_*}`: las cuentas están fijas.
- `{codigos_stands}`: no se puede rellenar el asunto de maquinaria del Anexo 4.
- `{#cuotas_contrato}`: no se puede imprimir un cronograma distinto de tres cuotas.
- `{#modulos}`: no se puede imprimir el detalle por módulo en el Anexo 1.

### 8.6 Idiomas

- La estándar tiene versión ES y EN.
- Pabellones Internacionales solo tiene versión ES.
- El backend usa la plantilla Pabellones Internacionales ES también para contratos con idioma EN. Si el área exige un contrato Pabellones Internacionales en inglés, hace falta una traducción oficial y un archivo EN.

---

## 9. Diferencias económicas y legales más relevantes

1. **Naturaleza del contrato:** la estándar es un contrato de exhibición directo; Pabellones Internacionales es un contrato de operador internacional con autorización de asignación a terceros.
2. **Cesión:** la estándar prohíbe ceder el espacio y la posición contractual; Pabellones Internacionales permite la asignación temporal a exhibidores y responsabiliza al operador.
3. **Responsabilidad:** en Pabellones Internacionales el operador responde por los actos de los exhibidores y mantiene indemne al IIMP; en la estándar el exhibidor responde por sus propios actos y proveedores.
4. **Devoluciones:** Pabellones Internacionales permite devolver 20% + 15% en fechas determinadas, sin penalidad; la estándar no tiene ese mecanismo y aplica desistimiento con penalidades 10/50/80/100%.
5. **Pago:** Pabellones Internacionales tiene tres cuotas fijas 33/33/34; la estándar permite 1, 2, 3 o cuotas personalizadas.
6. **Descuento:** Pabellones Internacionales menciona descuentos de operador; la estándar no los menciona en el Anexo 2.
7. **Moneda y cuentas:** la estándar es dinámica (USD/PEN); Pabellones Internacionales está hardcodeada en USD.
8. **Declaraciones:** Pabellones Internacionales agrega la declaración del operador y la declaración del exhibidor; la estándar solo tiene la del exhibidor.
9. **Firmas:** la estándar soporta representantes adicionales; Pabellones Internacionales tiene una firma fija del operador y deja los anexos 3 y 3-A con campos manuales.
10. **Plazo y devolución:** Pabellones Internacionales tiene vigencia hasta devolución, retiro y pago; la estándar regula el plazo en las Condiciones Generales.

---

## 10. Observaciones de redacción / posibles incidencias

Estas observaciones no son necesariamente errores legales, pero conviene que el área usuaria y Legal las revise:

- Pabellones Internacionales **13.5** está numerado dos veces.
- Pabellones Internacionales **13.1 b) ii** menciona a EL EXHIBIDOR en una obligación del IIMP.
- Pabellones Internacionales **Anexo 3** dice “Contrato de Exhibición” en lugar de “Contrato de Participación del Operador Internacional”.
- Pabellones Internacionales **Anexo 2** dice “una de las siguientes modalidades” pero solo muestra tres cuotas fijas.
- Pabellones Internacionales **Anexo 2** usa `US$` fijo en el detalle y `{simbolo_moneda}` en el total.
- Pabellones Internacionales **Anexo 3 y 3-A** no tienen tags para nombre, empresa, firma y fecha; quedan en blanco.
- Pabellones Internacionales no tiene versión EN.
- Pabellones Internacionales no soporta más de tres cuotas en la plantilla, aunque el backend pueda generar un plan distinto.
- La estándar incluye `codigos_stands` y firmas múltiples; Pabellones Internacionales no.

---

## 11. Conclusión

La plantilla Pabellones Internacionales no debe tratarse como una simple variante de la estándar. Es un contrato distinto, con:

- otra contraparte;
- otra finalidad;
- autorización de asignación a terceros;
- obligaciones adicionales de debida diligencia y coordinación;
- un régimen económico propio;
- anexos de declaración adicionales;
- un bloque de firmas distinto.

La recomendación es mantener ambas plantillas separadas y no reutilizar la estándar para operadores internacionales. Si el área necesita que ambos contratos tengan la misma experiencia de firma y autocompletado, los cambios deben hacerse en la plantilla Pabellones Internacionales y en sus tags, sin alterar la plantilla estándar.

**Pendientes recomendados** (los puntos 2 y 3 quedaron resueltos: cuotas y moneda dinámicas, y Anexo 3-A eliminado):

1. Revisión legal de las observaciones de redacción de la sección 10.
2. Decidir si Pabellones Internacionales debe soportar cuotas distintas de 33/33/34 y moneda distinta de USD.
3. Decidir si el Anexo 3 del operador y el Anexo 3-A del exhibidor deben autocompletarse o firmarse manualmente.
4. Crear una versión Pabellones Internacionales en inglés si se requiere paridad con la estándar.
5. Validar si el Anexo 1 debe seguir siendo resumen por pabellón o si el área necesita el detalle por módulo.
