# Importación y enriquecimiento de Debida Diligencia

Este documento describe la estrategia de carga de Debida Diligencia (DD) usada en
local y QA, y el procedimiento previsto para producción. El nombre del archivo se
conserva por compatibilidad con enlaces existentes.

## 1. Objetivo y alcance

Dejar la data histórica de DD alineada con el flujo del sistema:

- una empresa puede tener varias DD;
- cada DD pertenece a un evento/version concreta;
- el estado, las fechas y el evento provienen de la fuente oficial de resultados;
- la matriz oficial enriquece representante, vínculos, actividad y beneficiarios;
- la importación es idempotente y no elimina registros existentes;
- los documentos no se importan desde la matriz;
- las DD regulares iniciadas por el sistema nunca se modifican.

La importación histórica no convierte a una DD en un expediente documental
completo. Se usa para vigencia, estado, evento, representante, beneficiarios y
datos de la empresa. La revisión documental sigue siendo un proceso posterior.

## 2. Fuentes de información

### 2.1 Fuente oficial de estado

`RESULTADO_DEBIDA_DILIGENCIA_FINAL_MOSTRAR_IMPORT_PROD.csv`

Es la fuente de verdad para estado, fechas y evento. Columnas usadas:

- `FECHA DE INGRESO SOLICITUD`
- `FECHA DE REVISION POR SIG`
- `PERSONA JURIDICA / PERSONA NATURAL`
- `RUC / DNI / ID`
- `MOTIVO DE LA EVALUACION`
- `EVENTO O PROYECTO ASOCIADO`
- `RESULTADO DE EVALUACION DEBIDA DILIGENCIA`

`FECHA DE INGRESO SOLICITUD` se conserva como inicio de la solicitud
(`fechaEnvio`). No es `createdAt`: `createdAt` es la fecha en que el registro se
creó en la base local durante la importación y no se muestra como fecha de la
solicitud.

### 2.2 Matriz oficial de evaluación

`MATRIZ EVALUACIÓN DE DEBIDA DILIGENCIA actualizado (5) (2).xlsx`

Es la fuente de enriquecimiento. Contiene una fila por persona/empresa vinculada,
repitiendo los datos de la empresa en cada fila. En la copia usada en local:

- 1.742 filas de datos;
- 3 filas omitidas por documento o razón social inválidos;
- 575 empresas únicas por `RUC / ID` normalizado;
- 1.523 filas de personas, reducidas a 1.231 personas únicas por empresa;
- 357 empresas con al menos una persona vinculada.

La matriz **no trae porcentaje de participación** y **no trae documentos**. Los
porcentajes de beneficiarios se importan como `0` cuando no existen, por decisión
funcional para conservar el nombre, documento y nacionalidad disponibles.

### 2.3 Formulario de respuestas

`Proceso de Debida Diligencia Instituto de Ingenieros de Minas del Perú (respuestas).xlsx`
o su exportación CSV `Proceso de Debida Diligencia ... - Respuestas de formulario 1.csv`.

Contiene 406 respuestas con vínculo, razón social, RUC, país, actividad,
representante y beneficiarios finales con porcentaje. No contiene resultado DD ni
evento. No se usa para estado ni evento. Puede usarse en una fase posterior para
recuperar porcentajes reales o datos faltantes, previa conciliación por RUC.

## 3. Semántica de fechas y vigencia

- `FECHA DE INGRESO SOLICITUD` del CSV -> `fechaEnvio`.
- `FECHA DE REVISION POR SIG` del CSV -> `fechaRevision`.
- Para DD `APTO` o `APTO CON OBSERVACIONES`, la revisión se usa como
  `fechaAprobacion`.
- La vigencia es `fechaAprobacion + 6 meses`.
- No se usa la fecha de ingreso para calcular la vigencia.
- `SIG` significa **Sistema Integrado de Gestión**, no necesariamente Logística.
- La matriz usa `FECHA DE INGRESO DE DOC` y `FECHA DE REVISIÓN POR SIG`; no trae
  fecha de caducidad.

## 4. Regla de asignación de evento

Se normaliza `EVENTO O PROYECTO ASOCIADO` (mayúsculas, sin tildes) y se aplica:

| Valor en la fuente | Evento destino |
|---|---|
| Contiene `PROEXPLO` | PROEXPLO 2026 |
| Contiene `WMC` o `WORLD MINING` | WORLD MINING CONGRESS 2026 |
| Contiene `GESS` | GESS 2026 |
| `PERUMIN`, `IIMP`, `EXTEMIN`, `PERUMIN - IIMP`, `PERUMIN - INSTITUTO`, `PROVEEDOR`, `ALQUILER`, `ALQUILERES`, `HOMOLOGACION`, `RECONOCIMIENTO`, `INSTITUTO`, `NO INDICA` | PERUMIN 2027 |

Solo PROEXPLO, WMC y GESS se separan. El resto de valores funcionales u operativos
se mantiene en PERUMIN para no perder casos históricos.

La misma regla se aplica a la matriz. Por eso una empresa nueva cuyo evento de
matriz sea `ALQUILER`, `PROVEEDOR`, `HOMOLOGACIÓN`, `INSTITUTO` o similar recibe
una DD en PERUMIN. No se crean eventos nuevos para valores operativos.

## 5. Mapeo de la matriz

| Columna de la matriz | Destino |
|---|---|
| `EMPRESA` | `empresa.razonSocial` |
| `RUC / ID` | `empresa.ruc`, normalizado a mayúsculas y alfanumérico |
| `NACIONALIDAD` de empresa | `empresa.pais` (ISO alpha-2) y `debida_diligencia.paisConstitucion` |
| `ACTIVIDAD ECONÓMICA` | `empresa.actividadEconomica`; en DD se trunca a 120 caracteres |
| `ESTADO DE CONTRIBUYENTE` | `empresa.estadoContribuyente` |
| `DIRECCIÓN LEGAL` | `empresa.direccionFiscal` |
| `MOTIVO DE LA EVALUACIÓN` | `debida_diligencia.motivoImportacion` y `tipoRelacionComercial` |
| `EVENTO O PROYECTO ASOCIADO` | evento de la DD y `eventoProyecto` |
| `RESULTADO FINAL` | estado de DD nueva y `estadoOrigen` |
| `FECHA DE INGRESO DE DOC` | `fechaEnvio` de DD nueva |
| `FECHA DE REVISIÓN POR SIG` | `fechaRevision`; también `fechaAprobacion` si es APTO |
| `REPRESENTANTE LEGAL / OTRAS PERSONAS o EMPRESAS VINCULADAS` | representante y beneficiarios |
| `DOCUMENTO DE IDENTIDAD` | documento del representante/beneficiario y tipo de documento |
| `NACIONALIDAD` de la persona | nacionalidad del representante/beneficiario |
| `CARGO` | criterio para elegir representante; no se persiste en beneficiarios |

### 5.1 Representante

Se elige la primera persona, en este orden:

1. cargo que contiene `REPRESENTANTE LEGAL`;
2. cargo que contiene `REPRESENTANTE`;
3. cargo que contiene `GERENTE GENERAL`;
4. primera persona válida de la empresa.

Se guarda en la empresa y en la DD:

- nombre;
- documento;
- tipo de documento (`DNI`, `Carnet de extranjería` o `Pasaporte`);
- nacionalidad.

### 5.2 Beneficiarios

Se importan todas las personas válidas de la matriz, incluido el representante,
porque la fuente no distingue con precisión entre representante, socio y
beneficiario final. Se deduplican por `nombre normalizado + documento` dentro de
cada empresa.

Reglas:

- `porcentaje = 0` cuando la matriz no informa porcentaje;
- si una DD ya tenía un beneficiario con porcentaje mayor a 0, se conserva;
- no se eliminan beneficiarios existentes;
- no se guarda `CARGO` en la tabla de beneficiarios;
- no se guardan documentos.

Consecuencia: una DD importada con beneficiarios al 0% no debe pasar por la
validación del formulario regular, que exige un porcentaje mínimo. Si la empresa
regulariza su DD, debe informar los porcentajes reales.

### 5.3 Datos que no se importan

- Documentos y URLs de archivos.
- Porcentaje real de participación.
- `CARGO` como campo propio del beneficiario.
- Columnas de la matriz sin campo equivalente en el modelo actual, como historial
  con el IIMP, beneficio mutuo o fecha de inicio de actividades.
- Datos de la columna `RESULTADO` (intermedio); se usa `RESULTADO FINAL`.

## 6. Estrategia ejecutada en local

### 6.1 Respaldo

Antes de modificar datos:

```text
C:\Users\ASUSVivobook\AppData\Local\Temp\opencode\pre-dd-matrix-enrich-20261024.dump
```

Formato `pg_dump -Fc`, base local `contratos_stands`, contenedor `ctrst-db`.

### 6.2 Resultado

| Concepto | Cantidad |
|---|---:|
| Empresas de la matriz | 575 |
| Empresas existentes actualizadas | 480 |
| Empresas nuevas | 95 |
| DD importadas existentes enriquecidas | 462 |
| DD nuevas desde la matriz | 116 |
| Beneficiarios con porcentaje 0 | 1.499 |
| Beneficiarios existentes con porcentaje > 0 conservados | 8 |
| Representantes actualizados en la fase principal | 341 |
| DD importadas después de la carga | 602 |
| DD totales después de la carga | 611 |
| Empresas totales después de la carga | 701 |

Las 116 DD nuevas incluyen 107 creadas directamente por evento de la matriz y 9
creadas con la regla de respaldo a PERUMIN para valores operativos
(`ALQUILER`, `PROVEEDOR`, `HOMOLOGACIÓN`, `INSTITUTO`). A estas 9 DD se les copió
además el representante y la actividad desde la empresa; en total 433 DD
importadas tienen representante y 169 no lo tienen.

Las DD importadas quedaron distribuidas así:

| Evento | DD importadas |
|---|---:|
| PERUMIN 2027 | 315 |
| WORLD MINING CONGRESS 2026 | 97 |
| GESS 2026 | 141 |
| PROEXPLO 2026 | 49 |
| **Total** | **602** |

No se importaron documentos desde la matriz. Cuatro expedientes importados ya
tenían documentos locales (15 archivos) y se conservaron; las DD nuevas quedaron
sin documentos.

## 7. Estrategia ejecutada en QA

QA se usó primero para conciliar la data histórica y asignar eventos. No se aplicó
todavía el enriquecimiento de la matriz.

### 7.1 Acceso y respaldo

- Entorno: EC2 QA, instancia `iimp-ctrst-qa-app`.
- App: contenedor `ctrst-qa-app`.
- Base de datos: contenedor `ctrst-qa-postgres`, base `contratos_stands`.
- Respaldo: `/opt/ctrst-qa/backups/pre-dd-events-20261023.dump` (743 KB).

### 7.2 Eventos y reasignación

Se crearon/actualizaron de forma idempotente los padres y versiones de PROEXPLO,
WMC y GESS. PERUMIN 2027 ya existía.

Se actualizó únicamente `eventoId` de las DD `origen = importado`. No se
eliminaron DD, empresas, documentos ni historial; tampoco se modificaron estados o
fechas.

| Evento | DD movidas |
|---|---:|
| PERUMIN 2027 | 301 |
| PROEXPLO 2026 | 87 |
| WORLD MINING CONGRESS 2026 | 89 |
| GESS 2026 | 90 |
| **Total** | **567** |

QA conserva más registros que DEV porque su antecedente usó
`RESULTADO_DEBIDA_DILIGENCIA_FINAL_MOSTRAR_IMPORT_DEDUP.csv` (582 filas). No se
reemplazó esa data.

Si QA necesita el mismo enriquecimiento de representante y beneficiarios que
local, debe ejecutarse la fase de matriz de la sección 8 sobre QA, con su propio
respaldo.

## 8. Procedimiento previsto para producción

Este procedimiento no se ejecutó en producción. Requiere autorización explícita,
ventana de mantenimiento y respaldo verificado.

### 8.1 Preflight

1. Confirmar que el deploy de producción incluye la migración DD y el esquema
   vigente.
2. Confirmar que existen las versiones de evento de PERUMIN, PROEXPLO, WMC y GESS.
3. Confirmar que la fuente oficial y la matriz son las versiones aprobadas.
4. Confirmar que se ejecutará sobre la base de producción correcta:
   `contratos_stands`, no QA ni local.
5. Ejecutar `pg_dump -Fc` y verificar tamaño/restauración de prueba.
6. Registrar conteos iniciales de empresas, DD, DD importadas, beneficiarios y
   documentos.
7. No ejecutar `prisma migrate reset`, `prisma db push` ni borrados masivos.

`scripts/import-dd-excel.ts` actualiza la tabla auxiliar
`debida_diligencia_empresa_estado`; no crea expedientes ni enriquece la matriz. No
debe usarse como sustituto de esta estrategia.

### 8.2 Orden de ejecución

1. Importar/asignar estado, fechas y evento desde el CSV oficial.
2. Ejecutar el enriquecimiento desde la matriz en una sola transacción.
3. En la misma transacción:
   - actualizar empresas existentes por RUC normalizado;
   - crear empresas faltantes;
   - actualizar solo DD `origen = importado` por empresa + evento;
   - crear DD faltantes para empresas/eventos de la matriz;
   - crear beneficiarios faltantes con porcentaje 0;
   - conservar beneficiarios y porcentajes existentes;
   - no tocar DD `origen = flujo_regular`.
4. Confirmar el commit de la transacción.
5. Ejecutar las consultas de control de la sección 9.

### 8.3 Idempotencia

La carga debe poder repetirse sin duplicar:

- empresa: clave `ruc` normalizado;
- DD: empresa + evento; si existe una DD importada, se actualiza; si no, se crea;
- beneficiario: nombre normalizado + documento dentro del expediente;
- vínculo: se reemplaza por el conjunto calculado desde el motivo de la matriz;
- no se eliminan beneficiarios ni documentos.

Una segunda ejecución debe reportar cero empresas nuevas, cero DD nuevas y cero
beneficiarios nuevos si la matriz no cambió.

### 8.4 Estados para DD nuevas

| `RESULTADO FINAL` | Estado local |
|---|---|
| `APTO` | `aprobada` |
| `APTO CON OBSERVACIONES` | `aprobada` |
| `NO APTO` | `rechazada` |
| `PENDIENTE` | `pendiente` |
| `EN REVISIÓN`, `EN REVISION`, `EN REVISON`, `DOCUMENTACION OBSERVADA` | `en_revision` |

Para `aprobada`, `fechaAprobacion` toma la fecha de revisión y
`fechaVencimiento = fechaAprobacion + 6 meses`. Para `rechazada`, `fechaRechazo`
toma la fecha de revisión o ingreso.

Las DD nuevas usan:

- `origen = importado`;
- `eventoProyecto` con el valor original de la matriz;
- `estadoOrigen` con el resultado original;
- `revisadoPor = IMPORTACIÓN MATRIZ DD`;
- `creadoPor = import-matriz-dd`;
- código visible `DD-AAAA-I####`.

### 8.5 Reglas de seguridad de la ejecución

- No usar la matriz para decidir el estado si el CSV oficial ya tiene el caso;
  la matriz solo enriquece.
- No sobrescribir `fechaEnvio`, `fechaRevision`, `fechaAprobacion` ni
  `fechaVencimiento` de una DD existente con datos de la matriz.
- No crear una DD nueva si ya existe una DD regular para esa empresa y evento.
- No importar documentos.
- No asignar porcentajes inventados distintos de 0.
- No ejecutar la carga completa en producción sin respaldo y autorización.

## 9. Verificación

Consultas de control:

```sql
select evento_id, estado, count(*)
from debida_diligencia
where origen = 'importado'
group by evento_id, estado
order by evento_id, estado;

select evento_proyecto, count(*)
from debida_diligencia
where origen = 'importado'
group by evento_proyecto
order by count(*) desc;

select count(*) as importadas,
       count(*) filter (where representante_nombre is not null) as con_representante
from debida_diligencia
where origen = 'importado';

select count(*) as beneficiarios,
       count(*) filter (where porcentaje = 0) as sin_porcentaje,
       count(*) filter (where porcentaje > 0) as con_porcentaje
from debida_diligencia_beneficiario b
join debida_diligencia d on d.id = b.expediente_id
where d.origen = 'importado';

select count(*) as documentos_importados
from debida_diligencia_documento doc
join debida_diligencia d on d.id = doc.expediente_id
where d.origen = 'importado';

select empresa_id, evento_id, count(*)
from debida_diligencia
where origen = 'importado'
group by empresa_id, evento_id
having count(*) > 1;
```

Comprobaciones esperadas:

- todos los `eventoId` de DD importadas existen en `evento`;
- no hay DD importadas con `eventoId` nulo;
- no hay duplicados empresa + evento en DD importadas;
- la suma por evento coincide con el total de importadas;
- las DD regulares conservan su cantidad y no cambiaron de origen;
- las DD nuevas no tienen documentos;
- los beneficiarios importados sin porcentaje quedan en 0;
- los porcentajes positivos existentes no disminuyen.

Verificación funcional en UI:

1. Abrir bandeja con “Todos los eventos”.
2. Buscar una empresa nueva de la matriz y abrir su DD.
3. Confirmar representante, actividad, vínculo y beneficiarios.
4. Abrir la matriz del evento del expediente.
5. Confirmar que la DD aparece en el evento correcto.
6. Confirmar que una DD regular no fue alterada.

## 10. Rollback

Si falla la transacción, no debe quedar carga parcial. Si la verificación funcional
falla después del commit:

1. detener nuevas escrituras;
2. restaurar el respaldo `pg_dump -Fc` en la base afectada;
3. validar conteos y health;
4. documentar el incidente y la causa.

La restauración de producción requiere autorización explícita y nunca debe
ejecutarse sobre QA o local por error.

## 11. Reglas de seguridad y pendientes

- QA se modificó con autorización explícita; producción no se tocó.
- La migración de QA se aplicó mediante el deploy de la rama `qa`.
- Cualquier restauración del respaldo requiere autorización.
- Pendiente funcional: definir si los beneficiarios con 0% se muestran como
  “porcentaje no informado” en la UI.
- Pendiente funcional: decidir si se recuperarán porcentajes reales desde el
  formulario de respuestas.
- Pendiente funcional: definir si las DD históricas sin documentos se marcarán
  como “legado pendiente de regularización”.
- Pendiente operativo: ejecutar y validar la fase de matriz en QA si se requiere
  paridad con local.
- Pendiente operativo: ejecutar la carga en producción solo después de la
  autorización y el respaldo.

## 12. Advertencia: la data de producción aún no está homologada

**La base de producción no debe tratarse como equivalente a local o QA.**

La información histórica de producción todavía no está homologada de punta a punta.
Antes de cualquier carga o regularización masiva se debe validar y aprobar:

- que cada registro tenga el evento correcto;
- que el estado y las fechas de aprobación/revisión provengan de la fuente oficial;
- que la empresa, RUC y razón social no estén duplicados;
- que representantes, vínculos y beneficiarios estén conciliados;
- que las filas de la matriz que no existen en el CSV oficial estén aprobadas por
  negocio;
- que los conflictos entre CSV y matriz tengan una decisión documentada.

Ejemplo de conflicto ya detectado en local: ARIAS TALAVERA figura como `GESS` en el
CSV y como `RECONOCIMIENTO` en la matriz. En local se conservó el CSV. En producción
se debe repetir la auditoría y resolver el caso antes de importar.

La revalidación de la declaración de vigencia no corrige esa falta de homologación:
solo controla el uso de una DD de otro evento. No se debe usar la revalidación para
“arreglar” eventos, fechas o beneficiarios mal importados.

Tampoco se deben copiar conteos de local/QA a producción. Los conteos de origen
pueden variar por ambiente.

## 13. QA: preflight y pruebas funcionales

### 13.1 Preflight

1. Desplegar en QA el commit que contenga esta lógica y la migración vigente.
2. Tomar respaldo `pg_dump -Fc` de QA antes de cualquier cambio de datos.
3. Confirmar los IDs de evento de PERUMIN, WMC, GESS y PROEXPLO en QA.
4. Confirmar que existe al menos un usuario con contexto PERUMIN y otro con contexto
   WMC/GESS para probar el cambio de evento desde `/presala?change=1`.
5. Verificar que un usuario `admin@iimp.org.pe` no se use para validar bloqueos
   normales, porque `admin:full` puede omitirlos.
6. Confirmar que la bandeja usa `session.eventoId` como evento activo, no el filtro
   visual de la tabla.
7. Confirmar que el selector de bandeja sigue siendo solo un filtro.

### 13.2 Casos mínimos de QA

| Caso | Resultado esperado |
|---|---|
| DD importada aprobada y vigente del evento activo | Sin card de revalidación, APTO y `aptoParaContratar=true` |
| DD importada aprobada y vigente de otro evento, sin declaración | Badge/card **Revalidación pendiente**, `aptoParaContratar=false` |
| Misma DD con declaración `cargado` | Pendiente de validación; no permite aprobar la DD global |
| Revisor solicita carga sin declaración | Exige **Comentario para el cliente** |
| Declaración cargada y correcta | Revisor aprueba declaración; DD sigue `aprobada` con las mismas fechas |
| Declaración cargada e incorrecta | Revisor observa con comentario; cliente puede reemplazarla |
| Declaración `observado` | No se puede aprobar hasta subir nueva versión |
| Declaración aprobada | Card desaparece; `aptoParaContratar=true` si sigue vigente |
| DD vencida | No se reutiliza; se inicia una DD nueva |
| DD regular aprobada del evento activo | Sin card ni bloqueo por declaración |
| Bandeja filtrada por PERUMIN con sesión PERUMIN | `revalidacionPendiente=0` |
| Bandeja con “Todos los eventos” | Solo suma DD de eventos distintos al activo |
| Cambio de contexto en `/presala?change=1` | Cambia `session.eventoId` y recalcula la revalidación |
| Observación duplicada | Se actualiza la observación abierta y se resuelven duplicados |
| Evento actual con declaración cargada | No se muestra bloque de revalidación |

### 13.3 Verificación de datos

Para encontrar casos de prueba en QA:

```sql
select d.codigo, e.ruc, e.razon_social, ev.evento_padre_id, d.evento_id,
       d.estado, d.origen, d.fecha_aprobacion, d.fecha_vencimiento
from debida_diligencia d
join empresa e on e.id = d.empresa_id
where d.origen = 'importado'
  and d.estado = 'aprobada'
  and d.fecha_vencimiento > now()
order by d.evento_id, d.codigo;
```

Para revisar la declaración:

```sql
select d.codigo, doc.tipo, doc.estado, doc.observacion
from debida_diligencia d
left join debida_diligencia_documento doc
  on doc.expediente_id = d.id and doc.tipo = 'declaracion_vigencia'
where d.origen = 'importado';
```

Para buscar observaciones duplicadas abiertas:

```sql
select expediente_id, documentoTipo, count(*)
from debida_diligencia_observacion
where estado = 'abierta' and documentoTipo = 'declaracion_vigencia'
group by expediente_id, documentoTipo
having count(*) > 1;
```

En QA no se deben importar documentos. Las DD históricas pueden seguir con 0/4
documentos; eso es esperado.

### 13.4 Criterios de aceptación

- El estado `aprobada` no cambia al aprobar u observar la declaración.
- `fechaAprobacion` y `fechaVencimiento` no cambian.
- No se crea una DD nueva ni se duplican beneficiarios.
- La declaración `observado` bloquea el uso y permite una nueva versión.
- La declaración `aprobado` desbloquea Solicitudes.
- No se crean observaciones abiertas duplicadas.
- La bandeja y el modal respetan el evento activo de la sesión.
- Una DD del evento activo no muestra revalidación.
- La API y la UI devuelven los mismos flags.

## 14. Producción: orden de ejecución

### 14.1 Antes de tocar producción

1. Confirmar autorización explícita y ventana de cambio.
2. Confirmar que la data histórica fue auditada y aprobada por negocio.
3. Confirmar que los conflictos CSV/matriz están resueltos.
4. Confirmar que el deploy de código y las migraciones están aprobados.
5. Tomar respaldo `pg_dump -Fc` y probar la restauración.
6. Registrar conteos iniciales de empresas, DD, DD importadas, beneficiarios,
   documentos y eventos.
7. No ejecutar `prisma migrate reset`, `prisma db push` ni borrados masivos.

### 14.2 Separar código de datos

El deploy del código de revalidación **no importa ni homologa datos por sí solo**.
La carga histórica y el enriquecimiento de matriz son operaciones de datos separadas,
con su propio respaldo, autorización y validación.

### 14.3 Ejecución

1. Ejecutar la importación de estado/evento desde el CSV oficial.
2. Ejecutar el enriquecimiento de matriz en una transacción.
3. No copiar archivos de documentos desde local/QA.
4. Verificar los conteos y la distribución por evento.
5. Validar en UI los casos de evento actual y evento distinto.
6. Validar que una DD del evento actual no requiere revalidación.
7. Validar que una DD de otro evento sí la requiere cuando corresponde.
8. Confirmar que no se modificaron DD regulares.
9. Ejecutar pruebas de aprobación, observación y reenvío de declaración.
10. Cerrar con validación funcional de Solicitudes y bandeja.

### 14.4 Rollback

Si falla una transacción, no debe quedar carga parcial. Si falla la validación después
del commit, restaurar el respaldo, validar conteos y documentar el incidente. La
restauración de producción requiere autorización explícita.

## 15. Pendientes antes de producción

- Homologar la data histórica de producción y resolver diferencias CSV/matriz.
- Decidir si las DD importadas sin documentos se marcan como legado pendiente de
  regularización.
- Definir el tratamiento visible de beneficiarios con 0%.
- Confirmar que los casos del evento actual no se bloquearán por una declaración
  faltante.
- Validar en QA la matriz enriquecida si se requiere paridad con local.
- Aprobar cualquier importación o regularización masiva antes de ejecutarla.
