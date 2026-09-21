# Facturación y pagos

> Fuente: `src/app/(dashboard)/dashboard/facturacion/**`,
> `src/app/api/facturacion/**`, `src/application/facturacion/**`,
> `src/infrastructure/persistence/facturacion-repository.ts`.

## 1. Propósito

Gestionar el cobro de las solicitudes de stands: listar registros de facturación, ver
detalle, administrar cuotas, registrar pagos con comprobante, archivar y dar de baja.
Persistencia local en PostgreSQL vía Prisma.

## 2. Roles y permisos

- Permiso `facturacion:view` en página y API (`middleware.ts:20-21`).
- **No está asignado a ningún rol** en `ROLES_PERMISSIONS`; hoy solo `admin` accede (por bypass de `hasPermission`).

## 3. Pantallas

| Ruta | Uso |
|---|---|
| `/dashboard/facturacion` | Listado + acciones (ver, archivar, configurar, eliminar, pagar) |
| `/dashboard/facturacion/pago?facturacionId=` | Pago con pasarela Niubiz |
| `/dashboard/facturacion/pago/response?facturacionId=&transactionToken=` | Retorno de la pasarela (éxito/error) |
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

### 5.3 Pago con Niubiz
1. Botón "Pagar con Niubizz" en Mis Solicitudes (visible si la solicitud está `pendiente_pago` y tipo `niubizz`).
2. `POST /api/facturacion/niubizz/sesion` → carga el script `VisanetCheckout` con `sessionToken`, `merchantId`, `purchaseNumber`, `amount`.
3. Pasarela → retorno a `/pago/response` (éxito) o `/pago/error` (timeout).
4. `POST /api/facturacion/niubizz/confirmar` `{facturacionId, transactionToken}` → autoriza y marca la **primera cuota pendiente** `pagado`.

## 6. Estados

- `ESTADOS_FACTURACION`: `pendiente` → `pagado` (automático al pagar todas las cuotas) → `archivado` (manual). `cancelado` **declarado pero sin uso**.
- `ESTADOS_CUOTA`: `pendiente` → `pagado`. `vencido` **declarado pero sin transición ni job**.

## 7. Reglas de negocio

- La facturación se cierra (`pagado`) solo cuando no quedan cuotas pendientes.
- `archivado` es irreversible desde la UI (el backend no lo impide).
- Eliminar = baja lógica (`flgActivo=false`).
- Historial en `facturacion_historial` (`agregar_cuota`, `pagar_cuota`, `actualizar`, `eliminar`, `eliminar_cuota`).

## 8. Limitaciones y observaciones

- **`cancelado` y `vencido` sin implementar**.
- **Monto heurístico**: se calcula desde `rawData.monto|precio|importe` o parseando `medidas` (`solicitudes-repository.ts:385-390`), no de un tarifario formal.
- **Modo `completo` sin flujo propio**: la única vía de pago es `pagar-cuota`.
- **Posible 403 para `cliente`**: el botón de pago navega a un prefijo protegido por `facturacion:view`, permiso que el rol `cliente` no tiene. Verificar flujo real.
- **Niubiz**: en local está mockeado; en producción usa proxy `IIMP_PROXY_URL` con `event`/`id_event`/`siecode_event` **hardcodeados** (`niubizz-client.ts:39`). `confirmarPago` lee `respuesta_api` de la cuota, campo **inexistente** en el schema/DTO.
- La página de pago asume **USD fijo** (`pago/page.tsx:87`) sin usar `fact.moneda`.
- Desajuste de tipos en `actualizar` (tipado `{tipo?}` vs. envío de `estado`/`modoPago`).
