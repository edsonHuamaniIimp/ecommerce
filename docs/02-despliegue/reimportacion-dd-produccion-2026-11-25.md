# Reimportación de Debida Diligencia en producción — 25 de noviembre de 2026

Registro de lo que se hizo, por qué, con qué reglas, qué quedó pendiente y cómo repetirlo o revertirlo.
Complementa `importacion-dd-qa.md` (la carga original del 21 de octubre y la estrategia general).

## 1. Resumen

| Dato | Valor |
|---|---|
| Fecha y hora | 25-nov-2026, ~01:55 hora de Lima (06:55 UTC) |
| Base | `contratos_stands` (Aurora `iimp-ctrst-prod-aurora`), con el sistema en modo mantenimiento |
| Quién autorizó | Programador oficial del proyecto (Edson Huamani) |
| Fuente | `RESULTADO DEBIDA DILIGENCIA FINAL_MOSTRAR.xlsx` (986 filas, guardado el 24-nov-2026 23:12) |
| Snapshot previo | `iimp-ctrst-prod-pre-import-dd-20261125-0118` (cifrado, disponible) |
| Lote registrado | `dd_importacion.id = 38ae6627-06c5-4ce4-bc7e-9ecaf4fc8d1d` |
| Resultado | 314 empresas y 383 DD creadas, 25 DD pasadas a APTO, 177 DD movidas de evento |
| Totales después | 1054 empresas, 1004 DD (831 importadas + 173 del portal) |
| Script | `scripts/reimportacion-dd/reimportar-dd.cjs` (conversor del Excel: `xlsx-a-json.cjs`) |
| Lista de lo NO importado (para recordar) | `docs/02-despliegue/reimportacion-dd-produccion-2026-11-25-no-importados.csv` (bajadas de APTO, filas con identificador raro, omitidas, DD del portal y fechas distintas) |
| Detalle fila por fila | `C:\Users\ASUSVivobook\Downloads\PRUEBAS\informes\Reimportacion DD produccion 2026-11-25 - detalle.xlsx` |

## 2. Por qué se reimportó

La carga del 21 de octubre (dos lotes: 132 y 484 filas) dejó producción desactualizada frente al Excel oficial:

- Las 448 DD importadas quedaron todas en **PERUMIN 2027**, aunque el Excel ubicaba 192 en GESS, WMC y PROEXPLO.
  En producción solo existía el evento PERUMIN 2027; en QA los eventos se separaron después con un paso aparte.
- 25 DD seguían "en revisión" cuando el Excel las daba por APTO.
- Faltaban 314 empresas y 383 DD que el Excel ya tenía.
- Las fechas de revisión de la carga original estaban un día antes que las del Excel (ver §6.4).
- Todas las DD importadas se cargaron sin representante ni beneficiarios (el enriquecimiento con la matriz solo se hizo en QA).

## 3. Preparación

1. Autorización del programador oficial y sistema en **modo mantenimiento** (lo puso el programador).
2. **Snapshot** manual del clúster `iimp-ctrst-prod-aurora` (etiquetas `project=contratos-stands`, `environment=prod`).
3. Verificación de que **no hubo escrituras** entre el snapshot y la importación (DD y empresas sin modificaciones posteriores; `audit_log` sin filas posteriores).
4. Simulación de solo lectura en producción, con el mismo resultado que en QA.

Nota: el modo mantenimiento no detuvo las tareas de ECS (siguieron 8 corriendo); solo bloquea a los usuarios.

## 4. Pruebas en QA con datos de producción

- Se creó la base **`prodcopy`** en el servidor de QA (contenedor `ctrst-qa-postgres`) con el esquema completo (`prisma migrate deploy`) y una copia de las tablas
  `empresa`, `evento_padre`, `evento`, `evento_metadata`, `dd_importacion`, `debida_diligencia` y `debida_diligencia_empresa_estado`.
  **No se copiaron usuarios ni credenciales.** La base de QA no se tocó.
- Se aplicó el script **dos veces desde cero** (reiniciando `prodcopy` entre pruebas) y una segunda corrida sobre lo ya aplicado dio **0 cambios**.
- Se encontraron y corrigieron en esas pruebas: columna `pais` obligatoria, empresa repetida en dos eventos, y detección de "DD tocada por el equipo" que contaba las propias actualizaciones.
- La base `prodcopy` sigue en el servidor de QA; se puede borrar con `drop database prodcopy`.

## 5. Reglas aplicadas

Clave de cada DD: **empresa (documento normalizado) + evento**.

| Caso | Acción |
|---|---|
| Empresa inexistente | Crea la empresa (como `crearSiNoExiste`: RUC → `tipo_documento 6`, país `PE`; resto → `0`, país vacío) y su DD importada |
| Empresa existente sin DD de ese evento | Crea la DD |
| DD importada en PERUMIN 2027 cuyo evento en el Excel es otro (y sin fila PERUMIN) | Solo reasigna el evento; **no toca estado ni fechas** |
| DD importada, **estado distinto**, sin actividad del equipo y Excel igual o más reciente | Actualiza estado y fechas **con las del Excel** (aprobación = fecha de revisión; vigencia = +6 meses) |
| DD ya en el estado correcto (p. ej. APTO ya declarado) | **No se reescribe**; las diferencias de fecha se omiten (opt-in: `--corregir-fechas`) |
| DD del portal (`flujo_regular`) | Nunca se toca |
| DD con actividad del equipo (revisor distinto de `importacion_masiva`, historial, observaciones o resultados de matriz) | No se toca |
| El Excel baja un APTO a otro estado | No se aplica salvo `--confirmar-bajadas=<documentos>` |
| Identificador no confiable | No se importa; queda para revisión manual |

**Eventos:** PROEXPLO → PROEXPLO 2026 (tipo 1, versión 28), WMC → World Mining Congress 2026 (tipo 13, versión 1), GESS → GESS 2026 (tipo 14, versión 1);
todo lo demás (PERUMIN, IIMP, PROVEEDOR, HOMOLOGACIÓN, etc.) → PERUMIN 2027. Es la regla de `importacion-dd-qa.md` §4. Se verificó que los tres eventos existen en la API de eventos
(`KBSERVICIOS_URL`, igual en QA y producción) y se **materializaron** en producción como filas locales (`evento` + `evento_padre`), sin metadatos de presala.

**Mapeo de estados del Excel** (decisión del equipo, 25-nov-2026):

| Resultado en el Excel | Estado de la DD |
|---|---|
| APTO, APTO CON OBSERVACIONES | `aprobada` |
| NO APTO | `rechazada` |
| EN REVISIÓN / EN REVISION | `en_revision` |
| DOCUMENTACIÓN OBSERVADA | `observada` |
| **SOLICITUD DE CORRECCIÓN DE DJ / DOCS** | `observada` (el importador de la aplicación las rechazaba como "resultado no reconocido") |
| **PENDIENTE** | `pendiente` (el importador de la aplicación lo rechazaba) |

## 6. Resultado en producción

| Acción | Cantidad |
|---|---|
| Crear empresa y DD | 314 |
| Crear solo la DD (empresa ya existía) | 69 |
| Reasignar evento (GESS 89, WMC 69, PROEXPLO 19) | 177 |
| Pasar a APTO (estaban en revisión) | 25 |
| Omitidas: solo diferían las fechas | 177 |
| Omitidas: DD del portal | 138 |
| Sin cambio | 61 |
| Pendientes de confirmación (bajarían un APTO) | 2 |
| Omitidas: Excel más antiguo / tocada por el equipo | 1 / 1 |

Estados de las 383 DD nuevas: 331 APTO, 32 documentación observada, 18 en revisión, 1 NO APTO, 1 pendiente.

Verificación posterior en producción: segunda simulación = **0 acciones**; sin DD duplicadas por empresa+evento, sin códigos repetidos, sin DD sin empresa, sin RUC duplicados,
0 DD del portal modificadas. Eventos: PERUMIN 2027 = 725 DD, GESS 2026 = 94, PROEXPLO 2026 = 93, WMC 2026 = 92. Códigos DD-2026-0622 a DD-2026-1004 para las DD nuevas.
Auditoría: 585 filas `Reimportacion: …` en `audit_log` (383 creaciones, 177 reasignaciones, 25 cambios de estado), con el estado anterior en `metadata.antes`.

### 6.1 Casos que BAJAN un APTO — se dejaron fuera (decisión del equipo)

Para acordarse después: el sistema las tiene APTO y el Excel dice otra cosa **más reciente**. No se aplicaron. Para aplicarlas más adelante hay que confirmarlas con SIG y correr el script con
`--confirmar-bajadas=20101391397,20100277485`.

| Empresa | RUC | DD | Sistema | Excel |
|---|---|---|---|---|
| COMERCIAL INDUSTRIAL DELTA CIDELSA | 20101391397 | DD-2026-0213 | APTO (revisión 26-abr-2026) | DOCUMENTACIÓN OBSERVADA (17-nov-2026) |
| PROCESADORA SUDAMERICANA S.R.L. | 20100277485 | DD-2026-0284 | APTO (revisión 21-jun-2026) | EN REVISIÓN (30-oct-2026) |

### 6.2 Filas del Excel que no se importaron (identificador no confiable) — para que SIG las revise

| Fila Excel | Empresa / persona | Valor en la columna RUC/ID | Resultado |
|---|---|---|---|
| 28 | FLEET SPACE TECHNOLOGIES PTY LTD | `RUT: 77652244-9` | APTO |
| 55 | CDN RESOURCES LABORATORIES | (el nombre en vez del ID) | APTO |
| 56 | KRUX ANALYTICS INC | (el nombre en vez del ID) | APTO |
| 57 | STERLING CASSIDY SPA | (el nombre en vez del ID) | APTO |
| 89 | JENIKE & JOHANSON CONSULTORIA EM MATERIAIS SÓLIDOS LTD | `(CNPJ) 19.114.190/0001-04` | APTO |
| 144 | EXPOSISTEMAS SERVICIOS SAC | (vacío; en el sistema figura con documento `NAN`) | APTO |
| 162 | DYNACOR GROUP | `No especifica` | NO APTO |
| 546 | STE DE FABRICATION ET ATELIERS LUCIEN CHOQUENET | `875 520 025 (RCS Saint-Quentin) / EUID: FR0202.875520025` | APTO |
| 618 | PERISSINOTTO S.p.A. | `IVAN°00745780155` (en el sistema ya existe como `00745780155`) | APTO |
| 628 | NTN SUDAMERICANA, S.A. | `N/A` | APTO |
| 943 | MILWAUKEE ELECTRIC TOOL CORPORATION | `NO INDICADO` | EN REVISIÓN |

STE DE FABRICATION tiene además dos empresas en el sistema (`875520025` y `FR0202875520025`) que parecen la misma.

### 6.3 Otras omitidas

- **CONTINENTAL TRAVEL S.A.C.** (DD-2026-0106): el Excel (10-sep-2026) es más antiguo que el sistema (05-oct-2026).
- **MOLY-COP ADESUR S.A.** (DD-2026-0232): la observó Lesly el 19-nov-2026 en el sistema; no se toca lo trabajado por el equipo.
- **138 DD del portal** (el cliente las llenó en el sistema). Dentro de ellas, el Excel ya las da por APTO mientras el sistema no: 78 en revisión, 5 en borrador y 1 observada.
  Las actualiza SIG desde la Matriz DD; el detalle está en la hoja "Portal sin tocar" del Excel de detalle. Ojo: algunas pueden ser DD nuevas legítimas (el cliente la envió **después** de la fecha del Excel); confirmar con SIG antes de actualizarlas.

### 6.4 Desfase de un día en las fechas (354 DD)

Las fechas de revisión/ingreso de la carga del 21 de octubre quedaron **un día antes** que las del Excel oficial (ej.: CHECK POINT ADVERTAINMENT, DD-2026-0204: sistema 20-abr / 22-abr y vigencia al 22-oct;
Excel 21-abr / 23-abr). Se comprobó que las tres versiones del Excel dicen lo mismo, así que el desfase viene de la carga original.
**No se corrigió** (decisión: no reescribir DD ya declaradas). Son 177 DD "solo fechas" + 177 DD movidas de evento cuyas fechas tampoco se tocaron; la hoja "Fechas distintas sin corregir" del Excel de detalle las lista.
Si se decide corregirlas: `--corregir-fechas` (cambia también la vigencia un día).

## 7. Cómo revertir

- **Total:** restaurar el snapshot `iimp-ctrst-prod-pre-import-dd-20261125-0118` como un clúster nuevo (`aws rds restore-db-cluster-from-snapshot`) y apuntar la aplicación a él. Se pierde todo lo escrito después del snapshot.
- **Selectivo:** cada cambio dejó una fila en `audit_log` (`mensaje LIKE 'Reimportacion:%'`, `metadata.accion` = `reimportacion_crear`, `reimportacion_actualizar` o `reimportacion_reasignar_evento`) con el estado anterior en `metadata.antes`.
  Las DD creadas se identifican por `debida_diligencia.importacion_id = '38ae6627-06c5-4ce4-bc7e-9ecaf4fc8d1d'`. Las 314 empresas creadas son las que tienen `created_at` del 25-nov-2026 y `creado_por = 'admin@iimp.org.pe'`.
  Requiere autorización y un respaldo previo; no se escribió un script de reversa.

## 8. Cómo repetirlo

```text
node scripts/reimportacion-dd/xlsx-a-json.cjs "<excel>.xlsx" excel-dd.json
DATABASE_URL=... node scripts/reimportacion-dd/reimportar-dd.cjs --entrada=excel-dd.json --salida=reporte.json            # simulación (no escribe)
DATABASE_URL=... node scripts/reimportacion-dd/reimportar-dd.cjs --entrada=excel-dd.json --salida=reporte.json --aplicar  # escribe, en una transacción
```

Opciones: `--confirmar-bajadas=DOC1,DOC2`, `--corregir-fechas`, `--usuario=<correo>`, `--archivo="<nombre>"`.
En producción se ejecutó con ECS Exec dentro de una tarea `iimp-ctrst-prod-service` (el script y el JSON se subieron a `/tmp/reimp`; son efímeros). La simulación corre con `SET default_transaction_read_only = on`.
La corrida es idempotente: repetirla sin cambios en el Excel da 0 acciones.

## 9. Pendientes

1. **Tabla de estado externo** `debida_diligencia_empresa_estado` (usada en la evaluación de contratación): 132 filas, última actualización 20-oct-2026, **55 con resultado distinto al Excel** (dicen "pendiente" y el Excel APTO). Falta cargarla (`scripts/import-dd-excel.ts` hace solo eso; ojo con el formato del Excel, que trae notas arriba).
2. **Enriquecimiento con la matriz** (representante, beneficiarios, actividad): no se hizo; las DD importadas (831) no tienen representante ni beneficiarios. Se pospuso a pedido del equipo.
3. Los 2 casos de §6.1, las 11 filas de §6.2 y las DD del portal de §6.3 (para SIG).
4. Decidir si se corrigen las fechas de §6.4.
5. Las filas de la matriz de evaluación de las DD nuevas se crean al abrir la Matriz DD (sincronización); la primera apertura puede tardar. Verificar las pantallas (Matriz, bandeja, informes, vigencias) al quitar el mantenimiento.
6. Los tres eventos se crearon con `flg_activo`/`flg_visible` en verdadero y sin metadatos de presala; revisar en `/dashboard/eventos` que no aparezcan donde no deben.
7. Corregir la sección 8 de `importacion-dd-qa.md` ("no se ejecutó en producción"): sí se importó el 21-oct-2026 y se reimportó el 25-nov-2026.
8. Borrar la base `prodcopy` del servidor de QA cuando ya no se necesite.
9. Separado: estado "Documentación recibida" para la DD enviada por el cliente, y los filtros Procedencia y Vigencia en la Matriz DD.
