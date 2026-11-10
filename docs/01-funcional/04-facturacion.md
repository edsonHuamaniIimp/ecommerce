# Facturación y documentos

> Fuente: `src/app/(dashboard)/dashboard/facturacion/**`,
> `src/app/(dashboard)/dashboard/mis-pagos/**`, `src/app/api/facturacion/**`,
> `src/app/api/pagos/**`, `src/application/facturacion/**`,
> `src/application/facturacion-iimp/**`, `src/application/pagos/**`,
> `src/infrastructure/persistence/facturacion-repository.ts`.
>
> Integraciones: [`api-facturacion-entrante.md`](../05-integraciones/api-facturacion-entrante.md)
> (API del sistema de facturación hacia ContratosStands) y
> [`integracion-reserva-iimp.md`](../05-integraciones/integracion-reserva-iimp.md)
> (reserva y archivos de la cuenta corriente).

## 1. Propósito y alcance

Gestionar la **facturación de las solicitudes de stands**: requisitos del cliente,
solicitud de factura, documentos por cuota, emisión de facturas por el sistema de
facturación externo, su visualización/descarga y el seguimiento del estado de las cuotas.

**Los pagos no se gestionan en esta vista.** El cobro y la confirmación de pagos los
gestiona el área de Facturación y Cobranzas del IIMP (sistema externo); ContratosStands
solo refleja el estado que le notifican. Los documentos y vouchers que adjunta el cliente
son **referenciales**.

## 2. Roles y permisos

- **Facturación / Admin**: bandeja `/dashboard/facturacion` (`facturacion:view` o
  `admin:full`): listado, expediente, archivar, cambiar tipo y dar de baja.
- **Exhibidor (cliente)**: `/dashboard/mis-pagos` ("Mis documentos") con `pagos:view`
  y `pagos:manage`; toda operación valida que la cuota sea de una solicitud propia.
- **Niubiz deshabilitado**: `NIUBIZ_HABILITADO = false`; las rutas de pasarela responden 503.

## 3. Pantallas

| Ruta | Uso |
|---|---|
| `/dashboard/mis-pagos` | Cliente: documentos de sus solicitudes (cuotas, requisitos, facturas, constancias) |
| `/dashboard/facturacion` | Facturación: bandeja de solicitudes, indicadores y expediente |
| `/dashboard/configuracion` | Admin: contacto de facturación (varios correos y teléfonos) y configuración del portal |
| `/dashboard/facturacion/pago*` | Pasarela Niubiz (**deshabilitada**) |

## 4. Vista del cliente — "Mis documentos"

### 4.1 Requisitos de facturación (un solo modal)

Al pulsar el ícono de **solicitar factura** de una cuota se abre un único modal:

1. **Checklist de requisitos** de la empresa (marcar los que apliquen):
   - Orden de compra (OC).
   - Hoja de entrada de servicio (HES).
   - Registro en plataforma o portal de proveedores → **obligatorios** el nombre y el
     enlace (`http://` o `https://`); se resaltan en ámbar si faltan.
   - Valorización o cotización aprobada.
   - Otros requisitos → **obligatorio** especificar el texto.
   - **Ninguna de las anteriores** (empresa extranjera o sin OC/HES).
   - Marcar cualquier requisito desmarca "Ninguna"; marcar "Ninguna" limpia el resto.
2. **Documentos a adjuntar** (por cada tipo declarado):
   - Se habilita una sección de carga por tipo (OC, HES, valorización, otros requisitos).
   - Es **obligatorio al menos un documento por tipo declarado** (badge "Obligatorio",
     borde ámbar y aviso de faltantes); se pueden adjuntar varios y quitarlos.
   - La **cuota es la de la bandeja** (no se elige); cada archivo se registra en la
     cuenta corriente del IIMP con ese número de cuota.
3. **Enviar solicitud de factura**: valida requisitos y documentos y llama a
   `POST /api/pagos/solicitar-factura` con `{cuotaId, archivos, requisitos}`.

Efecto: se registra la **reserva** en el IIMP (contrato y cuenta corriente) y la
declaración de requisitos en `solicitud.requisitos_facturacion` (con la cuota de
origen). **No se emite la factura en ese momento**: el sistema de facturación emite la
factura de cada cuota en su fecha.

### 4.2 Documentos para tu factura (panel por cuota)

Con la reserva registrada, el ícono de documentos abre el panel de la **cuenta corriente**
del IIMP asociada a la cuota. El ícono aparece **solo cuando la cuota ya tiene factura
emitida** (SIE/IIMP); mientras la factura no llega, la cuota muestra el ícono de factura
en estado pendiente y no solicita documentos adicionales. Así el cliente no confunde la
declaración inicial de requisitos con una carga documental posterior:

- Tipos disponibles (v6): `OC`, `HES`, `DETRACCION`, `DIFERENCIA`, `PAGO_TOTAL`,
  `VALORIZACION_COTIZACION` y `OTROS_REQUISITOS`.
- Los tipos se filtran según los **requisitos declarados** de la solicitud.
- Si un tipo (OC/HES/valorización/otros) **ya tiene un archivo en esa cuota**, deja de
  ofrecerse en el selector; la bandeja lo sigue mostrando agrupado por cuota.
- Al seleccionar o soltar un archivo se pide confirmación y se sube **directo a la
  bandeja**; también se puede pegar un enlace.
- Las constancias de pago son **referenciales**: Facturación valida los pagos por los
  canales formales.

### 4.3 Seguimiento por cuota

Cada cuota muestra:

- **Fecha de emisión**: la real notificada por el sistema de facturación (o emitida por
  el IIMP) y, si no existe, la programada del plan.
- Estado de la cuota: pendiente / pagado.
- **Siguiente cuota**: se resalta la primera cuota no pagada cuando falta ≤
  `DIAS_ANTICIPACION_CUOTA` (15 días) para su fecha de emisión programada
  ("se emite en N días", "se emite hoy" o "fecha de emisión pasada"); si la factura ya
  se emitió, muestra "Factura emitida · pendiente de pago".
- **Solicitud de factura pendiente**: si la reserva aún no se registró en el IIMP, se
  resalta la cuota sugerida ("Solicitar factura aquí").
- **Factura en proceso**: con la solicitud enviada y ninguna cuota facturada, se muestra
  el aviso "Solicitud de factura enviada · tu factura está en proceso de emisión".

### 4.4 Facturas

- Visualización y descarga mediante el proxy `GET /api/pagos/factura?cuotaId=`
  (`&inline=1` para abrir en el navegador; sin `inline` descarga).
- El proxy valida sesión y propiedad (Facturación/Admin pueden descargar cualquiera),
  entrega solo PDF (firma `%PDF-`), aplica cabeceras seguras y devuelve **409** si la
  factura fue anulada.
- La URL del PDF se construye con `FACTURAS_PDF_URL_TEMPLATE` y `FACTURAS_EMISOR_RUC`
  (bucket público del ecosistema IIMP).
- Cuando el SIE notifica una factura nueva (o cambia su fecha de emisión), se envía al
  cliente la plantilla `facturacion-factura-disponible` (no se repite en reintentos ni en
  anulaciones).

### 4.5 Contacto de facturación

Botón **"Contacto"** en Mis documentos: modal con los correos (`mailto:`) y teléfonos
(`tel:`) configurados en `/dashboard/configuracion` (varios por lista, máximo 5 de cada
uno; validación y deduplicado al guardar).

## 5. Bandeja de Facturación — `/dashboard/facturacion`

### 5.1 Indicadores (cards clickeables)

| Card | Definición |
|---|---|
| **Total** | Todas las facturaciones activas |
| **Sin solicitud de factura** | La reserva aún no se registró en el IIMP (el cliente no envió su solicitud) |
| **Solicitudes enviadas sin factura** | Reserva registrada, pero ninguna cuota tiene documento de factura |
| **Facturas generadas** | Al menos una cuota tiene documento de factura |
| **Facturas anuladas** | Alguna cuota tiene un documento anulado/rechazado vigente como anulación |

No se muestran indicadores ni acciones de **pago**: el cobro lo gestiona Contabilidad.
El estado de la facturación se muestra como **"En proceso"** / **"Completado"**.

### 5.2 Filtros

- Búsqueda por stand, correo, RUC (snapshot y cuentas) o contrato IIMP.
- **Requerimiento**: todos / sin solicitud de factura / solicitud enviada sin factura /
  con factura generada / sin factura / factura anulada (backend:
  `REQUERIMIENTOS_FACTURACION`).
- Tipo: manual / Niubizz (`NIUBIZ_HABILITADO`).

### 5.3 Columnas y progreso

- **Cuotas**: chips numerados por cuota (verde = pagada, azul = facturada, gris =
  pendiente de facturar) y resumen "X/N facturadas · Y/N pagadas".
- Con el filtro **Con factura generada**, la tabla muestra **una fila por cuota
  facturada** (datos de la solicitud con `rowSpan`) y la columna **"Emisión de
  factura"** con la fecha real de emisión (o "—" si no fue notificada; no se usa la
  programada).
- **Fecha de solicitud**: fecha de creación de la facturación.

### 5.4 Expediente (ojito)

Modal por objetivo, con tabs:

- **Cuotas y documentos**: contrato IIMP, cuenta corriente, total y una tarjeta por
  cuota con estado, fecha de emisión, factura IIMP/SIE y documentos del cliente
  (archivos de cuenta corriente, voucher y comprobante fiscal) con vista previa,
  apertura en pestaña y descarga.
- **Contacto y facturación**: snapshot de facturación de la reserva, representante
  legal, responsable de pagos y coordinación EXTEMIN.
- **Empresa**: ficha completa.
- **Solicitud y anexos**: datos de la solicitud, **checklist de requisitos tal como lo
  respondió el cliente** (marcados y no marcados, con cuota de origen, plataforma y
  otros), contrato firmado (SGC) y documentos de la solicitud.

### 5.5 Acciones

- Ver detalle (expediente), archivar (facturación completada), cambiar tipo de pago y
  eliminar (baja lógica). No hay registro manual de pagos en la bandeja.

### 5.6 Notificar recordatorios

Botón **Notificar** en la cabecera de la bandeja; abre un modal con dos listas que se
verifican contra el IIMP al abrir y al enviar:

- **Sin solicitud de factura**: facturaciones en proceso (`pendiente`) con cuotas sin pagar
  cuya solicitud aún no tiene contrato ni cuenta corriente del IIMP (no se envió la primera
  solicitud desde Mis documentos). No se listan empresas sin cuotas pendientes.
- **Documentos pendientes**: solicitudes registradas (contrato + cuenta corriente) que
  declararon requisitos (OC, HES, valorización, otros) y no tienen registrado el documento
  del tipo declarado en la cuenta corriente. Aplica la misma regla que el aviso de Mis
  documentos: cubre el documento global (`cuota = null`) o el de la cuota de origen de la
  declaración (`requisitos.cuota`, por defecto 1).
- Empresas sin correo de facturación se muestran deshabilitadas (no se envían).
- Las cuentas que no responden en el IIMP no se listan (`noVerificados`) para evitar avisos
  incorrectos.
- Selección individual o "seleccionar todas"; el envío revalida la lista y registra cada
  correo en `facturacion_historial` (`notificar_recordatorio`).
- Los correos incluyen el enlace a Mis documentos y al **manual del cliente**
  (`/manual/facturacion`).

Endpoints internos: `GET /api/facturacion/recordatorios` y
`POST /api/facturacion/recordatorios/enviar` (requieren `facturacion:view` o admin).

## 6. Estados y transiciones

| Entidad | Estados |
|---|---|
| **Facturación** | `pendiente` → `pagado` (cuando todas las cuotas están pagadas) → `archivado` (manual). `cancelado` declarado sin uso |
| **Cuota** | `pendiente` → `pagado` (notificación `estadoPago: 0` o corrección autorizada); `vencido` declarado sin transición |
| **Solicitud** | `pendiente_pago` → `pagado` (al cerrarse la facturación) |
| **Documento de factura** | Vigente / anulado (se limpia al recibir `estadoPago: 2`) |

La facturación y la solicitud se cierran **solo** cuando no quedan cuotas pendientes.

## 7. Integración con el sistema de facturación (API entrante)

`POST /api/integracion/factura` (M2M, header `x-api-key`, ver guía técnica):

- `estadoPago: 0` → registra documento y **marca la cuota pagada**; si no quedan
  pendientes, cierra facturación y solicitud.
- `estadoPago: 1` → registra el documento (y `fechaEmision` si viene); **no cambia el
  estado de la cuota**.
- `estadoPago: 2` → anulación/rechazo: limpia el documento de la cuota; **no revierte el
  estado de pago**. Requiere `justificacion` (máx. 500) y genera alerta a Facturación.
- `fechaEmision` (opcional, `YYYY-MM-DD`, no futura): fecha real de emisión; se guarda en
  la cuota y se muestra en Mis documentos y en la bandeja.
- Reemisión: se envía el nuevo documento (reemplaza al anterior; sin `Idempotency-Key`).

**Caso excepcional (documentado)**: si una cuota quedó pagada por un `0` y luego el
documento se anula (`2`) y se reemite (`1`), la cuota sigue pagada porque `2` no revierte
el pago y `1` no cambia el estado. La corrección se hace de forma **manual y autorizada**
(`UPDATE` de `estado` a `pendiente` + registro en `facturacion_historial` con autor).
Alternativa a evaluar: revertir el estado al recibir `2` (pendiente de decisión).

## 8. Correos

- Plantilla `revision-resultado`: al aprobarse la solicitud, el correo incluye el paso a
  paso para enviar la solicitud de factura (CTA a "Mis documentos").
- Plantilla `facturacion-recordatorio-solicitud`: recordatorio a empresas con pagos
  pendientes que aún no enviaron su solicitud de factura (CTA a Mis documentos + manual).
- Plantilla `facturacion-recordatorio-documentos`: recordatorio con la lista de documentos
  declarados pendientes (CTA a subir documentos + manual).
- Plantilla `facturacion-factura-disponible`: aviso al cliente cuando el SIE registra una
  factura nueva (CTA a Mis documentos + manual).
- Adjuntar comprobante fiscal de una cuota notifica al cliente.
- Los textos usan tildes correctas (revisión, áreas, ocasión, sección, documentación,
  reevaluación, automático).

## 9. Configuración del portal

`/dashboard/configuracion`:
- **Contacto de facturación**: listas dinámicas de correos y teléfonos (máx. 5 por lista),
  validación de formato y deduplicado. Se muestran en el botón "Contacto" de Mis documentos.
- Contactos generales, enlaces, parámetros de reserva y mantenimiento.

## 10. Reglas de negocio

- La suma de cuotas no puede superar `montoTotal`.
- La facturación de una reserva se registra **una sola vez**; la notificación es por cuota.
- Los requisitos y documentos del cliente son **referenciales**.
- `PAGO_TOTAL` es excluyente con `DETRACCION`/`DIFERENCIA` de una misma cuota.
- Eliminar una facturación es baja lógica (`flgActivo = false`).
- Historial en `facturacion_historial` (`agregar_cuota`, `pagar_cuota`, `actualizar`,
  `eliminar`, `eliminar_cuota`, `adjuntar_voucher`, `documento_iimp`).

## 11. Limitaciones conocidas

- `cancelado` (facturación) y `vencido` (cuota) declarados sin transición ni job.
- El monto de la reserva es heurístico (rawData/precio/medidas), no de un tarifario.
- Niubiz deshabilitado; sin pago en línea.
- La corrección de estados por anulaciones con pago previo es manual (ver §7).
