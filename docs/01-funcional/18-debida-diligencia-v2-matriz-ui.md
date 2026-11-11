# Debida Diligencia V2 — Decisión de UI de la matriz

> **Estado:** decisión cerrada.
> **Fecha:** 2026-11-07.
> **Alcance:** vista principal de la matriz de Debida Diligencia V2.
> **Fuentes:** [`11-debida-diligencia.md`](./11-debida-diligencia.md),
> [`14-debida-diligencia-v2-alcance.md`](./14-debida-diligencia-v2-alcance.md),
> [`15-debida-diligencia-navegacion.md`](./15-debida-diligencia-navegacion.md),
> transcripción de la reunión de transferencia del 27/10/2026 y matriz oficial
> `MATRIZ EVALUACIÓN DE DEBIDA DILIGENCIA actualizado_Vsist (1).xlsx`.

## 1. Decisión

La **vista principal de la matriz** debe parecerse a la matriz oficial en Excel:
una hoja editable, densa y horizontal, con las **54 columnas A–BB** en el mismo
orden, no una tabla resumida de tarjetas.

La vista de matriz del proyecto Stitch refinado es la **referencia visual y de
interacción de este objetivo**. No se reemplaza por una tabla compacta ni por un
conjunto de tarjetas. Cualquier ajuste de diseño debe acercarla a la matriz Excel.

La tabla compacta puede existir como bandeja o resumen operativo, pero **no es la
matriz principal**.

## 2. Proyecto Stitch de referencia

- **Proyecto refinado:** `13385005972649419830`
  (`DD V2 — Matriz de Debida Diligencia (Rediseño)`).
- **Design system:** `assets/7918146955823625563`.
- **Pantalla base de matriz:** `d5697867c569404d92a1d5fbd73dba80`.
- **Detalle de empresa:** `272d44ffb0e940b5acf4a2f1681b1cab`.
- **Evaluación de sujeto:** `d9397599a2a04307a853d57ef7fa7f1e`.
- **Comunicaciones:** `1118da3c7cb743b88d1545c5f79b18d7`.
- **Legal:** `f072cd3ec12247139669b8c6d04cc2c0`.
- **Repositorio documental:** `251e717607e34830a2b5a3eee4aa9dae`.
- **Vigencias:** `21d447d966494e3caf4d0d06bb548705`.

Existen cuatro variantes de matriz en el proyecto. La base de trabajo es
`d5697867c569404d92a1d5fbd73dba80`; las demás variantes no son fuente de verdad.

El proyecto anterior `14622015890478812512` se conserva como inventario funcional
de las 23 vistas de DD, pero la UI objetivo es el proyecto refinado.

## 3. Estructura obligatoria de la pantalla

### 3.1 Columnas oficiales

Se conservan las 54 columnas A–BB:

| Rango | Contenido |
|---|---|
| A–P | Datos generales |
| Q–V | Listas restrictivas de empresa nacional |
| W–AE | Representantes y personas/empresas vinculadas |
| AF–AP | Listas restrictivas de empresa o persona extranjera |
| AQ–AS | Conclusiones SIG |
| AT–AW | Conclusiones reputacionales |
| AX–BA | Conclusiones Compliance |
| BB | Resultado final |

No se cambia el orden, el nombre ni el significado de las columnas.

### 3.2 Contexto de fila

Fuera de las 54 columnas oficiales se muestran columnas fijas de contexto:

- empresa;
- relación comercial;
- sujeto evaluado;
- documento;
- cargo o rol;
- ámbito nacional/extranjero;
- país.

Estas columnas sirven para navegar y filtrar. No forman parte del Excel oficial.

### 3.3 Comportamiento tipo Excel

- Encabezado de grupos con color, igual que la matriz oficial.
- Encabezado fijo al hacer scroll vertical.
- Contexto de fila fijo al hacer scroll horizontal.
- Scroll horizontal para las 54 columnas.
- Zoom y densidad configurables.
- Filtros por evento, relación, ámbito, país, estado y resultado.
- Búsqueda por empresa, RUC, persona o documento.
- Selección de filas.
- Celdas `SI / NO / N.A.` validadas por catálogo.
- Evidencia visible por celda o por grupo de criterios.
- Panel lateral de evidencia y conclusión al seleccionar una fila o celda.
- Exportación idéntica a la matriz oficial de 54 columnas.

La matriz debe seguir siendo reconocible como Excel aunque use controles web.

## 4. Qué se reutiliza

### 4.1 De la matriz actual del código

- Constantes `DD_MATRIZ_*`: criterios, resultados, conclusiones, ámbitos, países y etiquetas.
- Exportación de 54 columnas (`dd-matriz-excel`).
- Estructura de la lista: búsqueda, filtros, stats, paginación, selección y exportación.
- Estructura del detalle: datos generales, identidad, país/ámbito, listas, SIG,
  Reputacional, Compliance, resultado final y adjuntos.
- Sincronización automática de empresa, representante, socios y personas vinculadas.
- Reglas de evaluación por área y permisos.
- `DdEvidencia` para evidencia por campo.
- `DdMatrizAdjunto` para informes y sustentos por área.
- Auditoría e historial.

### 4.2 Del proyecto Stitch refinado

- Shell y navegación institucional.
- KPIs.
- Barra de búsqueda y filtros.
- Tabla con scroll y densidad.
- Selección y acciones masivas.
- Panel lateral de detalle.
- Evaluación de sujeto.
- Repositorio documental.
- Vigencias.
- Cola de Comunicaciones.
- Revisión Legal.

## 5. Qué no se reutiliza

- La tabla compacta de 12–13 columnas como matriz principal.
- Un resumen que oculte las 54 columnas.
- La agrupación por empresa sin relación comercial.
- Llamar “vínculo” a una persona: debe decir “sujeto evaluado” o “persona vinculada”.
- Puntajes de riesgo, `ISO 37001`, `SBS`, `OSCE`, `World-Check` o fuentes no aprobadas.
- La vigencia trienal: la vigencia V2 es de 6 meses desde la decisión final.
- Un único resultado final por empresa sin separar relación comercial.
- La regla actual de que la matriz “solo registra” y no alimenta el estado.
- El constraint actual que impide replicar una persona por relación.
- Un resultado final manual por fila sin relación comercial.

## 6. Reglas de negocio que la matriz debe respetar

1. **Todo parte de la matriz.** La matriz es la fuente del proceso y la salida
   que debe poder exportarse.
2. **Una fila por sujeto evaluado y relación comercial.**
3. **Empresa y personas se evalúan en la misma matriz**, pero la empresa aporta
   el contexto y las personas se replican como sujetos.
4. **Solo se evalúan personas activas.** Se excluyen directores o representantes
   inactivos.
5. **Todos los representantes, apoderados, directores y gerentes se evalúan.**
   Los socios o accionistas solo si tienen 10% o más.
6. **Una persona con varios roles se evalúa una vez.**
7. **Las empresas vinculadas se evalúan hasta segundo nivel.**
8. **Los criterios dependen del ámbito del sujeto**, no del país de la empresa.
9. **`N.A.` solo aplica cuando el criterio no corresponde.** No es “sin información”.
10. **Cada campo aplicable exige evidencia** (archivo y/o link).
11. **Resultado de área, observación y conclusión son campos distintos.**
    `OBSERVADO` no equivale a `NO APTO`.
12. **Comunicaciones registra observaciones y fuentes; SIG decide la conclusión.**
13. **Legal decide su conclusión; su rechazo produce `NO APTO`.**
14. **La vigencia corre 6 meses desde la decisión final de la relación.**
15. **Misma relación y dentro de vigencia:** renovación con declaración jurada.
16. **Relación comercial distinta:** nueva DD.
17. **Cualquier relación `NO APTO` bloquea toda la empresa.**
18. **La exportación debe conservar las 54 columnas y la estructura AQ–BB.**

## 7. Criterios de aceptación

La pantalla no se considera terminada hasta cumplir:

- [ ] Se ven las 54 columnas A–BB en el orden oficial.
- [ ] El encabezado y las columnas de contexto quedan fijos.
- [ ] Hay scroll horizontal y vertical usable.
- [ ] Se distingue empresa, relación comercial y sujeto evaluado.
- [ ] Los filtros conservan el contexto al abrir un detalle.
- [ ] Las celdas usan `SI / NO / N.A.` y catálogos, no texto libre.
- [ ] Cada celda o grupo de criterios permite evidencia.
- [ ] Se distinguen resultado, observación y conclusión.
- [ ] El resultado final es por relación comercial.
- [ ] El bloqueo global se calcula desde las relaciones.
- [ ] La vigencia es de 6 meses desde la decisión final.
- [ ] La exportación es equivalente a la matriz oficial.
- [ ] No aparecen fuentes, puntajes ni vigencias fuera del alcance aprobado.
- [ ] La vista conserva el aspecto de hoja Excel y no se convierte en tarjetas.

## 8. Consecuencia

No se generan nuevas variantes de matriz sin revisar esta decisión. Cualquier
propuesta de UI para la matriz debe:

1. partir de la pantalla `d5697867c569404d92a1d5fbd73dba80`;
2. conservar la estructura Excel A–BB;
3. agregar la dimensión de relación comercial;
4. usar las reglas de los documentos 11, 14 y 15;
5. respetar los criterios de aceptación de este documento.

## 9. Implementación inicial en código

La primera vertical de la vista quedó implementada sin cambiar la ruta ni los
endpoints existentes:

- `src/components/debida-diligencia/dd-matriz-bandeja.tsx` — bandeja operativa
  alineada a la vista **Matriz DD** del Stitch refinado: KPIs, búsqueda, filtros,
  agrupación por empresa, sujetos evaluados por área y acciones.
- `src/components/debida-diligencia/dd-matriz-excel.tsx` — hoja horizontal con
  las 54 columnas oficiales A–BB, columnas fijas de contexto y paginación visual.
- `src/app/(dashboard)/dashboard/debida-diligencia/matriz/page.tsx` — tres vistas:
  **Bandeja** (por defecto), **Matriz de evaluación DD** (54 columnas) y
  **Vista extendida** (resultado y conclusión por área).
- La definición de columnas, grupos y exportación sale de la misma fuente:
  `COLUMNAS_MATRIZ_EXCEL`, `GRUPOS_MATRIZ_EXCEL` y `COLUMNAS_MATRIZ_CSV`.
- La vista Excel usa los datos completos de la matriz existente mediante el
  endpoint de exportación, por lo que conserva los 54 campos y la estructura de
  la matriz oficial.
- La columna de contexto muestra empresa, relación/motivo, sujeto evaluado,
  documento/rol y ámbito; el sujeto enlaza al detalle de evaluación.
- La vista permite buscar, filtrar por tipo, ámbito, país y resultado final,
  recargar y exportar a Excel o CSV.
- El resumen incorpora el conteo de **empresas** además de los vínculos.
- La selección de registros habilita las acciones de la bandeja: **Marcar APTO**,
  **Enviar a Comunicaciones** y **Derivar a Legal** (con motivo e informe de Logística).
- La paginación de la bandeja cuenta **procesos DD/empresas**, no filas de vínculo:
  cada página muestra 10 empresas con todos sus sujetos evaluados.
- El botón **Revisar expediente** de la empresa en la bandeja abre el mismo modal
  de revisión de `/bandeja`: resumen, documentos, reputación y matriz. Los documentos
  base (ficha RUC, poderes, identidad, declaración jurada, declaración de vigencia
  y adicional) se comparten entre todas las relaciones comerciales.
- Las **evidencias de matriz** se mantienen por relación, sujeto y criterio; no se
  mezclan con los documentos base.

Términos alineados en esta implementación:

- `APTO`
- `APTO CON OBSERVACIONES`
- `DOCUMENTACIÓN OBSERVADA`
- `EN REVISIÓN`
- `NO APTO`
- `SIN RESPUESTA`

Pendiente para la siguiente vertical:

- enlazar la fila con `DdRelacionComercial` y no solo con el motivo del expediente;
- edición en línea de celdas y evidencia por campo;
- resultado final y bloqueo calculados por relación comercial;
- filtros por relación y país;
- validación de los 54 campos contra el Excel oficial con datos reales.
