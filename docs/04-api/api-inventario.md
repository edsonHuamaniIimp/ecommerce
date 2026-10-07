# API â€” Inventario Real de Endpoints â€” ContratosStands

> **Estado:** v1.0 â€” 2026-09-11
> **Fuente:** CÃ³digo real (`src/app/api/**/route.ts`, `src/controllers/`, `src/middleware.ts`).
> **Nota:** `docs/04-api/endpoints.md` describe el contrato **propuesto/diseÃ±ado**; este documento
> es el **inventario real implementado**. Ante discrepancias, prevalece el cÃ³digo.

---

## 1. Arquitectura de la capa API

- **Route Handlers delgados** en `src/app/api/**/route.ts`. La mayorÃ­a son catch-all
  (`[...slug]`) que delegan en `createRouter()` (`src/lib/server/router.ts`): une los
  segmentos del slug con `/` y despacha a la acciÃ³n con ese nombre. AcciÃ³n inexistente â†’ 404.
- **Toda la lÃ³gica vive en** `src/controllers/*.controller.ts` y `src/lib/server/services.ts`
  (contenedor de inyecciÃ³n de dependencias).
- **No existen Server Actions** (`"use server"`): todas las mutaciones pasan por route handlers.
- **ValidaciÃ³n** con Zod en `src/validators/*.validator.ts`.
- **Respuestas de error** uniformes vÃ­a `src/lib/server/api-response.ts`.

---

## 2. Middleware (`src/middleware.ts`)

- **Matcher:** todas las rutas excepto `_next/static`, `_next/image`, `favicon.ico`, `sitemap.xml`, `robots.txt`.
- **Rutas pÃºblicas:** `/`, `/auth/login`, `/presala`, `/mapa`, `/403`; prefijos `/api/auth/`, `/api/maestra/`;
  rutas exactas `/api/maestra`, `/api/exhibidoras`, `/api/stands/exhibidora`, `/api/stands/contrato`,
  `/api/planos/publico`, `/api/eventos/modal-info`; caso especial `GET /api/eventos/listar?presala=1`.
- **AutenticaciÃ³n:** extrae el token JWT de la cookie `token` y lo verifica con `verifyToken`.
  Sin token o invÃ¡lido â†’ redirect a `/auth/login?returnTo=<ruta>`.
- **AutorizaciÃ³n:** valida el permiso declarado por prefijo con `hasPermission`; si falta â†’ `/403`.
  Permisos: `stands:vinculacion`, `solicitudes:view`, `facturacion:view`, `laboratorio:view`,
  `roles:manage`, `events:manage`, `auspicios:view`, `read:reservas`, `stands:plano`,
  `stands:manage`, `eventos:datos`, `pagos:view` (prefijo `/api/pagos` y `/dashboard/mis-pagos`).
- **Contexto de evento:** roles `admin` omiten el chequeo; usuarios sin `eventoId` en el JWT
  son redirigidos a `/presala`.
- **Cookie:** `token` httpOnly, SameSite=Lax, 24 h (gestionada en `auth.controller.ts`).

---

## 3. Inventario de endpoints por dominio

### 3.1 Auth â€” `src/app/api/auth/[...slug]/route.ts`

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/auth/session` | GET | SesiÃ³n actual del usuario |
| `/api/auth/perfil` | GET | Perfil del usuario autenticado |
| `/api/auth/perfil` | PATCH | Actualiza datos del perfil |
| `/api/auth/login` | POST | Login; emite JWT en cookie httpOnly |
| `/api/auth/registro` | POST | Inicia el registro de exhibidor: guarda datos temporales (password hasheada) y envia un codigo de verificacion al correo |
| `/api/auth/registro/confirmar` | POST | Confirma el registro con el codigo; crea la cuenta (rol cliente) con auto-login y emite JWT en cookie httpOnly |
| `/api/auth/logout` | POST | Cierra sesiÃ³n y limpia la cookie |
| `/api/auth/seleccionar-evento` | POST | Fija evento activo y reemite token con `eventoId`/`tipoEvento`/`codigoEvento` |
| `/api/auth/reset-password` | POST | Solicita restablecimiento de contraseÃ±a |
| `/api/auth/reset-password/confirm` | POST | Confirma el reset con token |
| `/api/auth/cambiar-password` | POST | Cambia la contraseÃ±a temporal (primer ingreso) y reemite la sesiÃ³n |
| `/api/auth/idioma` | PATCH | Guarda el idioma preferido (`es` \| `en`) y sincroniza la cookie `iimp_idioma` |

### 3.2 Solicitudes â€” `src/app/api/solicitudes/[...slug]/route.ts`

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/solicitudes/listar` | GET | Lista paginada con filtros `eventoId`, `page`, `search`, `userId` |
| `/api/solicitudes/detalle` | GET | Detalle de solicitud por `id` |
| `/api/solicitudes/historial` | GET | Historial de revisiones y cambios de estado |
| `/api/solicitudes/revisar` | POST | Registra revisiÃ³n por Ã¡rea del pipeline local: `asociado` o `legal` (RF-14/15) (aprobado/rechazado + comentario) |
| `/api/solicitudes/notificar` | POST | EnvÃ­a correo con resultado de revisiones (requiere `solicitudes:notify`) |
| `/api/solicitudes/modificar` | POST | Reabre solicitud finalizada reseteando revisiones a pendiente |
| `/api/solicitudes/reevaluar` | POST | Crea solicitud de re-evaluaciÃ³n |
| `/api/solicitudes/atender-reevaluacion` | POST | Aprueba o rechaza una re-evaluaciÃ³n |
| `/api/solicitudes/baja` | POST | Da de baja la solicitud |
| `/api/solicitudes/orden-pago` | POST | Marca la solicitud con orden de pago generada |
| `/api/solicitudes/upload-doc` | POST | Asocia documento subido a la solicitud (contrato, firmado o anexo con `requisito` RF-13) |
| `/api/solicitudes/recorte-plano` | POST | Guarda la URL de la imagen (PNG) del recorte del pabellÃ³n de la solicitud (RF-08, para el contrato) |
| `/api/contratos/borrador` | POST | **Borrador del contrato** (paso Contrato del wizard): genera DOCX/PDF con los `standIds` seleccionados y las cuotas configuradas **sin crear la solicitud** (montos calculados en el servidor) |
| `/api/contratos/firmar-borrador` | POST | **Firma digital del borrador** (RF-12): estampa la firma del perfil sobre el borrador; 409 si el perfil no tiene firma. Tampoco crea la solicitud |
| `/api/contratos/generar` | POST | Genera el **contrato definitivo** de la solicitud (DOCX/PDF) desde la plantilla etiquetada del idioma (`idioma` opcional `es`/`en`; si falta se resuelve el del cliente) con empresa, stands, IGV 18% y el plan de cuotas (**1â€“3**, `{ porcentaje, fechaVencimiento }`; fechas no pasadas y ascendentes); las imÃ¡genes del Anexo 1 (recortes por pabellÃ³n con versiÃ³n/fecha) se generan en el servidor y el contrato se adjunta de forma idempotente (RF-10/11). Se llama al **confirmar la reserva** (paso 4) |
| `/api/contratos/firmar` | POST | **Firma digital (RF-12)**: estampa la firma del perfil del usuario (`user_role.firma_url`) en el contrato generado y devuelve el contrato firmado (DOCX/PDF); equivale a subir el contrato firmado. 409 si el perfil no tiene firma |
| `/api/solicitudes/eliminar-doc` | POST | Elimina documento de la solicitud |

### 3.3 Eventos â€” `src/app/api/eventos/[...slug]/route.ts`

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/eventos/listar` | GET | Lista eventos; `?presala=1` (pÃºblico) y `?id=` devuelve uno |
| `/api/eventos/crear` | POST | Crea evento |
| `/api/eventos/actualizar` | PATCH | Actualiza evento (incluye `modal_info` por versiÃ³n) |
| `/api/eventos/modal-info` | GET | Modal informativo de `/mapa` por versiÃ³n; pÃºblico. `?tipoEvento=&codigoEvento=` |

### 3.4 GESS â€” `src/app/api/gess/[...slug]/route.ts`

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/gess/listar` | GET | Lista stands GESS por `eventoId` (paginado) o `bloqueId`. Completa `empresa`, `empresaLogo` (RF-09) y `tipoImagen` (imagen referencial del tipo, RF-08) |
| `/api/gess/tipos-imagen` | GET | CatÃ¡logo de imÃ¡genes referenciales por tipo de stand (admin) |
| `/api/gess/tipos-imagen` | POST | Sube/reemplaza la imagen de un tipo (aplica a todos los stands de ese tipo) |
| `/api/gess/tipos-imagen` | DELETE | Quita la imagen referencial de un tipo |
| `/api/gess/sync` | POST | Sincroniza stands seleccionados desde GESS |
| `/api/gess/mockup` | POST | Genera mockup/datos de stands para un evento |
| `/api/gess/pre-reservar` | POST | Pre-reserva en lote (hasta 500): bloquea stands `disponible` con una empresa (SIE/RUC/razÃ³n social) **o** un tÃ­tulo libre + nota; todo o nada (409) |
| `/api/gess/liberar` | POST | Libera pre-reservas en lote: solo `pre_reservado` â†’ `disponible` (limpia empresa/tÃ­tulo/snapshot); todo o nada (409) |
| `/api/gess/pre-reserva` | PATCH | Edita empresa/tÃ­tulo/logo/nota de una pre-reserva vigente (`pre_reservado`; 404/409) |
| `/api/gess/actualizar` | PATCH | Actualiza datos de un stand GESS |

### 3.5 Planos / Laboratorio â€” `src/app/api/planos/[...slug]/route.ts` y `planos/publico`

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/planos/listar` | GET | Lista todos los planos |
| `/api/planos/tipos-sugeridos` | GET | Tipos de bloque existentes en otros planos, para reutilizarlos en el editor |
| `/api/planos/detalle` | GET | Detalle por `id` o `codigo` |
| `/api/planos/planos-evento` | GET | Planos asociados a `tipoEvento`/`codigoEvento` |
| `/api/planos/macros-de-plano` | GET | Macros que contienen un `planoId` |
| `/api/planos/exportar` | GET | Exporta el plano (JSON) |
| `/api/planos/exportar-ts` | GET | Exporta el plano como TypeScript |
| `/api/planos/ocupacion` | GET | OcupaciÃ³n de un plano en un evento |
| `/api/planos/crear` | POST | Crea plano (requiere `laboratorio:manage`) |
| `/api/planos/guardar-layout` | POST | Guarda tipos, bloques y furniture del plano |
| `/api/planos/guardar-secciones` | POST | Guarda secciones de un plano macro |
| `/api/planos/asignar-macro` | POST | Asigna un plano a un macro |
| `/api/planos/quitar-macro` | POST | Quita un plano de todos los macros |
| `/api/planos/eliminar` | POST | Elimina plano |
| `/api/planos/importar` | POST | Importa plano |
| `/api/planos/actualizar-meta` | PATCH | Actualiza metadatos del plano |
| `/api/planos/publico` | GET | Vista pÃºblica de plano por `codigo` o `tipoEvento`/`codigoEvento` (sin auth) |

### 3.6 Planogess â€” `src/app/api/planogess/[...slug]/route.ts`

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/planogess/fetch` | POST | Lista los stands de un evento desde el **API real del IIMP** (`/auth/login` + `/stands/liststand`, cuenta tÃ©cnica con acceso VTA); devuelve filas aplanadas (stand, pabellÃ³n, tipo, Ã¡rea, precio, estado) para el preview de VinculaciÃ³n |

### 3.7 Maestra â€” `src/app/api/maestra/[...slug]/route.ts`

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/maestra/listar` | GET | Lista Ã­tems hijo activos de una `tabla` maestra (pÃºblico) |

### 3.8 Entidades â€” `src/app/api/entidades/*`

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/entidades/persona` | POST | Busca personas por `documento` o `nombre` (cliente externo) |
| `/api/entidades/empresa` | POST | Busca empresas por `nroDocument` o `razonSocial` |

### 3.9 Consultas externas (SUNAT/RENIEC)

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/sunat/ruc` | GET | Consulta RUC (valida 11 dÃ­gitos) vÃ­a cliente externo |
| `/api/reniec/dni` | GET | Consulta DNI (valida 8 dÃ­gitos) vÃ­a cliente externo |

### 3.10 Upload â€” `src/app/api/upload/route.ts`

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/upload` | POST | Sube archivo (multipart `file`) al storage y devuelve `url`/`filename` |

### 3.11 Alertas â€” `src/app/api/alertas/[...slug]/route.ts`

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/alertas/listar` | GET | Lista alertas del usuario; `?no_leidas=1` solo no leÃ­das |
| `/api/alertas/marcar-leida` | POST | Marca una alerta como leÃ­da |
| `/api/alertas/marcar-todas-leidas` | POST | Marca todas las alertas del usuario como leÃ­das |

### 3.12 Auspicios â€” `src/app/api/auspicios/*`

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/auspicios/listar` | POST | Proxy autenticado a KBServicios `/rest/listauspicio` |
| `/api/auspicios/grabar` | POST | Proxy autenticado a KBServicios `/rest/saveauspicio` |

### 3.13 Stands / IntegraciÃ³n M2M

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/stands/contrato` | GET | Lista contratos de stands por `tipoEvento`/`codigoEvento` (API key M2M) |
| `/api/stands/exhibidora` | GET | Stands de una exhibidora. Requiere `empresaId`, `tipoEvento` y `codigoEvento` (400 si faltan). Devuelve `estado` comercial, `estado_solicitud`, `pabellon` (secciÃ³n del macro), `zona`, `x`, `y`, `mapa`. (API key M2M) |
| `/api/exhibidoras` | GET | Lista exhibidoras con bÃºsqueda `q` (API key M2M) |
| `/api/stands/asignar-montajista` | POST | Asigna/reemplaza/desasigna la empresa montajista de un stand (M2M `x-api-key` o sesiÃ³n con `stands:manage`). Audita en `stand_montajista_historial` |
| `/api/empresas-montajistas` | GET | CatÃ¡logo de montajistas (`q` = RUC o razÃ³n social; sin `q`, las ya asignadas). Misma auth que el anterior |

> Detalle del contrato de integraciÃ³n con el Sistema de Montaje: `docs/05-integraciones/api-sistema-montaje.md`.

### 3.14 FacturaciÃ³n â€” `src/app/api/facturacion/[...slug]/route.ts` + `niubizz/*`

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/facturacion/listar` | GET | Lista facturaciones paginadas por `eventoId` |
| `/api/facturacion/detalle` | GET | Detalle de facturaciÃ³n con cuotas |
| `/api/facturacion/agregar-cuota` | POST | Agrega cuota con monto y vencimiento |
| `/api/facturacion/pagar-cuota` | POST | Marca cuota como pagada (comprobante opcional) |
| `/api/facturacion/adjuntar-comprobante` | POST | Adjunta el comprobante fiscal (boleta/factura) de una cuota pagada y notifica al cliente |
| `/api/facturacion/eliminar-cuota` | POST | Elimina cuota |
| `/api/facturacion/actualizar` | PATCH | Actualiza datos de la facturaciÃ³n |
| `/api/facturacion/eliminar` | DELETE | Elimina facturaciÃ³n |
| `/api/facturacion/niubizz/sesion` | POST | Crea sesiÃ³n de pago Niubizz (**deshabilitado, 503**) |
| `/api/facturacion/niubizz/confirmar` | POST | Confirma pago Niubizz (**deshabilitado, 503**) |

### 3.14b Pagos del exhibidor â€” `src/app/api/pagos/[...slug]/route.ts`

Vista del cliente (`pagos:view`); cada acciÃ³n valida propiedad de la facturaciÃ³n. Escrituras requieren `pagos:manage`.

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/pagos/listar` | GET | Facturaciones del cliente (paginadas) con sus cuotas |
| `/api/pagos/detalle` | GET | Detalle de una facturaciÃ³n propia (404/403 si no aplica) |
| `/api/pagos/agregar-cuota` | POST | Agrega cuota (`facturacionId`, `monto`, `fechaVencimiento?`) |
| `/api/pagos/actualizar-cuota` | POST | Edita monto/vencimiento (`cuotaId`) |
| `/api/pagos/adjuntar-voucher` | POST | Adjunta/reemplaza el voucher (`cuotaId`, `comprobante`) sin cambiar estado |
| `/api/pagos/eliminar-cuota` | POST | Elimina cuota y renumera las restantes |
| `/api/pagos/solicitar-factura` | POST | Registra la reserva en el IIMP y emite la factura de la 1ra cuota (`cuotaId`); 409 si ya existe contrato IIMP |

### 3.15 Reservas â€” `src/app/api/reservas/[...slug]/route.ts`

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/reservas/crear` | POST | Crea reserva de stands; 409 si alguno ya estÃ¡ reservado |

### 3.16 Roles â€” `src/app/api/roles/[...slug]/route.ts`

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/roles/listar` | GET | Lista roles |
| `/api/roles/crear` | POST | Crea rol con permisos |
| `/api/roles/add-user` | POST | Asigna rol a usuario por email |
| `/api/roles/update-permisos` | PATCH | Actualiza permisos de un rol |
| `/api/roles/remove-user` | DELETE | Quita rol a usuario |

### 3.17 KBServicios â€” `src/app/api/kbservicios/[...slug]/route.ts`

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/kbservicios/events` | POST | Lista eventos desde KBServicios (`code`, default 14) |
| `/api/kbservicios/event-types` | POST | Lista tipos de evento desde KBServicios |

### 3.18 Observabilidad

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/errors/log` | POST | Registra un error (message/stack/digest/url/metadata) con userId si hay sesiÃ³n |

### 3.19 Empresas (Portal del Cliente) - `src/app/api/empresas/[...slug]/route.ts`

Bandeja y mantenimiento de empresas registradas por el backoffice. Lectura con `empresas:view`
y escritura con `empresas:manage` (el admin `admin:full` siempre accede).

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/empresas/listar` | GET | Bandeja paginada (`page`, `perPage`, `search` por razÃ³n social/RUC, `estado`) |
| `/api/empresas/detalle` | GET | Detalle de una empresa (`id`) |
| `/api/empresas/crear` | POST | Alta individual: valida RUC (11 dÃ­gitos), correos, comprobante y duplicados (409) |
| `/api/empresas/actualizar` | POST | EdiciÃ³n parcial (`id` + campos enviados) |
| `/api/empresas/estado` | POST | Activa/desactiva (`id`, `estado`: `activa` \| `inactiva`) |
| `/api/empresas/carga-masiva/previsualizar` | POST | Sube Excel/CSV (`multipart`, campo `archivo`) y valida por fila: RUC/correos/comprobante, duplicados (archivo y BD), datos contractuales faltantes |
| `/api/empresas/carga-masiva/importar` | POST | Importa las filas vÃ¡lidas (`{ filas }`); las filas con error se omiten. MÃ¡x. 500 filas / 5 MB |
| `/api/empresas/crear-cuenta` | POST | Crea la cuenta del Portal (`id`): usuario + contraseÃ±a temporal, rol cliente, vÃ­nculo `empresa_id`; envÃ­a credenciales por correo y exige cambio en el primer ingreso |
| `/api/empresas/reenviar-credenciales` | POST | Regenera la contraseÃ±a temporal y reenvÃ­a las credenciales (`id`) |
| `/api/empresas/fuente` | GET | Busca empresas en **servicio-persona** (fuente) por razon social o RUC (`q`); requiere `empresas:manage` |
| `/api/empresas/registrar-cuenta-empresa` | POST | Asegura empresa y persona en **servicio-persona** (crea si no existen) y crea la cuenta local con `sie_code`/`id_empresa` + ficha local minima por RUC |

### 3.20 Portal del Cliente (empresa propia) - `src/app/api/portal/empresa/[...slug]/route.ts`

Endpoints para la empresa vinculada al usuario autenticado (sin permiso especial; sesiÃ³n propia).
El middleware exige cambiar contraseÃ±a/validar datos cuando la credencial es temporal
(`debeCambiarPassword`).

| Ruta | MÃ©todos | DescripciÃ³n |
|---|---|---|
| `/api/auth/cambiar-password` | POST | Cambio de la contraseÃ±a temporal (valida actual, longitud mÃ­nima); reemite la sesiÃ³n sin el flag |
| `/api/portal/empresa/mis-datos` | GET | Datos de la empresa vinculada al usuario (primer ingreso / Mi empresa) |
| `/api/portal/empresa/validar` | POST | Valida/actualiza los datos contractuales y marca `primerAccesoCompletado` |

---

## 4. Convenciones de la API

- **Base path:** `/api`.
- **Formato:** JSON (excepto descargas de archivos).
- **ValidaciÃ³n:** Zod en backend; errores â†’ `422` con cuerpo `ApiError`.
- **Auth:** cookie JWT httpOnly (navegador) o API key M2M (integraciones servidor-a-servidor).
- **Errores:** cuerpo uniforme `{ error, code, detalles[] }`.
- **Idempotencia:** operaciones de interoperabilidad deben ser idempotentes y reconciliables.

---

## 5. Pendientes de la capa API

1. **Contrato de interoperabilidad real** con el sistema de John (request/response, auth, X/Y).
2. **Sincronizar `docs/04-api/openapi.yaml`** con este inventario real.
3. **Endurecer permisos** del middleware por endpoint (hoy por prefijo).
4. **Documentar payloads** de cada endpoint con ejemplos (parcialmente en `openapi.yaml`).

### 5.1 Gaps funcionales: diseÃ±o Stitch (GestiÃ³n de Stands / VinculaciÃ³n de Stands)

Elementos del diseÃ±o que dependen de endpoints o parÃ¡metros que aÃºn no existen. No implementar en UI hasta tener la fuente de datos.

- **GestiÃ³n de Stands â€” KPIs y contadores.** El diseÃ±o muestra 4 tarjetas de KPI. No hay endpoint de conteos agregados; hoy solo se conoce `pagination.total` de `/api/stands` (paginado). Falta un endpoint de resumen (p. ej. `GET /api/stands/resumen` con conteos por estado, documentos e imÃ¡genes).
- **GestiÃ³n de Stands â€” filtro por PabellÃ³n.** El modelo de stand no expone `pabellon` como campo consultable ni parÃ¡metro de filtro. Falta campo en el entity/DTO y soporte de filtro en el listado.
- **GestiÃ³n de Stands â€” tabs por estado.** No existe parÃ¡metro de estado en el listado de stands. Falta `estado` como query param en `/api/stands` (o en el resumen).
- **VinculaciÃ³n de Stands â€” KPIs.** Mismo caso que GestiÃ³n: sin endpoint de conteos para el paso 1 (API) ni el paso 2 (bloques/BD).
- **VinculaciÃ³n de Stands â€” visor CAD y leyenda de geometrÃ­as.** No existe fuente de geometrÃ­a (visor CAD) ni metadatos de leyenda de estados por bloque.
- **VinculaciÃ³n de Stands â€” "Ejecutar Coincidencia RÃ¡pida".** El flujo de coincidencia automÃ¡tica no existe; el paso 2 hoy vincula manualmente por tabla (combobox por bloque).
