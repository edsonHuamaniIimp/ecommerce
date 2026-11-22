# Debida Diligencia - Ronda 2 de pruebas adversariales en QA

> **Fecha:** 2026-11-22
> **Ambiente:** QA (`qa-ecommerce.sistemasiimp.org.pe`), imagen `3e78334` (ya incluye los arreglos de la ronda 1).
> **Objetivo:** romper flujos: vigencia (solo declaración), observación y subsanación en varias rondas, permisos, estados inválidos, validaciones, archivos y concurrencia.
> **Resultado:** 137 casos, 118 OK y 19 FAIL, que corresponden a **17 hallazgos distintos**.
> **Herramienta:** [`scripts/e2e-dd-qa/ronda2.mjs`](../../scripts/e2e-dd-qa/ronda2.mjs) y `ronda2-setup.mjs` (salida en `ultima-corrida-ronda2.txt`).
> **Aislamiento:** misma técnica de la ronda 1 (contenedor temporal sin clave de correo ni de Pusher, ya eliminado). Ver [`26-dd-smoke-e2e-qa.md`](./26-dd-smoke-e2e-qa.md).

Cada caso afirma el comportamiento correcto: un FAIL es un posible defecto. Los datos se crearon con 30 empresas `E2E RONDA2 R01..R30` y usuarios `e2e-r01..r30@example.invalid`. Las DD importadas y vencidas de las pruebas de vigencia se sembraron por base de datos clonando una DD importada real de QA.

## 1. Lo que resistió (118 casos OK)

- **Vigencia por declaración (DD importada de otro evento):** el cliente ve que requiere declaración; solo admite PDF; rechaza archivos inexistentes y la carga doble; SIG observa, el cliente subsana, SIG aprueba; aprobar dos veces, observar una aprobada o rechazar la declaración son rechazados; una DD vencida no admite declaración y obliga a repetir la DD; sin declaración no se puede enviar una DD nueva.
- **Observación y subsanación del cliente:** reenviar sin cambiar el documento, o corregir solo uno de dos documentos observados, es rechazado; corregir todos resuelve las observaciones; segunda ronda de observación; el documento adicional pedido es obligatorio y solo admite PDF; observar un **vínculo** y corregirlo funciona.
- **Legal:** sin motivo o sin informe es rechazado; no puede observar dos veces seguidas; dos rondas de observación con documento adicional; rechazo con informe; tras rechazar nadie puede aprobar ni editar.
- **Permisos:** 24 combinaciones de rol y endpoint (cliente, SIG, Comunicaciones, Legal y sin sesión) responden 401 o 403; el cliente no ve detalle, historial ni vínculos de otra empresa; tokens con `alg=none` o firma falsa son rechazados.
- **Validaciones:** porcentaje fuera de rango, nombre o documento largos, DNI corto, nacionalidad con HTML, 21 beneficiarios, enums inválidos, correo inválido, relación inexistente y referencias a archivos falsos o de otro dominio dan 400; los campos protegidos (`estado`, `origen`, `decisionLegal`…) enviados por el cliente se ignoran.
- **Archivos:** HTML o ejecutable disfrazados de PDF, vacíos, `.html`/`.svg`/`.exe` y 15 MB se rechazan; la carrera de 5 `guardar` simultáneos no duplica vínculos; 3 `nueva` simultáneas no duplican el expediente.
- **Matriz:** listas o criterios inválidos, observado sin texto, final inexistente y comentario largo dan 400; "Automatizar todo" doble no lanza dos procesos; APTO con un vínculo observado se rechaza.

## 2. Hallazgos

| # | Sev. | Hallazgo | Evidencia | Arreglo sugerido |
|---|---|---|---|---|
| 1 | **Alta** | **SIG puede derivar a Legal un expediente que Legal dejó observado esperando al cliente.** El estado pasa de `observada` a `en_legal`; la observación queda sin subsanar y el cliente ya no puede reenviar ("El expediente ya fue enviado a revisión"). | `revisar` con acción "derivar" acepta `observada` porque `enRevision` incluye ese estado. Probado: `observada -> en_legal`. | Bloquear la derivación mientras `decisionLegal = observar` esté pendiente. |
| 2 | **Alta** | **Los documentos de las empresas se descargan sin sesión.** Cualquiera con la URL `/uploads/<id>` los obtiene, y un cliente puede descargar el de otra empresa. | `GET /uploads/<id>.pdf` sin cookie devuelve 200 con ficha RUC, poderes y DNI de representantes. El identificador es aleatorio, pero no hay control de acceso. | Exigir sesión y autorizar por empresa o rol; mientras tanto, enlaces firmados y de corta duración. |
| 3 | **Alta** | **"SIN RESPUESTA" deja a la empresa atrapada.** El resultado es irreversible y el expediente queda `en_revision`: el cliente no puede renovar (409) ni editar (409). | Probado: tras registrar SIN RESPUESTA, `nueva` y `guardar` fallan; registrar otro resultado da 409 "ya está cerrado". | Cerrar el expediente (estado propio) y permitir una nueva DD, o permitir revertir. |
| 4 | **Media** | **Al reemplazar un vínculo, la matriz conserva el anterior.** Si SIG ya lo había evaluado, la fila vieja no se elimina y se suma la nueva (R24: 5 filas, "SOCIO 2" y "SOCIO 2 CORREGIDO"). La fila vieja sigue en Comunicaciones y puede bloquear el APTO. | `sincronizarEvento` solo borra filas automáticas obsoletas si nadie registró evaluación. | Marcarlas como retiradas o eliminarlas y retirar su caso reputacional pendiente. |
| 5 | **Media** | **Un expediente `aprobada` de otro evento por el flujo regular no tiene camino de "solo declaración".** | `puedeRegularizarDeclaracionVigencia = false` y 409 "Solo las DD importadas…". La regla acordada pide declaración de vigencia para APTO y APTO CON OBSERVACIONES dentro de 6 meses; hoy el cliente debe repetir la DD. | Extender la revalidación a todas las DD aprobadas y vigentes. |
| 6 | **Media** | **Sin límite ni bloqueo de intentos de login.** | 12 contraseñas incorrectas seguidas dieron 401 sin retraso, y luego el login correcto entró. | Límite por cuenta e IP con retraso progresivo o bloqueo temporal. |
| 7 | **Media** | **Carreras sin idempotencia.** Cinco `enviar` simultáneos fueron aceptados (5 envíos en el historial) y dos decisiones de Legal en paralelo también. En producción duplican alertas y correos. | Ver `ultima-corrida-ronda2.txt` (casos X8). | Transiciones atómicas (`update ... where estado = esperado`). |
| 8 | **Media** | **Comunicaciones puede modificar un caso ya cerrado**, de aceptado a observado, sin reapertura ni rastro, aunque SIG ya concluyó sobre ese veredicto. | `reputacion/observar` sobre un caso cerrado devolvió OK. | Rechazar cambios en casos cerrados o exigir reapertura con historial. |
| 9 | **Media** | **El `sitio web` acepta cualquier esquema** (`javascript:`) y el expediente se envía. Se muestra como enlace en la revisión de SIG y en Comunicaciones. | `guardar` y `enviar` aceptaron `javascript:alert(document.cookie)`. React 19 bloquea esos enlaces, pero la validación falta. | Aceptar solo `http`/`https`. |
| 10 | **Media** | **El documento del representante acepta letras con tipo DNI** y el envío se acepta (`ABCDEFGH`). | El beneficiario sí valida los 8 dígitos; el representante no. | Aplicar la misma validación del DNI al representante. |
| 11 | Baja | **Error 500 por un caracter nulo** (`estado=%00`) en la bandeja y en la bandeja reputacional. | `bandeja?estado=%00` y `reputacion/listar?estado=%00` dan 500. | Validar el filtro `estado` contra el catálogo. |
| 12 | Baja | **Error 500 al resolver un caso reputacional inexistente** (Prisma `update` sin registro). | `reputacion/observar` con un id inexistente. Debería ser 404. | Verificar la existencia antes de actualizar. |
| 13 | Baja | **Error 500 con una fecha final imposible** (`2026-13-45`). | `matriz-evaluacion/guardar` con `finalFecha` inválida. Debería ser 400. | Validar la fecha. |
| 14 | Baja | **La fecha de decisión final acepta el año 2099** y valores incoherentes. | Aceptada sin límite. La fecha de decisión debe ser la de hoy o anterior. | Rechazar fechas futuras. |
| 15 | Baja | **Conclusión contradictoria aceptada:** resultado "aceptado" con conclusión "requiere DD reforzada". | `matriz-evaluacion/guardar` la acepta. | Validar la coherencia entre resultado y conclusión. |
| 16 | Baja | **Los archivos se sirven sin `X-Content-Type-Options` ni `Content-Disposition`.** | Respuesta de `/uploads/<id>.pdf`. | Agregar `nosniff` y `inline; filename=…`. |
| 17 | Baja | **Sin límite de tamaño del cuerpo de la petición.** Un JSON de 5 MB se procesó (200). | `POST /guardar` con un campo de relleno de 5 MB. | Límite de tamaño por endpoint. |

Observaciones sin clasificar como defecto:

- Un expediente aprobado cuya vigencia venció puede renovarse con una DD nueva; el expediente original sigue visible junto al nuevo.
- Al subir un archivo, el nombre original se descarta y se usa un identificador aleatorio, lo que descarta el recorrido por rutas (`../`).

## 3. Prioridad sugerida

1. **#1, #2 y #3** (flujo roto, datos personales públicos, empresa atrapada).
2. **#4, #5, #7 y #8** (integridad del flujo).
3. **#6, #9 y #10** (seguridad y validación).
4. **#11 a #17** (errores 500 y validaciones menores).

## 4. Cómo repetir

Ver [`scripts/e2e-dd-qa/README.md`](../../scripts/e2e-dd-qa/README.md). Para la ronda 2: `ronda2-setup.mjs` (una vez) y `ronda2.mjs` dentro del contenedor aislado; opcionalmente `E2E_SOLO=V,S,X,M,N`. Antes de repetir, borrar los expedientes `E2E RONDA2` (la corrida de ejemplo lo hizo con `delete from debida_diligencia where empresa_id in (select id from empresa where ruc like '20999992%')`).
