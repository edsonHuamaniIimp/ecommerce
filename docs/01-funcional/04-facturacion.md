# Facturación y pagos

> Fuente: `src/app/(dashboard)/dashboard/facturacion/**`,
> `src/app/api/facturacion/**`, `src/application/facturacion/**`,
> `src/infrastructure/persistence/facturacion-repository.ts`.

## 1. Propósito

Gestionar el cobro de las solicitudes de stands: listar registros de facturación, ver
detalle, administrar cuotas, registrar pagos con comprobante, archivar y dar de baja.
Persistencia local en PostgreSQL vía Prisma.

## 2. Roles y permisos

- **Admin**: permiso `facturacion:view` en `/dashboard/facturacion` y `/api/facturacion`
  (`middleware.ts`). No está asignado a ningún rol no-admin; hoy solo `admin` lo ejerce (por bypass).
- **Exhibidor (cliente)**: vista propia `/dashboard/mis-pagos` + API `/api/pagos`, con permisos
  `pagos:view` (ver el plan de cuotas) y `pagos:manage` (agregar/editar/eliminar cuotas). Ambas
  acciones validan además **propiedad**: la facturación debe pertenecer a una solicitud del
  `userId`/`email` de la sesión (`PagosApplicationService`).
- **Pasarela Niubiz deshabilitada**: `NIUBIZ_HABILITADO = false` (`constants.ts`). La UI oculta los
  botones de pago y `/api/facturacion/niubizz/*` responde **503** (`SERVICE_UNAVAILABLE`).

## 3. Pantallas

| Ruta | Uso |
|---|---|
| `/dashboard/facturacion` | Admin: listado + acciones (ver, archivar, configurar, eliminar, registrar pago) |
| `/dashboard/mis-pagos` | Cliente: sus planes de pago (cuotas); ver/configurar si `pagos:manage` |
| `/dashboard/facturacion/pago?facturacionId=` | Pago con pasarela Niubiz (**deshabilitado**) |
| `/dashboard/facturacion/pago/response?facturacionId=&transactionToken=` | Retorno de la pasarela (**deshabilitado**) |
| `/dashboard/facturacion/pago/error` | Cancelación/timeout |

## 4. Tipos y modos

- `TIPOS_FACTURACION` (`constants.ts:381-385`): `niubizz` (pasarela) | `manual`. Por defecto `manual`.
- `modoPago`: `completo` | `cuotas` (default `cuotas`).

## 5. Flujo funcional

### 5.1 Listado y administración
- `GET /api/facturacion/listar?eventoId=&page=&per_page=` (paginado de 10, incluye cuotas y estado de la solicitud).
- Acciones por fila: ver detalle, archivar (solo `pagado`), configurar/eliminar (si no `archivado`), pagar (si `pendiente`).
- `POST /api/facturacion/agregar-cuota` `{facturacionId, monto, fechaVencimiento?}`.
- `POST /api/facturacion/pagar-cuota` `{cuotaId, comprobante?}` → si no quedan cuotas pendientes, marca facturación `pagado` y la **solicitud** `pagado`.
- `POST /api/facturacion/eliminar-cuota` (borrado duro) · `PATCH /api/facturacion/actualizar` · `DELETE /api/facturacion/eliminar` (baja lógica).

### 5.2 Origen de los registros
No se crean desde la página: se crean al **generar la orden de pago** de una solicitud
(`solicitudes-repository.ts:378-400`), que pone la solicitud en `pendiente_pago` y crea
`Facturacion` tipo `manual`, moneda `US$`.

### 5.3 Pago con Niubiz — DESHABILITADO
`NIUBIZ_HABILITADO = false`. El código y las páginas se conservan para reactivar:
- El botón "Pagar ahora / Pagar con Niubizz" en Mis Solicitudes ya **no se muestra** (el helper
  `puedePagarNiubizz` incluye el flag).
- `/api/facturacion/niubizz/sesion` y `/confirmar` responden **503** (`SERVICE_UNAVAILABLE`).
- El tipo `niubizz` no se puede seleccionar en el modal de configuración de facturación (opción deshabilitada).

### 5.4 Pagos del exhibidor (cliente) — `/dashboard/mis-pagos`
- `GET /api/pagos/listar?page=&per_page=` → facturaciones **del cliente** (solicitud con su `userId`/`email`) del
  **evento activo** de la sesión y de **solicitudes vigentes** (`flgActivo`), igual que la bandeja; incluye cuotas.
- `GET /api/pagos/detalle?id=` → detalle (valida propiedad; 404/403 si no aplica).
- `POST /api/pagos/agregar-cuota` `{facturacionId, monto, fechaVencimiento?}` (requiere `pagos:manage`).
- `POST /api/pagos/actualizar-cuota` `{cuotaId, monto?, fechaVencimiento?}` (requiere `pagos:manage`).
- `POST /api/pagos/eliminar-cuota` `{cuotaId}` (requiere `pagos:manage`); al eliminar, las cuotas
  restantes se **renumeran** secuencialmente (1..n).
- `POST /api/pagos/adjuntar-voucher` `{cuotaId, comprobante}` (requiere `pagos:manage`): adjunta o
  reemplaza el **voucher de pago** de una cuota sin cambiar su estado. La vista muestra el enlace
  "Voucher" cuando existe.
- **Con voucher adjunto la cuota queda bloqueada**: no se puede editar ni eliminar (el backend
  responde **409** y la UI oculta los botones de configuración); queda "pendiente de confirmacion"
  hasta que el admin registre el pago.
- El cliente **no** registra pagos ni archiva/elimina facturaciones: eso queda en el flujo admin.

## 6. Estados

- `ESTADOS_FACTURACION`: `pendiente` → `pagado` (automático al pagar todas las cuotas) → `archivado` (manual). `cancelado` **declarado pero sin uso**.
- `ESTADOS_CUOTA`: `pendiente` → `pagado`. `vencido` **declarado pero sin transición ni job**.

## 7. Reglas de negocio

- La facturación se cierra (`pagado`) solo cuando no quedan cuotas pendientes.
- **La suma de las cuotas no puede superar `montoTotal`** (validado en `PagosApplicationService`
  al agregar/editar; la vista deshabilita "Agregar cuota" cuando el plan está 100% distribuido).
- `archivado` es irreversible desde la UI (el backend no lo impide).
- Eliminar = baja lógica (`flgActivo=false`).
- Historial en `facturacion_historial` (`agregar_cuota`, `pagar_cuota`, `actualizar`, `eliminar`, `eliminar_cuota`).

## 8. Limitaciones y observaciones

- **`cancelado` y `vencido` sin implementar**.
- **Monto heurístico**: se calcula desde `rawData.monto|precio|importe` o parseando `medidas` (`solicitudes-repository.ts:385-390`), no de un tarifario formal.
- **Modo `completo` sin flujo propio**: la única vía de pago es `pagar-cuota`.
- ~~Posible 403 para `cliente`~~ **resuelto**: el exhibidor usa `/dashboard/mis-pagos` + `/api/pagos`
  (permisos `pagos:view`/`pagos:manage` + validación de propiedad). `/dashboard/facturacion` sigue siendo admin.
- **Niubiz deshabilitado** (`NIUBIZ_HABILITADO=false`). Al reactivar: en local está mockeado; en
  producción usa proxy `IIMP_PROXY_URL` con `event`/`id_event`/`siecode_event` **hardcodeados**
  (`niubizz-client.ts`). `confirmarPago` lee `respuesta_api` de la cuota, campo **inexistente** en el schema/DTO.
- **Sin pago en línea**: el cobro real hoy es manual (admin registra `pagar-cuota` con comprobante).
- La página de pago asume **USD fijo** (`pago/page.tsx:87`) sin usar `fact.moneda`.
- Desajuste de tipos en `actualizar` (tipado `{tipo?}` vs. envío de `estado`/`modoPago`).
