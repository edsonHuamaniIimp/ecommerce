# Debida Diligencia — Alcance definitivo y handoff UI

> **Estado:** alcance funcional y de experiencia acordado. La implementación actual de
> DD está aprobada y se reutiliza; la V2 agrega evaluación por vínculo, evidencias,
> plazos, prevalidación, administración y cierre global.
> **Fuente de verdad funcional actual:** [`11-debida-diligencia.md`](./11-debida-diligencia.md).
> **Handoff Stitch anterior:** [`10-debida-diligencia-stitch.md`](./10-debida-diligencia-stitch.md).
> **Matriz de navegación:** [`15-debida-diligencia-navegacion.md`](./15-debida-diligencia-navegacion.md).
> **Diagrama de actividades:** [`16-debida-diligencia-actividades.md`](./16-debida-diligencia-actividades.md).
> **Matriz de estructura:** `C:\Users\ASUSVivobook\Downloads\MATRIZ EVALUACIÓN DE DEBIDA DILIGENCIA actualizado_Vsist (1).xlsx`.
> **Transcripción de referencia:** reunión de transferencia del 27/10/2026.

## 1. Regla de continuidad

La versión actual de DD ya fue aprobada y se reutiliza. Este alcance **no renombra** las
rutas, los estados, los permisos ni las vistas existentes. La V2 se construye sobre ellas:

- conserva el wizard de 4 pasos, Mi debida diligencia, Mis debidas diligencias, la bandeja,
  la revisión reputacional, la revisión legal, la matriz y el panel;
- conserva los términos de negocio de la matriz: `SI / NO / N.A.`, `ACEPTADO / OBSERVADO`,
  `SIN OBSERVACIONES`, `REQUIERE DEBIDA DILIGENCIA REFORZADA`, `APTO / NO APTO`;
- agrega la unidad **empresa + vínculo**, la evidencia por campo, el plazo, la
  prevalidación de Asociados, la administración y la auditoría;
- no destruye expedientes, documentos, versiones, declaraciones, historial ni auditoría.

## 2. Actores y permisos actuales

| Actor | Permisos DD actuales | Uso |
|---|---|---|
| `admin` | `admin:full` | Acceso total, bypass de revisión y configuración |
| `cliente` | `dd:formulario` | Completa su DD, consulta estado, historial y declaración de vigencia |
| `logistica` | `dd:ver`, `dd:panel`, `dd:revision`, `dd:matriz` | Panel, bandeja, revisión SIG y matriz |
| `comunicacion` | `dd:ver`, `dd:reputacion` | Revisión reputacional |
| `legal` | `dd:ver`, `dd:legal` | Revisión legal y Compliance |
| `asociado` | Sin permiso DD en la versión actual | La V2 incorpora prevalidación de vínculo |

La V2 requiere dos permisos nuevos, aún no implementados:

- `dd:prevalidacion`: validar el vínculo declarado antes de SIG.
- `dd:admin`: reglas, plazos, plantillas, links y auditoría del módulo.

## 3. Rutas actuales que se conservan

| Ruta | Vista actual | Permiso |
|---|---|---|
| `/dashboard/debida-diligencia` | Landing por rol: panel, bandeja, legal, reputación o Mi DD | Autenticado |
| `/dashboard/mis-debidas-diligencias` | Historial de DD de la empresa | `dd:formulario` |
| `/dashboard/debida-diligencia/formulario` | Wizard de 4 pasos | `dd:formulario` |
| `/dashboard/debida-diligencia/declaracion-vigencia` | Declaración jurada de vigencia de información | `dd:formulario` |
| `/dashboard/debida-diligencia/bandeja` | Bandeja de revisión de Logística/SIG | `dd:revision` |
| `/dashboard/debida-diligencia/reputacion` | Revisión reputacional de Comunicaciones | `dd:reputacion` |
| `/dashboard/debida-diligencia/legal` | Revisión legal | `dd:legal` |
| `/dashboard/debida-diligencia/matriz` | Matriz de evaluación DD | `dd:matriz` |
| `/dashboard/debida-diligencia/matriz/[id]` | Detalle de un vínculo de la matriz | `dd:matriz` |

La integración con Solicitudes se mantiene en `/dashboard/solicitudes`: columna
**Debida diligencia**, cards **DD APTAS / DD NO APTAS**, bloqueo de revisión y bypass
exclusivo de `admin:full`. La declaración de vigencia se gestiona desde
`/dashboard/debida-diligencia/declaracion-vigencia`.

## 4. Mapa de conexiones actuales

```text
Cliente
  Mi debida diligencia
    -> Wizard 1 Consentimientos
    -> Wizard 2 Empresa
    -> Wizard 3 Representante y beneficiarios
    -> Wizard 4 Documentos
    -> Envío / correo
    -> Observaciones y corrección
    -> Declaración de vigencia (solo revalidación)
    -> Mis debidas diligencias / Historial

Solicitudes
  -> columna Debida diligencia (APTO / declaración pendiente / NO APTO)
  -> cards DD APTAS / DD NO APTAS
  -> bloqueo de revisión si no hay DD APTA
  -> bypass solo admin:full
  -> enlace al estado de la DD

SIG / Logística
  Panel de Debida Diligencia
    -> Bandeja de Debida Diligencia
    -> Revisar debida diligencia
       -> Resumen
       -> Documentos y versiones
       -> Reputación
       -> Matriz
       -> Derivar a Comunicaciones
       -> Aprobar / Solicitar correcciones / Derivar a Legal
    -> Matriz de evaluación DD
       -> Detalle de vínculo
       -> Listas, conclusiones SIG/Reputacional/Compliance y resultado final
    -> Importación masiva
    -> Historial del expediente
    -> Declaración de vigencia (revalidación)

Comunicaciones
  Revisión reputacional
    -> casos agrupados por expediente
    -> detalle lateral: nombre, nacionalidad, sitio web, derivado por, fecha
    -> Sin hallazgos / Con hallazgos / Requiere información adicional
    -> Link de sustento obligatorio si hay hallazgos
    -> Notificar a Logística

Legal / Compliance
  Revisión legal
    -> expedientes derivados por SIG
    -> motivo de derivación + informe de Logística
    -> documentos, versiones y revisión de Comunicaciones
    -> Aprobar / Observar / Rechazar
    -> Informe legal PDF obligatorio para rechazar
    -> Aprobar devuelve a SIG; Rechazar cierra

Matriz
  Lista de vínculos
    -> Detalle del vínculo
    -> Datos generales
    -> Persona o entidad vinculada
    -> País y ámbito
    -> Listas restrictivas
    -> Conclusiones SIG
    -> Conclusiones reputacional
    -> Conclusiones Compliance
    -> Resultado final
    -> Adjuntos: informe y sustento
    -> Exportación de 54 columnas
```

## 5. Términos canónicos

### 5.1 Expediente

| Código | Etiqueta UI | Significado |
|---|---|---|
| `borrador` | Borrador | Creado por el cliente, aún no enviado |
| `pendiente` | Pendiente | Registro legacy o pendiente de envío |
| `en_revision` | En revisión | Pendiente de SIG |
| `observada` | Observada | SIG solicitó correcciones |
| `en_legal` | En revisión legal | Derivado a Legal |
| `aprobada` | APTO | Aprobación final vigente |
| `rechazada` | NO APTO | Rechazo definitivo |

La V2 agrega el estado de cierre por plazo:

| Código | Etiqueta UI | Significado |
|---|---|---|
| `sin_respuesta` | SIN RESPUESTA | Venció el plazo sin respuesta; requiere nueva DD |

`SIN RESPUESTA` no reemplaza `rechazada`: es un cierre administrativo por plazo. Un
`NO APTO` de cualquier relación comercial bloquea toda la empresa.

### 5.2 Documentos

`pendiente` → `cargado` → `observado` / `aprobado` / `rechazado`.

### 5.3 Revisión reputacional

`por_revisar`, `en_analisis`, `sin_hallazgos`, `con_hallazgos`,
`requiere_informacion`, `cerrada`.

### 5.4 Resultados de matriz

- Listas y campos: `SI / NO / N.A.`
- Resultado por área: `ACEPTADO / OBSERVADO`; Compliance agrega `NO APLICA`.
- Conclusión SIG y reputacional: `SIN OBSERVACIONES /
  REQUIERE DEBIDA DILIGENCIA REFORZADA / EN REVISION`.
- Conclusión Compliance: `ACEPTADO / ACEPTADO CON OBSERVACIONES / RECHAZADO`.
- Resultado final: `APTO / APTO CON OBSERVACIONES / NO APTO /
  DOCUMENTACION OBSERVADA / EN REVISIÓN`.

## 6. Decisiones cerradas de la V2

| Tema | Decisión |
|---|---|
| Alcance de vínculos comerciales | Todos usan DD completa: exhibidor, auspiciador, proveedor, asociado adherente, media partner, alquileres y otros. |
| Unidad de evaluación | **Empresa + relación comercial**. El resultado final, la vigencia, el plazo y la decisión legal pertenecen a la relación comercial. |
| Resultado de personas | Las personas vinculadas se evalúan dentro de cada relación comercial; no tienen un resultado final independiente. |
| Vigencia | 6 meses desde la decisión final de la relación comercial. |
| Evento | La DD es institucional por empresa + relación comercial; el evento es contexto. Una DD vigente de la misma relación sirve para eventos dentro de sus 6 meses. |
| Efecto de `NO APTO` | Si cualquier relación comercial queda `NO APTO`, se bloquea toda la empresa. |
| Orden | SIG (Logística) → Comunicaciones → Legal. |
| Comunicaciones | Todas las relaciones comerciales pasan por revisión reputacional. |
| Activación de Legal | Solo SIG activa Legal cuando concluye `REQUIERE DEBIDA DILIGENCIA REFORZADA` y adjunta informe y sustento. |
| Legal aprueba | Vuelve a SIG para el resultado final de la relación comercial. |
| Legal rechaza | Cierra la relación comercial como `NO APTO`. |
| Cambio de vínculo comercial | Si la empresa tiene una DD vigente y quiere otra relación comercial, inicia una nueva evaluación para esa relación. |
| `APTO CON OBSERVACIONES` | Puede renovar con declaración si mantiene la misma relación comercial y sigue vigente. |
| Evidencias | Cada campo aplicable de la matriz exige archivo y/o link; `N.A.` exime. |
| Plazo | Configurable; al vencer cierra como `SIN RESPUESTA`; después exige nueva DD. |
| Producto | La plataforma gestiona solo DD; contratos, cuotas, pagos, membresías y facturación quedan fuera. |

## 7. Modelo V2: dos dimensiones que no se deben mezclar

La palabra “vínculo” se usa hoy para dos cosas distintas:

1. **Relación comercial:** Exhibidor, Auspiciador, Proveedor, Asociado Adherente,
   Media Partner, Alquileres, Otro.
2. **Persona vinculada:** representante legal, apoderado, director, gerente,
   beneficiario final, socio/accionista con 10% o más, empresa vinculada.

La relación comercial es la **unidad de resultado**. La persona vinculada es un **sujeto
evaluado dentro de esa relación**. Esto evita frases ambiguas como “el vínculo está
observado” cuando en realidad se observó a una persona.

La implementación actual tiene un expediente por empresa y evento
(`@@unique([empresaId, eventoId])`) y guarda las relaciones comerciales declaradas como
un arreglo (`tipoRelacionComercial`). La matriz actual tiene filas por empresa/persona en
`dd_matriz_vinculo`, pero **no almacena la relación comercial**. Por eso la V2 necesita
una capa intermedia.

### 7.1 Modelo objetivo

```text
Empresa
└── DebidaDiligencia / Expediente              ← se conserva
    ├── Documentos base                        ← se conservan
    ├── Consentimientos                        ← se conservan
    ├── Personas vinculadas                    ← tipo de persona y % condicional
    └── Relación comercial                     ← nueva entidad
        ├── Exhibidor
        │   ├── Evaluación de la empresa
        │   ├── Evaluación de personas
        │   ├── Evidencias
        │   ├── Reputación
        │   ├── Legal / Compliance
        │   └── Resultado, vigencia y plazo
        └── Auspiciador
            └── ...
```

### 7.2 Regla de decisión

- **Sí:** una empresa puede tener varias relaciones comerciales.
- **Sí:** cada relación comercial tiene su propio resultado, plazo, vigencia y legal.
- **Sí:** todas las personas de la empresa se evalúan dentro de cada relación comercial.
- **No:** una persona no tiene un resultado final separado del resultado de la relación.
- **No:** el resultado de la empresa no se edita manualmente; se calcula desde sus
  relaciones comerciales.

Ejemplo:

| Empresa | Relación comercial | Persona evaluada | Resultado de la persona | Resultado de la relación |
|---|---|---|---|---|
| Andes Technical | Exhibidor | Elena Ríos | Aceptado | APTO |
| Andes Technical | Exhibidor | Inversiones Andinas | Aceptado | APTO |
| Andes Technical | Auspiciador | Elena Ríos | Observado | NO APTO |
| Andes Technical | Auspiciador | Inversiones Andinas | Aceptado | NO APTO |

La empresa queda bloqueada por el `NO APTO` de Auspiciador, aunque Exhibidor esté APTO.

### 7.3 Reglas de migración

1. Los expedientes actuales se conservan.
2. Cada valor de `tipoRelacionComercial` se convierte en una relación comercial V2.
3. Si un expediente no tiene relaciones comerciales, se crea una relación “Empresa” por
   defecto para no perder la evaluación.
4. El resultado final actual `APTO / NO APTO` se replica a la relación comercial mientras
   no exista detalle por relación.
5. Las filas actuales de `dd_matriz_vinculo` se enlazan a la relación comercial; si hay
   varias relaciones, se duplican las filas de personas por relación.
6. El bloqueo global se calcula: `NO APTO` en cualquier relación comercial = empresa
   bloqueada.
7. La revalidación no modifica la fecha de aprobación ni la vigencia original.
8. La lectura antigua se mantiene como fallback hasta completar la auditoría de datos.

### 7.4 Personas vinculadas

Cada persona de la empresa debe declarar un `tipoVinculoPersona`:

- Representante legal.
- Apoderado.
- Director.
- Gerente.
- Beneficiario final.
- Accionista o socio con 10% a más de participación.
- Empresa vinculada, si el alcance incluye personas jurídicas.

Reglas:

- `tipoVinculoPersona` es un rol dentro de la empresa; no es la relación comercial.
- El porcentaje es obligatorio solo para **beneficiario final** y **socio/accionista**;
  en ese caso debe ser mayor o igual a 10%.
- Para representante, apoderado, director y gerente el porcentaje es opcional o “No
  aplica”.
- Una persona puede tener más de un rol; la UI pide el rol principal y evita duplicarla
  por documento, mostrando los roles adicionales en la evaluación.
- La persona no recibe un resultado final independiente: su evaluación alimenta el
  resultado de la relación comercial.
- Las personas se declaran **una sola vez a nivel empresa**. No se selecciona una
  relación comercial por persona: el sistema las replica como sujetos evaluados en cada
  relación comercial declarada en el Paso 2.
- Si en el futuro el negocio requiere personas exclusivas de una relación comercial, se
  agrega un campo opcional `aplicaA`; no forma parte del alcance actual.

La implementación actual no tiene `tipoVinculoPersona` en `DdBeneficiarioEntity` y exige
porcentaje para todas las filas; ambos puntos deben corregirse antes de implementar la V2.

## 8. Estructura de la matriz oficial

La matriz tiene **54 columnas (A–BB)** y una fila por sujeto evaluado (empresa o persona) dentro de una relación comercial. No se redefine la estructura de columnas.

| Rango | Contenido |
|---|---|
| A–P | Datos generales de la empresa/persona |
| Q–V | Listas restrictivas de empresa nacional |
| W–AE | Representante legal y otras personas o empresas vinculadas |
| AF–AP | Listas restrictivas de empresa o persona extranjera |
| AQ–AS | Conclusiones SIG |
| AT–AW | Conclusiones reputacionales |
| AX–BA | Conclusiones Compliance |
| BB | Resultado final |

Mapeo real del Excel: **AQ resultado, AR observaciones, AS conclusión**; **AT fecha,
AU resultado, AV observaciones, AW conclusión**; **AX fecha, AY resultado, AZ
observaciones, BA conclusión**. El correo de Logística tenía un desfase; la estructura
válida es la del Excel.

El Excel no tiene validaciones ni fórmulas en AQ–BB. La plataforma debe imponer los
catálogos canónicos; no debe copiar texto libre.

### 8.1 Criterios por ámbito

El ámbito se decide por fila/sujeto, no por la empresa completa. Una empresa nacional puede
tener representantes o socios extranjeros; cada fila debe mostrar solo los criterios de su
propio ámbito.

| Ámbito | Criterios que se muestran |
|---|---|
| Nacional | INDECOPI; corrupción/soborno/lavado (empresa); OEFA; PEPs/PRP (empresa); central de riesgo (empresa); bancarizado (empresa); corrupción/soborno/lavado (persona); PEPs/PRP (persona); central de riesgo (persona); conflicto de interés; bancarizado (persona) |
| Extranjera | OFAC; Naciones Unidas; OpenSanctions; OhMyFin; sanciones canadienses; sanciones europeas; sanciones United Kingdom; sanciones australianas; Banco Mundial de firmas e individuos inelegibles; INTERPOL; DEA |

Reglas de UI:

- No mostrar columnas ni filas de criterios que no aplican.
- No mostrar `N.A.` como relleno para ocultar criterios irrelevantes.
- No inventar fuentes como Contraloría, PNP, SBS/UIF, World-Check, ISO 37001,
  SST o Refinitiv.
- **No crear dos bandejas separadas por nacionalidad.** La bandeja es única; el ámbito
  (`Todos / Nacional / Extranjera`) es un filtro. La tabla muestra una fila por sujeto
  evaluado dentro de su expediente/relación; el mismo expediente puede tener una fila
  nacional y otra extranjera sin duplicar el expediente completo.
- La bandeja muestra el resumen y un panel de contexto que cambia según la fila
  seleccionada; el detalle muestra únicamente el bloque de listas del ámbito de ese
  sujeto.
- La bandeja debe usar todo el ancho disponible y no cortar la tabla; si el contenido
  excede, usar scroll vertical y panel lateral, no reducir columnas a un ancho ilegible.

## 9. Evidencias V2

- Cada campo aplicable de la matriz exige **archivo y/o link**.
- `N.A.` exime de evidencia.
- La evidencia se asocia a relación comercial, persona, área, campo, resultado, autor y fecha.
- Se permiten archivos y links externos durante la migración.
- Carga masiva por carpeta con nomenclatura:
  `01. [nombre] [concepto] [RUC/DNI]`.
- El sistema previsualiza la clasificación antes de importar.
- La vista por empresa muestra todas las relaciones comerciales y sus evidencias en un solo lugar.
- El repositorio es la vista única; no se elimina el link de Drive mientras dure la
  transición.

## 10. Revalidación, renovación y plazos

- La DD vigente de la misma relación comercial puede reutilizarse en otro evento dentro
  de los 6 meses mediante declaración jurada de vigencia.
- Si cambia la relación comercial, se genera una nueva evaluación para esa relación.
- `APTO CON OBSERVACIONES` puede renovar con declaración si mantiene la misma relación
  comercial.
- La fecha de vigencia se cuenta desde la decisión final de la relación comercial, no
  desde el envío.
- La declaración de vigencia no cambia la fecha de aprobación original.
- El plazo de respuesta es configurable; el valor por defecto sigue pendiente (2 o 3
  días hábiles).
- Al vencer sin respuesta, la relación comercial/expediente cierra como `SIN RESPUESTA`;
  el cliente debe iniciar una nueva DD.
- Se requieren recordatorios y ampliación manual del plazo.

## 11. Informe

- Se genera desde la matriz y las evidencias.
- Incluye empresa, relación comercial, personas evaluadas, resultados por área,
  observaciones, conclusiones y anexos.
- Los campos manuales de observación (Indecopi, OEFA, otros) se capturan en la
  plataforma.
- Debe existir vista previa y exportación a PDF.
- La plantilla oficial y los links de consulta los entregará Lesly; se avanza con
  placeholders.

## 12. Inventario definitivo de vistas

La app actual es la referencia de términos y estructura. Stitch conserva los nombres de
trabajo V2, pero la UI final debe usar los títulos de esta tabla.

### 12.1 Portal del Expositor

| # | Vista | Ruta actual | Elementos que se conservan |
|---|---|---|---|
| 1 | Mi debida diligencia | `/dashboard/debida-diligencia` | Estado, línea de tiempo, vigencia, observaciones, “¿Puedo reservar?”, contacto, documentos, historial, informe legal, revalidación, iniciar nueva DD |
| 1.1 | Mi debida diligencia — relaciones comerciales | `/dashboard/debida-diligencia` | Resumen por relación comercial, bloqueo global, vigencia, personas, documentos e historial |
| 2 | Mis debidas diligencias | `/dashboard/mis-debidas-diligencias` | Buscador por código, filtros evento/estado, tabla, paginación, historial |
| 2.1 | Mis debidas diligencias — bandeja de DD pasadas | `/dashboard/mis-debidas-diligencias` | Cards de vigentes/en revisión/observadas, filtros, estados de cese, detalle e historial |
| 3 | Wizard — Paso 1 Consentimientos | `/formulario` | ARCO, DD reforzada, base legal, nota de fiscalización, stepper |
| 4 | Wizard — Paso 2 Empresa | `/formulario` | Relaciones comerciales múltiples, país, razón social, RUC, actividad económica, sitio web, correo, aviso “puede reservar, no avanzar” |
| 5 | Wizard — Paso 3 Representante y personas vinculadas | `/formulario` | Representante, tipo/número de documento, nacionalidad, personas vinculadas con tipo de vínculo y porcentaje condicional, validación RENIEC/SUNAT |
| 6 | Wizard — Paso 4 Documentos | `/formulario` | Ficha RUC, poderes, identidad, declaración jurada, declaración de vigencia, adjunto, versiones, vista previa, resumen, declaración de veracidad, envío |
| 7 | Declaración jurada de vigencia de información | `/declaracion-vigencia` | Descarga de formato, PDF máximo 10 MB, vigencia original, carga |
| 8 | Historial del expediente | Modal | Movimientos por área, autor, fecha y detalle |
| 9 | Vista previa de documento | Modal | PDF/imagen y versiones |
| 9.1 | Ficha de DD histórica | `/mis-debidas-diligencias` | Consulta solo lectura: resumen, relaciones, documentos, observaciones, historial e informe legal |

### 12.2 Backoffice SIG / Logística

| # | Vista | Ruta actual | Elementos que se conservan |
|---|---|---|---|
| 10 | Panel de Debida Diligencia | `/dashboard/debida-diligencia` | KPIs, estado por vínculo, vigencia, matriz de empresas, filtros, exportación, ficha |
| 10.1 | Empresa — relaciones comerciales | `/bandeja` | Resumen de la empresa, relación comercial, resultado, vigencia, personas, reputación, legal y bloqueo global |
| 11 | Debida Diligencia — Bandeja | `/bandeja` | Cards Pendientes, En revisión, Observadas, APTO, Revalidación pendiente, Caducadas; filtros, tabla, acciones, importación, exportación, historial |
| 12 | Revisar debida diligencia | Modal | Tabs Resumen, Documentos, Reputación, Matriz; decisión Aprobar / Solicitar correcciones / Derivar a Legal; comentario; informe; derivar a Comunicaciones |
| 13 | Matriz de evaluación DD | `/matriz` | Stats, búsqueda, filtros, selección, exportación 54 columnas, tabla por vínculo |
| 14 | Detalle de vínculo | `/matriz/[id]` | Datos generales, persona/entidad, país/ámbito, listas, SIG, Reputacional, Compliance, resultado final, adjuntos |
| 15 | Importación masiva | Modal | Evento, archivo XLSX/CSV, vista previa, validaciones, resumen, importación |
| 16 | Repositorio documental | V2 | Evidencias por empresa/vínculo, filtros, carga masiva, links, autor, fecha |

#### 12.2.1 Estados del modal “Revisar debida diligencia” — Logística/SIG

El modal actual tiene cuatro estados de contenido. Se prototiparon por separado para que
Logística los encuentre directamente en Stitch, manteniendo el mismo shell, cabecera y
sidebar de decisión.

| Estado | Contenido | Screen ID |
|---|---|---|
| Resumen | Empresa, representante, beneficiarios, consentimientos y decisión | `e178bbcf764b41b68862cb01fc638b10` |
| Documentos | Obligatorios, opcionales, versiones, observaciones y revalidación | `ae4f81da439e4c55b42323a7bb23e906` |
| Reputación | Casos de Comunicaciones, resultados, fuentes y conclusión | `e835a6a880684a9d9253ca3d17edc5c8` |
| Matriz | Resumen del vínculo, áreas, resultado final y acceso a matriz completa | `58f1a5976dc941bfa3dc8f404724db41` |

### 12.3 Comunicaciones

| # | Vista | Ruta actual | Elementos que se conservan |
|---|---|---|---|
| 17 | Revisión reputacional | `/reputacion` | Casos agrupados por expediente, filtros, tabla, detalle lateral, resultado, comentario, link de sustento, notificar, cerrar |
| 18 | Detalle del caso reputacional | Panel lateral | Nombre, nacionalidad, sitio web, derivado por, fecha, resultado y sustento |

### 12.4 Legal / Compliance

| # | Vista | Ruta actual | Elementos que se conservan |
|---|---|---|---|
| 19 | Revisión legal | `/legal` | Bandeja, búsqueda, paginación, motivo de Logística, reputación, historial |
| 20 | Revisión legal de debida diligencia | Modal | Motivo, empresa/representante, documentos/versiones, reputación, informe PDF, Aprobar / Observar / Rechazar, comentario |

### 12.5 Nuevas vistas V2

| # | Vista | Objetivo |
|---|---|---|
| 21 | Prevalidación de vínculo — Asociados | Validar el vínculo declarado antes de SIG; corregir categoría y dejar comentario |
| 22 | Administración de Debida Diligencia | Reglas, plazos, plantillas, links y permisos |
| 23 | Auditoría e historial interno | Representada por el panel “Auditoría reciente” de Administración y el modal Historial |

Las 23 vistas base y las 4 variantes del modal de Logística están representadas en
Stitch. La vista previa de documento es un modal dentro del wizard y de la revisión, no
una pantalla independiente. La respuesta a observaciones con plazo se muestra como
variante de estado de Mi debida diligencia y no cambia la navegación aprobada.

## 13. Conexiones que la UI debe conservar

| Origen | Destino | Qué debe verse |
|---|---|---|
| Mi debida diligencia | Wizard / Declaración / Historial | Estado, observaciones, documentos, vigencia, revalidación |
| Wizard | Archivos | Carga, versiones, vista previa, errores de formato/tamaño |
| Solicitudes | DD | Columna, cards, bloqueo, bypass admin, enlace al estado |
| Bandeja SIG | Revisar DD | Expediente completo, documentos, reputación, matriz, decisión |
| Revisar DD | Comunicaciones | Derivación de nombres y casos |
| Revisar DD | Legal | Derivación con motivo e informe de Logística |
| Revisar DD | Matriz | Abrir/fusionar fila de vínculo |
| Matriz | Detalle de vínculo | Listas, conclusiones por área, final, adjuntos |
| Matriz | Informe | Datos y anexos para vista previa/PDF |
| Reputación | SIG | Resultado, comentario, link de sustento, notificación |
| Legal | SIG | Aprobación devuelve; rechazo cierra |
| Administración | Todo el módulo | Plazos, reglas, plantillas, links |
| Evento activo | Revalidación | Declaración de vigencia y bloqueo de Solicitudes |

## 14. Implementación en Stitch

Proyecto único de DD:

- **Proyecto:** `Debida Diligencia V2 — IIMP`
- **ID:** `14622015890478812512`
- **URL:** https://stitch.withgoogle.com/projects/14622015890478812512
- **Design system:** `assets/6071594238167036225`

Las pantallas 1–13 se generaron primero desde la reunión; las pantallas 14–23 se
agregaron para cubrir los flujos actuales y las conexiones. Después se agregaron las
cuatro variantes del modal de Logística y el repositorio de evidencias. Los títulos V2 son
etiquetas de trabajo; la UI final usa los términos de la tabla 12.

> En el proyecto existen dos duplicados de “Bandeja” y “Detalle” generados en intentos
> anteriores. Se conserva un ID principal por vista; los duplicados no son fuente de
> verdad.

| Vista | Screen ID |
|---|---|
| Mi Debida Diligencia — resumen por vínculos | `87351d8e3c5f4398adbb0e2561675e03` |
| Mi debida diligencia — relaciones comerciales | `4fc430eba5374ebaa984e98d973590cc` |
| Paso 1 — Consentimientos | `7433ec6606154079bb7fb21f95c7c9d4` |
| Paso 2 — Empresa y vínculos comerciales | `75cff82fab664d12bbb687a35a4e4c02` |
| Paso 3 — Representante y vínculos (anterior) | `876e71d62e60421b9d620e71bb2b440f` |
| Paso 3 — Representante y personas vinculadas (tipo de vínculo) | `125c95afbba2465c87c9ffe106a769b8` |
| Paso 4 — Documentos y envío | `e50b2da32e9745f19086511a6b879a5a` |
| Bandeja DD — Logística / SIG | `d67305e80dbe4b2ba243da8f99b75f5c` |
| Detalle DD — Revisión SIG | `9596d009e191475285f11dd72033e594` |
| Detalle DD — Resumen ejecutivo | `401c9a1b4f1c4a979576bf4308746fd3` |
| Detalle DD — Evidencias documentales | `af5a5829c17941efac95c400e6d5adb6` |
| Detalle DD — Evaluación Reputacional | `dd95cfc004eb41b69e350f4508fa2928` |
| Detalle DD — Dictamen Legal | `b5baebde91e94573b12e3beb4b375ac5` |
| Detalle DD — Informe Final | `395a00c387fd451a9602bf6e273cf222` |
| Bandeja de Comunicaciones — Revisión reputacional | `12f01d97737c4367b5aadf25bbfbd01a` |
| Revisión Legal | `f4cacabf827043bcb561cff12c9b6b7a` |
| Panel DD — Cumplimiento | `4c2e08c936954af980f27383c1118fdb` |
| Empresa — relaciones comerciales DD | `0ad36b972d204b90bbb0deefc3e22288` |
| Centro documental DD | `729a10c69bb04035b782e2dc5b07480b` |
| Repositorio de evidencias DD | `d4bae755247d405b9039df606eeef7f7` |
| Informe DD — Vista previa | `72d0f39275c6456d864ada9082fc987f` |
| Matriz de evaluación DD — Bandeja única (usar esta; demo con fila nacional seleccionada) | `89fa90759181426584dd13604b5333fe` |
| Matriz de evaluación DD — Bandeja dinámica (prototipo anterior, no usar) | `fb4d24a7859a423b839cf58c4d226f20` |
| Matriz de evaluación DD — vista extendida (anterior) | `22e707014a1f40be8b8860f88fad03a5` |
| Matriz de evaluación DD — versión antigua con criterios mezclados | `a178ab1ba55b4c9598445094475d5a29` |
| Mis debidas diligencias | `fad0c08c68b247779fff62bdc419719d` |
| Mis debidas diligencias — bandeja de DD pasadas | `b9ad7269132947279a5993b596bd5317` |
| Ficha de DD histórica | `044d326a7838401c985332e090936022` |
| Declaración de vigencia | `5e564b30479b4073b3145249236bb772` |
| Revisar debida diligencia (prototipo inicial) | `3e1113c4c6514ff78e381e5fdb3fd66b` |
| Logística — Revisar DD · Resumen | `e178bbcf764b41b68862cb01fc638b10` |
| Logística — Revisar DD · Documentos | `ae4f81da439e4c55b42323a7bb23e906` |
| Logística — Revisar DD · Reputación | `e835a6a880684a9d9253ca3d17edc5c8` |
| Logística — Revisar DD · Matriz | `58f1a5976dc941bfa3dc8f404724db41` |
| Matriz — Detalle de vínculo EXTRANJERO (criterios filtrados) | `5f77f02a95134c3ca83cf7c84d908567` |
| Matriz — Detalle de vínculo (versión anterior con criterios mezclados) | `eaa1ea8970e04782a6d1a7b5d0afc4b0` |
| Solicitudes — integración DD | `0cdc943bd17345778bf6d586526e4552` |
| Revisión legal (modal) | `ad0cf6c82f9e429686aa1895818588a9` |
| Importación masiva | `68d5f19fd96a46f39917a0649ab5e87f` |
| Administración DD | `b8b920ecf3734317b82a59a4b0fd9a4c` |
| Prevalidación de vínculo — Asociados | `eb0533c4fc2341828ba97ce12263c4d7` |
| Historial del expediente | `75e6a33a6ad24cdfb7da8d28ac53416d` |

## 15. Pendientes de insumos

- Plantilla oficial del informe y ejemplos.
- Links de consulta de plataformas nacionales e internacionales.
- Confirmación de API o solo links para Sentinel y demás fuentes.
- Excel oficial de resultados y frecuencia de actualización.
- Valor inicial del plazo.
- Matriz de evidencia obligatoria por campo/vínculo.
- Validación de mockups por Lesly.
- Definición del permiso y la pantalla de prevalidación de Asociados.
- Definición del alcance exacto de la auditoría administrativa.

## 16. Compatibilidad y no alcance

La V2 no debe destruir ni reinterpretar las DD existentes. La migración preserva
expedientes, documentos, versiones, estados, fechas, declaraciones de vigencia,
historial, auditoría y relaciones con empresas y eventos.

La matriz de 54 columnas se conserva como formato oficial de exportación y como
referencia para las categorías que aún no migren a la plataforma. La V2 no incluye
contratos, pagos, cuotas, membresías ni facturación.

## 17. Estado real para retomar

### Implementado en código

- Rama `qa`, HEAD `e48fb0a`; el commit `ef09e4a` quedó integrado y subido a
  `origin/qa`.
- `ef09e4a` agregó al registro externo de DD:
  - `fechaAprobacion`;
  - `declaracionVigenciaEstado` con `no_corresponde`, `no_envio`, `pendiente`,
    `cargado`, `observado` y `aprobado`;
  - lectura de la declaración en la importación de Excel;
  - bloqueo de `aptoParaContratar` cuando falta o está observada;
  - badges de declaración en Solicitudes.
- El flujo actual de DD sigue intacto: wizard, documentos, bandeja, reputación,
  legal, matriz, revalidación y auditoría.
- El mismo commit incluye cambios de contrato multi-representante, no de DD.

### Implementado en Stitch y documentación

- Proyecto Stitch: `14622015890478812512`.
- Vistas del cliente: Mi DD por relaciones, Mis DD, bandeja de DD pasadas y ficha
  histórica.
- Paso 3 con `Tipo de vínculo` y porcentaje condicional.
- Modal de Logística en cuatro estados: Resumen, Documentos, Reputación y Matriz.
- Empresa con múltiples relaciones comerciales, prevalidación de Asociados,
  administración, historial, repositorio e importación.
- Este documento es la fuente de alcance; `11-debida-diligencia.md` sigue siendo la
  fuente de la implementación actual.

### Todavía no implementado en código

- Entidad `RelacionComercial` y resultado por relación comercial.
- `tipoVinculoPersona` en personas vinculadas.
- Porcentaje condicional para roles que no son beneficiario/socio.
- `relacionComercialId` en matriz, reputación y legal.
- Evidencias por campo.
- Plazo, recordatorios y estado `SIN RESPUESTA`.
- Prevalidación de Asociados.
- Administración de reglas, plantillas y links.
- Bloqueo global por `NO APTO` en Solicitudes.
- Informe generado por relación comercial.

### Decisiones que aún deben cerrarse antes de codificar

1. ¿La relación comercial es una entidad hija del expediente por evento o una
   entidad maestra reutilizable entre eventos? La recomendación es entidad maestra
   con expediente de evento asociado.
2. ¿Una persona puede tener varios roles o solo un rol principal? La UI actual
   plantea un rol principal y roles adicionales.
3. ¿La matriz se enlaza a la relación comercial o se reconstruye como detalle de
   evaluación?
4. ¿La declaración de vigencia se guarda por relación comercial o por expediente?
5. ¿Qué permiso y área controlan la prevalidación de Asociados?
6. ¿Cuál es el plazo inicial y qué evento dispara el recordatorio?
7. ¿Qué campos exactos de la matriz exigen evidencia obligatoria?
