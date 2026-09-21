---
name: lineamientos-bd
description: Estándares y buenas prácticas de persistencia/base de datos para proyectos IIMP. Consultar SOLO cuando se diseñan tablas, modelos/entidades, migraciones, índices, constraints, secuencias o consultas SQL. Cubre nomenclatura (tablas TB, PK/FK/IDX, secuencias), normalización, PK obligatoria, descripciones de tablas/campos y la excepción para ORMs/frameworks.
---

# Lineamientos de Base de Datos (IIMP)

Adaptado del documento técnico **"Estándares de Base de Datos"** (Oracle / SQL Server).
Aunque el original apunta a motores relacionales, aquí se destilan las **buenas
prácticas** aplicables a cualquier persistencia del proyecto.

## 0. Aplicabilidad (leer primero)

- **Excepción ORM/framework:** el estándar de *nomenclatura de objetos* (tablas,
  índices, constraints) **NO aplica** cuando se usa un ORM/framework que genera el
  esquema automáticamente. En ese caso se sigue la convención idiomática del ORM.
- **Las BUENAS PRÁCTICAS de la sección 6 aplican SIEMPRE** (con o sin ORM).
- Si se escribe **SQL/DDL a mano** (Oracle/SQL Server/Postgres), aplicar la
  nomenclatura de las secciones 2–5.
- El motor de BD de este proyecto está **por confirmar**; usar esta regla como
  referencia al modelar (`docs/03-arquitectura/modelo-datos.md`).

## 1. Regla general

- Nombres por **mnemotécnico**, **en MAYÚSCULAS**, sin espacios (usar `_`).
- Máximo **30 caracteres** por nombre de objeto.
- Sin referencias a proveedor/marca en nombres de objetos o esquemas.
- Indicar el **esquema** en toda sentencia (`SELECT * FROM <ESQUEMA>.<TABLA>`).

## 2. Tablas

`TB<T>_<SISTE/MODUL>_<DESCRIPCION>` — la descripción en **plural** (solo la última
palabra si es compuesta).

Tipo `<T>` (1 carácter):

| T | Tipo | Uso |
| - | ---- | --- |
| `T` | Transaccional | Datos que cambian con frecuencia |
| `M` | Maestra | Catálogo, rara vez cambia |
| `A` | Auxiliar | Catálogo pequeño / temporal |
| `L` | Log | Bitácora de cambios de una transaccional |
| `C` | Control | Control de procesos/aplicativos/batch |
| `R` | Resumen | Datos estadísticos/agregados |

Ej.: `TBT_CHECKIN_PERSONAL`, `TBM_MENU_TIPO_DOC`.

## 3. Índices, PK y secuencias

- Índice: `IDX_<TABLA>_<CAMPO>` (omitir el prefijo `TB[T]` de la tabla).
- Primary Key: `PK_<TABLA>` (el campo es opcional).
- Secuencia: `SQ_[<CAMPO>_]<TABLA>`.

Ej.: `IDX_CHECKIN_PERSONAL_ID_PERSONA`, `PK_MENU_TIPO_DOC`, `SQ_CHECKIN_PERSONAL`.

## 4. Constraints

- `UQ_<Tabla>_<Columna>` (unique), `DF_<Tabla>_<Columna>` (default),
  `CK_<Tabla>_<Columna>` (check).
- Foránea: `FK_<TablaOrigen>_<TablaDestino>`.

Ej.: `UQ_DEPARTAMENTO_NOM_DEP`, `CK_PERSONAL_SEXO`, `FK_VOLUNTARIO_X_PERSONAL`.

## 5. Otros objetos (SQL a mano)

- Procedures/Triggers: `<TP>_<SISTE/MODUL>_<REF>_<DESCRIPCION>` — `TP` ∈ {`USP`,`TR`};
  `REF` ∈ {`INS`,`UPD`,`DEL`,`SEL`}. Ej.: `USP_AURORA_SEL_ATENCION`.
- Views/Functions: `<TP>_<SISTE/MODUL>_<DESCRIPCION>` — `TP` ∈ {`VW`,`FN`} (plural).
- Variables: `<X>_<NOMBRE>` — `X` ∈ {`V`archar,`I`nt,`D`ate,`C`har,`N`umérico,`P` cursor,`B`it}.
- Encabezado de comentario obligatorio en procs/functions/views/triggers
  (NOMBRE, RQ/DC, OBJETIVO, AUTOR, FECHA, PARÁMETROS) + bloque `MODIFICACIONES`.

## 6. Buenas prácticas (aplican SIEMPRE)

1. **Toda tabla debe tener Primary Key.** Nunca tablas sin PK.
2. **Normalizar** (3FN como buen punto intermedio); evitar columnas `NULL`
   innecesarias que delaten un esquema poco normalizado. Sin sobre-normalizar.
3. **Descripción obligatoria** de cada tabla y de **cada columna** (comentarios de
   objeto). Es trabajo del desarrollador mantenerla.
4. **Nombres descriptivos e intuitivos** (mnemotécnicos). Evitar abreviaturas; si son
   inevitables, documentarlas.
5. **Índices para performance**: al optimizar una consulta, verificar uso de índices.
   Separar almacenamiento de datos vs. índices (tablespaces `..._DAT` / `..._IDX` en
   Oracle) cuando aplique.
6. **Usar alias** para tablas en las consultas.
7. **`ORDER BY`** va en la sentencia principal, no en subconsultas.
8. **Diseño simple**: evitar tablas innecesarias.
9. Indicar el **esquema** del objeto en cada sentencia.
10. Solo **MAYÚSCULAS** para nombrar elementos (schemas, tablas, campos, variables).
11. **`WITH (NOLOCK)`** tras la tabla/alias en `SELECT` — **solo SQL Server**.
12. Exportes/reportes en el formato que pida el usuario (por defecto `.xlsx`/`.csv`).

## 7. Adaptación a este proyecto (Next.js + ORM)

- Si se usa un ORM (p. ej. Prisma/Drizzle/Mongoose), el **modelo se define en código**
  con nomenclatura idiomática; la nomenclatura relacional de las secciones 2–5 queda
  como referencia para migraciones/DDL manuales o mapeo `@map`.
- **Mantener siempre**: PK/identificador único, integridad referencial, índices por
  campos de búsqueda/filtro (p. ej. por evento, estado), campos de auditoría
  (`creadoEn`, `actualizadoEn`, `creadoPor`) y **descripciones** (comentarios/JSDoc).
- Toda entidad de negocio del sistema debe reflejarse en `docs/03-arquitectura/modelo-datos.md`.
```
