# Importación y asignación de eventos DD en QA

## 1. Objetivo

Dejar la data de Debida Diligencia de QA alineada con la estrategia usada en DEV:

- una empresa puede tener varias DD;
- cada DD pertenece a un evento/version concreta;
- el estado, las fechas y el evento provienen de la fuente oficial de resultados;
- la importación es idempotente y no elimina registros existentes;
- los datos de QA se preservan y solo se corrige su asignación de evento.

## 2. Fuentes de información

### Fuente oficial de estado

`RESULTADO_DEBIDA_DILIGENCIA_FINAL_MOSTRAR_IMPORT_PROD.csv`

Columnas usadas:

- `FECHA DE INGRESO SOLICITUD`
- `FECHA DE REVISION POR SIG`
- `PERSONA JURIDICA / PERSONA NATURAL`
- `RUC / DNI / ID`
- `MOTIVO DE LA EVALUACION`
- `EVENTO O PROYECTO ASOCIADO`
- `RESULTADO DE EVALUACION DEBIDA DILIGENCIA`

Esta fuente define el resultado (`APTO`, `APTO CON OBSERVACIONES`, `NO APTO`,
`PENDIENTE`), las fechas y el evento. La vigencia de 6 meses se calcula desde la
fecha de revision/aprobacion.

### Fuente de respuestas del formulario

`Proceso de Debida Diligencia Instituto de Ingenieros de Minas del Perú (respuestas).xlsx`

Contiene 406 respuestas y campos de solicitud: vinculo, razon social, RUC, pais,
actividad economica, representante y beneficiarios finales.

**No contiene** el resultado de la DD ni una columna de evento. Por ese motivo no se
usa para decidir el estado ni para asignar el evento. Puede usarse posteriormente
para enriquecer campos del formulario, previa conciliacion por RUC.

## 3. Regla de asignacion de evento

Se tomo `EVENTO O PROYECTO ASOCIADO` del CSV oficial y se normalizo (mayusculas,
sin tildes):

| Valor en la fuente | Evento destino | Tipo/codigo |
|---|---|---|
| Contiene `PROEXPLO` | PROEXPLO 2026 | tipo 1, codigo 28 |
| Contiene `WMC` o `WORLD MINING` | WORLD MINING CONGRESS 2026 | tipo 13, codigo 1 |
| Contiene `GESS` | GESS 2026 | tipo 14, codigo 1 |
| `PERUMIN`, `IIMP`, `EXTEMIN`, `PERUMIN - IIMP`, `PROVEEDOR`, `ALQUILER`, `HOMOLOGACION`, `NO INDICA` | PERUMIN 2027 | tipo 2, codigo 19 |

La regla replica la clasificacion local: solo PROEXPLO, WMC y GESS se separan; el
resto de valores funcionales u operativos permanece en PERUMIN.

## 4. Estrategia ejecutada en QA

### 4.1 Acceso

- Entorno: EC2 QA, instancia `iimp-ctrst-qa-app`.
- App: contenedor `ctrst-qa-app` con commit `07c108d`.
- Base de datos: contenedor `ctrst-qa-postgres`, base `contratos_stands`.
- Acceso administrativo por AWS SSM; no se expusieron credenciales.

### 4.2 Respaldo previo

Antes de modificar datos:

```text
/opt/ctrst-qa/backups/pre-dd-events-20261023.dump
```

Formato `pg_dump -Fc`, 743 KB.

### 4.3 Catalogo de eventos

Se crearon/actualizaron, de forma idempotente:

- padre PROEXPLO (`codigo 1`);
- padre WORLD MINING CONGRESS (`codigo 13`);
- padre GESS (`codigo 14`);
- version PROEXPLO 2026 (tipo 1, codigo 28);
- version WORLD MINING CONGRESS 2026 (tipo 13, codigo 1);
- version GESS 2026 (tipo 14, codigo 1).

PERUMIN 2027 (tipo 2, codigo 19) ya existia.

### 4.4 Reasignacion

Se leyeron todas las DD con `origen = importado` y se actualizo unicamente
`eventoId` segun la tabla de la seccion 3.

No se eliminaron DD, empresas, documentos ni historial. No se modifico el estado
ni las fechas de las DD. La operacion es idempotente: puede repetirse y el
resultado es el mismo.

### 4.5 Resultado

DD importadas reasignadas:

| Evento | DD movidas |
|---|---:|
| PERUMIN 2027 | 301 |
| PROEXPLO 2026 | 87 |
| WORLD MINING CONGRESS 2026 | 89 |
| GESS 2026 | 90 |
| **Total** | **567** |

Estado final de las DD importadas:

- PERUMIN: 265 aprobadas, 32 en revision, 4 observadas.
- PROEXPLO: 86 aprobadas, 1 rechazada.
- WMC: 84 aprobadas, 5 rechazadas.
- GESS: 90 aprobadas.

La base QA conserva mas registros que DEV porque el antecedente de importacion de
QA uso `RESULTADO_DEBIDA_DILIGENCIA_FINAL_MOSTRAR_IMPORT_DEDUP.csv` (582 filas).
No se reemplazo esa data por la de DEV; se aplico la misma regla de evento.

## 5. Verificacion

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
```

Comprobaciones esperadas:

- todos los `eventoId` de DD importadas existen en `evento`;
- no hay DD importadas con `eventoId` nulo;
- la suma por evento coincide con el total de importadas;
- no se altero el total de empresas ni de DD.

## 6. Repeticion del procedimiento

Para una nueva carga o correccion de eventos:

1. Tomar respaldo de QA.
2. Verificar que existan los padres y versiones de evento de la tabla.
3. Normalizar `EVENTO O PROYECTO ASOCIADO`.
4. Actualizar `eventoId` solo en DD `origen = importado`.
5. No crear eventos duplicados: usar la clave unica `(tipoEvento, codigoEvento)`.
6. Ejecutar las consultas de control.
7. Si se requiere importar nuevas filas, usar la pantalla de importacion masiva
   con el evento seleccionado; la importacion omite empresas que ya tienen DD en
   ese evento.

## 7. Reglas de seguridad

- QA se modifico con autorizacion explicita; no se toco produccion.
- No se ejecuto `prisma migrate reset`, `prisma db push` ni ningun borrado masivo.
- La migracion de QA se aplico mediante el deploy de la rama `qa`.
- Cualquier restauracion del respaldo requiere autorizacion y debe hacerse sobre QA.
