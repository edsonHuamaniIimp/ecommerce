# API — Inventario Real de Endpoints — ContratosStands

> **Estado:** v1.0 — 2026-09-11
> **Fuente:** Código real (`src/app/api/**/route.ts`, `src/controllers/`, `src/middleware.ts`).
> **Nota:** `docs/04-api/endpoints.md` describe el contrato **propuesto/diseñado**; este documento
> es el **inventario real implementado**. Ante discrepancias, prevalece el código.

---

## 1. Arquitectura de la capa API

- **Route Handlers delgados** en `src/app/api/**/route.ts`. La mayoría son catch-all
  (`[...slug]`) que delegan en `createRouter()` (`src/lib/server/router.ts`): une los
  segmentos del slug con `/` y despacha a la acción con ese nombre. Acción inexistente → 404.
- **Toda la lógica vive en** `src/controllers/*.controller.ts` y `src/lib/server/services.ts`
  (contenedor de inyección de dependencias).
- **No existen Server Actions** (`"use server"`): todas las mutaciones pasan por route handlers.
- **Validación** con Zod en `src/validators/*.validator.ts`.
- **Respuestas de error** uniformes vía `src/lib/server/api-response.ts`.

---

## 2. Middleware (`src/middleware.ts`)

- **Matcher:** todas las rutas excepto `_next/static`, `_next/image`, `favicon.ico`, `sitemap.xml`, `robots.txt`.
- **Rutas públicas:** `/`, `/auth/login`, `/presala`, `/mapa`, `/403`; prefijos `/api/auth/`, `/api/maestra/`;
  rutas exactas `/api/maestra`, `/api/exhibidoras`, `/api/stands/exhibidora`, `/api/stands/contrato`,
  `/api/planos/publico`, `/api/eventos/modal-info`; caso especial `GET /api/eventos/listar?presala=1`.
- **Autenticación:** extrae el token JWT de la cookie `token` y lo verifica con `verifyToken`.
  Sin token o inválido → redirect a `/auth/login?returnTo=<ruta>`.
- **Autorización:** valida el permiso declarado por prefijo con `hasPermission`; si falta → `/403`.
  Permisos: `stands:vinculacion`, `solicitudes:view`, `facturacion:view`, `laboratorio:view`,
  `roles:manage`, `events:manage`, `auspicios:view`, `read:reservas`, `stands:plano`,
  `stands:manage`, `eventos:datos`, `pagos:view` (prefijo `/api/pagos` y `/dashboard/mis-pagos`).
- **Contexto de evento:** roles `admin` omiten el chequeo; usuarios sin `eventoId` en el JWT
  son redirigidos a `/presala`.
- **Cookie:** `token` httpOnly, SameSite=Lax, 24 h (gestionada en `auth.controller.ts`).

---

## 3. Inventario de endpoints por dominio

### 3.1 Auth — `src/app/api/auth/[...slug]/route.ts`

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/auth/session` | GET | Sesión actual del usuario |
| `/api/auth/perfil` | GET | Perfil del usuario autenticado |
| `/api/auth/perfil` | PATCH | Actualiza datos del perfil |
| `/api/auth/login` | POST | Login; emite JWT en cookie httpOnly |
| `/api/auth/registro` | POST | Inicia el registro de exhibidor: guarda datos temporales (password hasheada) y envia un codigo de verificacion al correo |
| `/api/auth/registro/confirmar` | POST | Confirma el registro con el codigo; crea la cuenta (rol cliente) con auto-login y emite JWT en cookie httpOnly |
| `/api/auth/logout` | POST | Cierra sesión y limpia la cookie |
| `/api/auth/seleccionar-evento` | POST | Fija evento activo y reemite token con `eventoId`/`tipoEvento`/`codigoEvento` |
| `/api/auth/reset-password` | POST | Solicita restablecimiento de contraseña |
| `/api/auth/reset-password/confirm` | POST | Confirma el reset con token |
| `/api/auth/cambiar-password` | POST | Cambia la contraseña temporal (primer ingreso) y reemite la sesión |
| `/api/auth/idioma` | PATCH | Guarda el idioma preferido (`es` \| `en`) y sincroniza la cookie `iimp_idioma` |

### 3.2 Solicitudes — `src/app/api/solicitudes/[...slug]/route.ts`

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/solicitudes/listar` | GET | Lista paginada con filtros `eventoId`, `page`, `search`, `userId` |
| `/api/solicitudes/detalle` | GET | Detalle de solicitud por `id` |
| `/api/solicitudes/historial` | GET | Historial de revisiones y cambios de estado |
| `/api/solicitudes/revisar` | POST | Registra revisión por área del pipeline local: `asociado` o `legal` (RF-14/15) (aprobado/rechazado + comentario) |
| `/api/solicitudes/notificar` | POST | Envía correo con resultado de revisiones (requiere `solicitudes:notify`) |
| `/api/solicitudes/modificar` | POST | Reabre solicitud finalizada reseteando revisiones a pendiente |
| `/api/solicitudes/reevaluar` | POST | Crea solicitud de re-evaluación |
| `/api/solicitudes/atender-reevaluacion` | POST | Aprueba o rechaza una re-evaluación |
| `/api/solicitudes/baja` | POST | Da de baja la solicitud |
| `/api/solicitudes/orden-pago` | POST | Marca la solicitud con orden de pago generada |
| `/api/solicitudes/upload-doc` | POST | Asocia documento subido a la solicitud (contrato, firmado o anexo con `requisito` RF-13) |
| `/api/solicitudes/recorte-plano` | POST | Guarda la URL de la imagen (PNG) del recorte del pabellón de la solicitud (RF-08, para el contrato) |
| `/api/contratos/borrador` | POST | **Borrador del contrato** (paso Contrato del wizard): genera DOCX/PDF con los `standIds` seleccionados y las cuotas configuradas **sin crear la solicitud** (montos calculados en el servidor) |
| `/api/contratos/firmar-borrador` | POST | **Firma digital del borrador** (RF-12): estampa la firma del perfil sobre el borrador; 409 si el perfil no tiene firma. Tampoco crea la solicitud |
| `/api/contratos/generar` | POST | Genera el **contrato definitivo** de la solicitud (DOCX/PDF) desde la plantilla etiquetada del idioma (`idioma` opcional `es`/`en`; si falta se resuelve el del cliente) con empresa, stands, IGV 18% y el plan de cuotas (**1–3**, `{ porcentaje, fechaVencimiento }`; fechas no pasadas y ascendentes); las imágenes del Anexo 1 (recortes por pabellón con versión/fecha) se generan en el servidor y el contrato se adjunta de forma idempotente (RF-10/11). Se llama al **confirmar la reserva** (paso 4) |
| `/api/contratos/firmar` | POST | **Firma digital (RF-12)**: estampa la firma del perfil del usuario (`user_role.firma_url`) en el contrato generado y devuelve el contrato firmado (DOCX/PDF); equivale a subir el contrato firmado. 409 si el perfil no tiene firma |
| `/api/solicitudes/eliminar-doc` | POST | Elimina documento de la solicitud |

### 3.3 Eventos — `src/app/api/eventos/[...slug]/route.ts`

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/eventos/listar` | GET | Lista eventos; `?presala=1` (público) y `?id=` devuelve uno |
| `/api/eventos/crear` | POST | Crea evento |
| `/api/eventos/actualizar` | PATCH | Actualiza evento (incluye `modal_info` por versión) |
| `/api/eventos/modal-info` | GET | Modal informativo de `/mapa` por versión; público. `?tipoEvento=&codigoEvento=` |

### 3.4 GESS — `src/app/api/gess/[...slug]/route.ts`

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/gess/listar` | GET | Lista stands GESS por `eventoId` (paginado) o `bloqueId`. Completa `empresa`, `empresaLogo` (RF-09) y `tipoImagen` (imagen referencial del tipo, RF-08) |
| `/api/gess/tipos-imagen` | GET | Catálogo de imágenes referenciales por tipo de stand (admin) |
| `/api/gess/tipos-imagen` | POST | Sube/reemplaza la imagen de un tipo (aplica a todos los stands de ese tipo) |
| `/api/gess/tipos-imagen` | DELETE | Quita la imagen referencial de un tipo |
| `/api/gess/sync` | POST | Sincroniza stands seleccionados desde GESS |
| `/api/gess/mockup` | POST | Genera mockup/datos de stands para un evento |
| `/api/gess/actualizar` | PATCH | Actualiza datos de un stand GESS |

### 3.5 Planos / Laboratorio — `src/app/api/planos/[...slug]/route.ts` y `planos/publico`

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/planos/listar` | GET | Lista todos los planos |
| `/api/planos/tipos-sugeridos` | GET | Tipos de bloque existentes en otros planos, para reutilizarlos en el editor |
| `/api/planos/detalle` | GET | Detalle por `id` o `codigo` |
| `/api/planos/planos-evento` | GET | Planos asociados a `tipoEvento`/`codigoEvento` |
| `/api/planos/macros-de-plano` | GET | Macros que contienen un `planoId` |
| `/api/planos/exportar` | GET | Exporta el plano (JSON) |
| `/api/planos/exportar-ts` | GET | Exporta el plano como TypeScript |
| `/api/planos/ocupacion` | GET | Ocupación de un plano en un evento |
| `/api/planos/crear` | POST | Crea plano (requiere `laboratorio:manage`) |
| `/api/planos/guardar-layout` | POST | Guarda tipos, bloques y furniture del plano |
| `/api/planos/guardar-secciones` | POST | Guarda secciones de un plano macro |
| `/api/planos/asignar-macro` | POST | Asigna un plano a un macro |
| `/api/planos/quitar-macro` | POST | Quita un plano de todos los macros |
| `/api/planos/eliminar` | POST | Elimina plano |
| `/api/planos/importar` | POST | Importa plano |
| `/api/planos/actualizar-meta` | PATCH | Actualiza metadatos del plano |
| `/api/planos/publico` | GET | Vista pública de plano por `codigo` o `tipoEvento`/`codigoEvento` (sin auth) |

### 3.6 Planogess — `src/app/api/planogess/[...slug]/route.ts`

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/planogess/fetch` | POST | Obtiene stands desde el servicio GESS por `tipoEvento`/`codigoEvento` |

### 3.7 Maestra — `src/app/api/maestra/[...slug]/route.ts`

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/maestra/listar` | GET | Lista ítems hijo activos de una `tabla` maestra (público) |

### 3.8 Entidades — `src/app/api/entidades/*`

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/entidades/persona` | POST | Busca personas por `documento` o `nombre` (cliente externo) |
| `/api/entidades/empresa` | POST | Busca empresas por `nroDocument` o `razonSocial` |

### 3.9 Consultas externas (SUNAT/RENIEC)

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/sunat/ruc` | GET | Consulta RUC (valida 11 dígitos) vía cliente externo |
| `/api/reniec/dni` | GET | Consulta DNI (valida 8 dígitos) vía cliente externo |

### 3.10 Upload — `src/app/api/upload/route.ts`

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/upload` | POST | Sube archivo (multipart `file`) al storage y devuelve `url`/`filename` |

### 3.11 Alertas — `src/app/api/alertas/[...slug]/route.ts`

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/alertas/listar` | GET | Lista alertas del usuario; `?no_leidas=1` solo no leídas |
| `/api/alertas/marcar-leida` | POST | Marca una alerta como leída |
| `/api/alertas/marcar-todas-leidas` | POST | Marca todas las alertas del usuario como leídas |

### 3.12 Auspicios — `src/app/api/auspicios/*`

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/auspicios/listar` | POST | Proxy autenticado a KBServicios `/rest/listauspicio` |
| `/api/auspicios/grabar` | POST | Proxy autenticado a KBServicios `/rest/saveauspicio` |

### 3.13 Stands / Integración M2M

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/stands/contrato` | GET | Lista contratos de stands por `tipoEvento`/`codigoEvento` (API key M2M) |
| `/api/stands/exhibidora` | GET | Stands de una exhibidora. Requiere `empresaId`, `tipoEvento` y `codigoEvento` (400 si faltan). Devuelve `estado` comercial, `estado_solicitud`, `pabellon` (sección del macro), `zona`, `x`, `y`, `mapa`. (API key M2M) |
| `/api/exhibidoras` | GET | Lista exhibidoras con búsqueda `q` (API key M2M) |
| `/api/stands/asignar-montajista` | POST | Asigna/reemplaza/desasigna la empresa montajista de un stand (M2M `x-api-key` o sesión con `stands:manage`). Audita en `stand_montajista_historial` |
| `/api/empresas-montajistas` | GET | Catálogo de montajistas (`q` = RUC o razón social; sin `q`, las ya asignadas). Misma auth que el anterior |

> Detalle del contrato de integración con el Sistema de Montaje: `docs/05-integraciones/api-sistema-montaje.md`.

### 3.14 Facturación — `src/app/api/facturacion/[...slug]/route.ts` + `niubizz/*`

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/facturacion/listar` | GET | Lista facturaciones paginadas por `eventoId` |
| `/api/facturacion/detalle` | GET | Detalle de facturación con cuotas |
| `/api/facturacion/agregar-cuota` | POST | Agrega cuota con monto y vencimiento |
| `/api/facturacion/pagar-cuota` | POST | Marca cuota como pagada (comprobante opcional) |
| `/api/facturacion/adjuntar-comprobante` | POST | Adjunta el comprobante fiscal (boleta/factura) de una cuota pagada y notifica al cliente |
| `/api/facturacion/eliminar-cuota` | POST | Elimina cuota |
| `/api/facturacion/actualizar` | PATCH | Actualiza datos de la facturación |
| `/api/facturacion/eliminar` | DELETE | Elimina facturación |
| `/api/facturacion/niubizz/sesion` | POST | Crea sesión de pago Niubizz (**deshabilitado, 503**) |
| `/api/facturacion/niubizz/confirmar` | POST | Confirma pago Niubizz (**deshabilitado, 503**) |

### 3.14b Pagos del exhibidor — `src/app/api/pagos/[...slug]/route.ts`

Vista del cliente (`pagos:view`); cada acción valida propiedad de la facturación. Escrituras requieren `pagos:manage`.

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/pagos/listar` | GET | Facturaciones del cliente (paginadas) con sus cuotas |
| `/api/pagos/detalle` | GET | Detalle de una facturación propia (404/403 si no aplica) |
| `/api/pagos/agregar-cuota` | POST | Agrega cuota (`facturacionId`, `monto`, `fechaVencimiento?`) |
| `/api/pagos/actualizar-cuota` | POST | Edita monto/vencimiento (`cuotaId`) |
| `/api/pagos/adjuntar-voucher` | POST | Adjunta/reemplaza el voucher (`cuotaId`, `comprobante`) sin cambiar estado |
| `/api/pagos/eliminar-cuota` | POST | Elimina cuota y renumera las restantes |

### 3.15 Reservas — `src/app/api/reservas/[...slug]/route.ts`

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/reservas/crear` | POST | Crea reserva de stands; 409 si alguno ya está reservado |

### 3.16 Roles — `src/app/api/roles/[...slug]/route.ts`

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/roles/listar` | GET | Lista roles |
| `/api/roles/crear` | POST | Crea rol con permisos |
| `/api/roles/add-user` | POST | Asigna rol a usuario por email |
| `/api/roles/update-permisos` | PATCH | Actualiza permisos de un rol |
| `/api/roles/remove-user` | DELETE | Quita rol a usuario |

### 3.17 KBServicios — `src/app/api/kbservicios/[...slug]/route.ts`

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/kbservicios/events` | POST | Lista eventos desde KBServicios (`code`, default 14) |
| `/api/kbservicios/event-types` | POST | Lista tipos de evento desde KBServicios |

### 3.18 Observabilidad

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/errors/log` | POST | Registra un error (message/stack/digest/url/metadata) con userId si hay sesión |

### 3.19 Empresas (Portal del Cliente) - `src/app/api/empresas/[...slug]/route.ts`

Bandeja y mantenimiento de empresas registradas por el backoffice. Lectura con `empresas:view`
y escritura con `empresas:manage` (el admin `admin:full` siempre accede).

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/empresas/listar` | GET | Bandeja paginada (`page`, `perPage`, `search` por razón social/RUC, `estado`) |
| `/api/empresas/detalle` | GET | Detalle de una empresa (`id`) |
| `/api/empresas/crear` | POST | Alta individual: valida RUC (11 dígitos), correos, comprobante y duplicados (409) |
| `/api/empresas/actualizar` | POST | Edición parcial (`id` + campos enviados) |
| `/api/empresas/estado` | POST | Activa/desactiva (`id`, `estado`: `activa` \| `inactiva`) |
| `/api/empresas/carga-masiva/previsualizar` | POST | Sube Excel/CSV (`multipart`, campo `archivo`) y valida por fila: RUC/correos/comprobante, duplicados (archivo y BD), datos contractuales faltantes |
| `/api/empresas/carga-masiva/importar` | POST | Importa las filas válidas (`{ filas }`); las filas con error se omiten. Máx. 500 filas / 5 MB |
| `/api/empresas/crear-cuenta` | POST | Crea la cuenta del Portal (`id`): usuario + contraseña temporal, rol cliente, vínculo `empresa_id`; envía credenciales por correo y exige cambio en el primer ingreso |
| `/api/empresas/reenviar-credenciales` | POST | Regenera la contraseña temporal y reenvía las credenciales (`id`) |

### 3.20 Portal del Cliente (empresa propia) - `src/app/api/portal/empresa/[...slug]/route.ts`

Endpoints para la empresa vinculada al usuario autenticado (sin permiso especial; sesión propia).
El middleware exige cambiar contraseña/validar datos cuando la credencial es temporal
(`debeCambiarPassword`).

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/auth/cambiar-password` | POST | Cambio de la contraseña temporal (valida actual, longitud mínima); reemite la sesión sin el flag |
| `/api/portal/empresa/mis-datos` | GET | Datos de la empresa vinculada al usuario (primer ingreso / Mi empresa) |
| `/api/portal/empresa/validar` | POST | Valida/actualiza los datos contractuales y marca `primerAccesoCompletado` |

---

## 4. Convenciones de la API

- **Base path:** `/api`.
- **Formato:** JSON (excepto descargas de archivos).
- **Validación:** Zod en backend; errores → `422` con cuerpo `ApiError`.
- **Auth:** cookie JWT httpOnly (navegador) o API key M2M (integraciones servidor-a-servidor).
- **Errores:** cuerpo uniforme `{ error, code, detalles[] }`.
- **Idempotencia:** operaciones de interoperabilidad deben ser idempotentes y reconciliables.

---

## 5. Pendientes de la capa API

1. **Contrato de interoperabilidad real** con el sistema de John (request/response, auth, X/Y).
2. **Sincronizar `docs/04-api/openapi.yaml`** con este inventario real.
3. **Endurecer permisos** del middleware por endpoint (hoy por prefijo).
4. **Documentar payloads** de cada endpoint con ejemplos (parcialmente en `openapi.yaml`).

### 5.1 Gaps funcionales: diseño Stitch (Gestión de Stands / Vinculación de Stands)

Elementos del diseño que dependen de endpoints o parámetros que aún no existen. No implementar en UI hasta tener la fuente de datos.

- **Gestión de Stands — KPIs y contadores.** El diseño muestra 4 tarjetas de KPI. No hay endpoint de conteos agregados; hoy solo se conoce `pagination.total` de `/api/stands` (paginado). Falta un endpoint de resumen (p. ej. `GET /api/stands/resumen` con conteos por estado, documentos e imágenes).
- **Gestión de Stands — filtro por Pabellón.** El modelo de stand no expone `pabellon` como campo consultable ni parámetro de filtro. Falta campo en el entity/DTO y soporte de filtro en el listado.
- **Gestión de Stands — tabs por estado.** No existe parámetro de estado en el listado de stands. Falta `estado` como query param en `/api/stands` (o en el resumen).
- **Vinculación de Stands — KPIs.** Mismo caso que Gestión: sin endpoint de conteos para el paso 1 (API) ni el paso 2 (bloques/BD).
- **Vinculación de Stands — visor CAD y leyenda de geometrías.** No existe fuente de geometría (visor CAD) ni metadatos de leyenda de estados por bloque.
- **Vinculación de Stands — "Ejecutar Coincidencia Rápida".** El flujo de coincidencia automática no existe; el paso 2 hoy vincula manualmente por tabla (combobox por bloque).
