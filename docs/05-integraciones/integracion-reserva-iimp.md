# Integración API de reserva de stands del IIMP — "Solicitar factura"

> Estado: **implementada** (cliente, servicio, endpoint y UI de Mis pagos).
> A diferencia de [liststand](./integracion-liststand.md) (solo lectura), esta llamada
> **escribe** en el IIMP: reserva los stands (pasan a `RESERVADO`), registra el contrato
> con sus cuotas y crea la cuenta corriente, y **emite en el momento la factura/boleta de
> la 1ra cuota**. Las cuotas siguientes las factura el IIMP en la fecha de cada cuota.
> Cada reserva en Producción es real; mientras se validan los casos se usa Pruebas.
> Última alineación: `Cuotas[0].Documento` en la respuesta, cuotas con porcentajes
> enteros que suman 100, 409 si el día no tiene tipo de cambio y guardia local contra
> doble reserva (`solicitud.iimp_contrato`).

## 1. Contexto y alcance

En `/dashboard/mis-pagos`, cuando la reserva está **pendiente de pago** y aún no se ha
archivado, el cliente dispone de un ícono en cada cuota para **Solicitar factura**. La
acción registra la reserva oficial ante el IIMP a nombre de la empresa del usuario:

1. Resuelve los datos de la solicitud (evento versión, stands, plan de cuotas, correo del
   usuario y su empresa).
2. Llama `POST /stands/reserva` del IIMP con la empresa como cliente facturado.
3. Persiste el contrato, la cuenta corriente, el código de cliente y la respuesta completa.
4. Guarda el comprobante emitido de la 1ra cuota para mostrarlo en la UI.

```
ContratosStands (Mis pagos)                     IIMP (servicio-eventos)
POST /api/pagos/solicitar-factura  ─────────►  POST /auth/login (token VTA, 30 min, cache)
  SolicitarFacturaApplicationService            POST /stands/reserva
    solicitud + empresa del usuario  ────────►    ├─ stands → RESERVADO (todo o nada)
    persiste contrato/cuenta/documento ◄──────    ├─ contrato + cuenta corriente
                                                  └─ factura 1ra cuota (Cuotas[0].Documento)
```

## 2. API externa

Doc del IIMP: `API-RESERVA-STAND-INTEGRACION.md` (entregada por el IIMP).

### 2.1 Ambientes

| Ambiente | URL base |
|---|---|
| Pruebas | `https://secure2.iimp.org:8443/servicio-eventos-pruebas/api` |
| Producción | `https://secure2.iimp.org:8443/servicio-eventos/api` |

Se configura con la misma variable del liststand (`LISTSTAND_API_URL`), porque el token y
la cuenta técnica son compartidos y cada ambiente expone ambos servicios bajo la misma base.

### 2.2 Autenticación

La misma cuenta técnica (acceso **VTA**) de `listtype`, `liststand` y `/ventas/voucher`.
`ReservaIimpClient` reutiliza `obtenerTokenIimp()` de
`src/infrastructure/external/liststand-client.ts`: token de 30 minutos con caché en
memoria del proceso y re-login automático ante 401.

### 2.3 Request que enviamos

Origen de cada dato (preferencia: **snapshot del paso 1 del wizard**; la empresa
vinculada es opcional y solo enriquece):

| Campo | Origen en ContratosStands |
|---|---|
| `TipEvCod`, `EvenCod` | `evento.tipoEvento` / `evento.codigoEvento` de la versión activa (vía `gess_stand`) |
| `Stands` | `gess_stand.standApiId` (o `standCode`) de la solicitud; máximo 50 |
| `TipoFacturacion` | `solicitud.datos_facturacion.tipoComprobante` (`factura` → `01`, `boleta` → `03`) |
| `TipDocFacturacion` | RUC `6` (factura) / DNI `1` (boleta) según `tipoDocumento` |
| `NumDocFacturacion` | `datos_facturacion.numeroDocumento` (respaldo: `empresa.ruc`) |
| `RazonSocial` | `datos_facturacion.razonSocial` (respaldo: `empresa.razonSocial`); no se envía en boleta |
| `ApellidoPaternoFact`/`MaternoFact`/`NombresFact` | Boleta: desde servicio-persona (`searchpersonv00`) por DNI |
| `DirFacturacion` | `datos_facturacion.direccion` (respaldo: `empresa.direccionFiscal`) |
| `Web`, `Telefono` | `empresa.sitioWeb`, `datos_facturacion.telefono` o `empresa.telefono` |
| `Friso` | `empresa.nombreComercial` o razón social |
| `Contactos.Contrato` | `datos_facturacion.contacto` (respaldo: representante legal); cargo `IIMP_CARGO_REPRESENTANTE` |
| `Contactos.Pagos` | Mismo nombre + `datos_facturacion.email` (respaldo: `empresa.emailFacturacion`/`emailContacto`) |
| `Cuotas` | Plan del contrato: `Porcentaje` entero (redondeo; la última absorbe hasta sumar 100) y `Fecha` `AAAA-MM-DD` |

El snapshot se guarda al crear la solicitud (`solicitud.datos_facturacion`) con lo que el
cliente llena en el paso 1: comprobante, tipo/número de documento, razón social, dirección,
teléfono, contacto y correo. **No se exige registrar la empresa en Empresas** para facturar.

### 2.4 Reglas de facturación (doc del IIMP §2)

- **Factura (`01`) solo a RUC (`6`)**. Boleta (`03`) a persona (DNI `1`, CE `4`, pasaporte `7`)
  o empresa extranjera (`0`).
- Cuotas: 1 a 9, porcentajes enteros > 0 que **suman 100**; desde la 2da cuota la fecha es
  la de emisión de su factura (la 1ra se emite al reservar).
- Todo o nada: si un stand ya no está libre, no se reserva ninguno.
- La reserva no vence y **no es idempotente**: cada llamada exitosa crea una reserva nueva.

### 2.5 Respuesta

Se persiste completa en `solicitud.iimp_reserva` y se extrae `Contrato`,
`CuentaCorriente`, `Cliente.Codigo` y `Cuotas[0].Documento` (serie, número, fecha de
emisión, tipo de cambio, IGV y total). El endpoint interno devuelve
`{ contrato, cuentaCorriente, documento }`.

### 2.6 Errores y mapeo a la app

| HTTP IIMP | Causa | En la app |
|---|---|---|
| 400 `SOLICITUD_INVALIDA` / `JSON_INVALIDO` | Campos obligatorios, reglas de facturación, stand inexistente | `400` con el `mensaje` del IIMP |
| 401 `NO_AUTORIZADO` | Token vencido/ inválido | `502` "La sesion con el API del IIMP expiro; reintenta" |
| 403 `PROHIBIDO` | Cuenta sin acceso VTA | `502` "La cuenta tecnica del IIMP no tiene acceso VTA" |
| 404 `NO_ENCONTRADO` | Evento inexistente | `404` con el `mensaje` del IIMP |
| 409 `CONFLICTO` | Stand tomado o sin tipo de cambio del día | `409` con el `mensaje` del IIMP |
| 500 `ERROR_INTERNO` | Error interno (trae `identificador`) | `502` "Error del API de reserva del IIMP (identificador)" |

## 3. Flujo por dentro

### 3.1 Endpoint — `POST /api/pagos/solicitar-factura`

`src/controllers/pagos.controller.ts` + `src/app/api/pagos/[...slug]/route.ts`. Requiere
sesión (no `pagos:manage`: es una acción del cliente); la propiedad de la cuota la valida
el servicio (`esPropietarioDeCuota`). Body: `{ cuotaId }`.

### 3.2 Servicio — `SolicitarFacturaApplicationService`

`src/application/facturacion-iimp/solicitar-factura-service.ts`. En orden:

1. Propiedad de la cuota (403) y existencia (404).
2. Datos de la solicitud (404) y **guardia de doble reserva**: si `iimpContrato` ya existe → 409.
3. Datos fiscales: usa el **snapshot** (`datosFacturacion`); sin snapshot cae a la empresa
   vinculada (solicitudes viejas). Valida comprobante, RUC/DNI, razón social, dirección y
   correo. Si es boleta, completa nombres/apellidos con servicio-persona por DNI.
4. Evento, stands (1 a `MAX_STANDS_IIMP`) y plan de cuotas (1 a `MAX_CUOTAS_IIMP`,
   porcentajes enteros que suman `CUOTAS_PORCENTAJE_TOTAL`, fechas `REGEX_FECHA_ISO`).
5. Arma el payload y llama al cliente; al volver persiste la reserva y el documento de la
   cuota 1 (si vino).

### 3.3 Persistencia (migraciones `0038_add_reserva_iimp` y `0039_add_datos_facturacion`)

- `solicitud.datos_facturacion` (JSONB): snapshot del paso 1 del wizard (8 campos fiscales).
- `solicitud.iimp_contrato`, `iimp_cuenta_corriente`, `iimp_cliente_codigo`,
  `iimp_reserva` (JSON completo), `iimp_reserva_at`.
- `facturacion_cuota.iimp_documento` (documento de la 1ra cuota), `iimp_emitida_at`.
- Historial: acción `ACCIONES_FACTURACION.DOCUMENTO_IIMP` firmada por `AUTORES_SISTEMA.IIMP`.

### 3.4 Cliente — `ReservaIimpClient`

`src/infrastructure/external/reserva-iimp-client.ts` (puerto en
`src/domain/ports/reserva-iimp-client.ts`). Traduce camelCase ↔ PascalCase del contrato
del IIMP, mapea los errores HTTP de la tabla §2.6 y no reintenta (el IIMP no es idempotente).
Usa `fetchIimp` de `liststand-client.ts`: mismo manejo del certificado self-signed de
`secure2.iimp.org` que el resto de llamadas VTA.

## 4. UI — Mis pagos (`/dashboard/mis-pagos`)

- **Ícono único contextual** por cuota:
  - Sin comprobante y sin documento IIMP → **Solicitar factura** (acción; deshabilitado
    mientras la petición está en curso).
  - Con comprobante fiscal del admin → descarga del PDF (`FileDown`).
  - Con documento IIMP → `FileDown` deshabilitado con tooltip
    `Factura FRS1-1 emitida el 2026-10-05 (descarga desde el IIMP pendiente)`.
- La cabecera de la reserva muestra **Contrato IIMP** y **Cta. cte.** cuando existen.
- Tras crear la reserva se recarga la página: el documento de la 1ra cuota ya aparece.

## 5. Configuración

```bash
# Misma base para liststand y reserva (docs/04-api). Pruebas mientras se valida:
LISTSTAND_API_URL="https://secure2.iimp.org:8443/servicio-eventos-pruebas/api"
# Producción: https://secure2.iimp.org:8443/servicio-eventos/api
LISTSTAND_USUARIO="<cuenta tecnica con acceso VTA>"
LISTSTAND_CLAVE="<clave>"
```

En AWS estas variables viven en el task definition (Terraform): en Producción apuntan al
ambiente de Producción del IIMP, por lo que cada reserva real se registra al instante.
Variables solo de servidor (el cliente corre en `src/infrastructure/external`).

## 6. Operación y notas

- **No idempotente**: un doble clic se corta con la guardia local (`iimp_contrato` → 409);
  aun así, evitar reintentos ciegos (doc del IIMP §6): si hubo timeout sin respuesta,
  consultar liststand; si los stands figuran `RESERVADO`, la reserva sí se registró.
- **Anulación**: no hay endpoint; la gestiona el IIMP. Si la factura de la 1ra cuota ya se
  emitió, también la anula el IIMP.
- **Descarga de comprobantes**: pendiente; hay que pedir al IIMP el mecanismo (PDF/XML) de
  las facturas emitidas. Hasta entonces la UI solo muestra serie/número/fecha.
- **Alcance actual**: factura a empresa con RUC y **boleta a persona natural con DNI**
  (nombres/apellidos desde servicio-persona). Empresa extranjera (`TipDocumento` `0`),
  CE y pasaporte no están soportados en la UI.
- Los porcentajes del plan del contrato se redondean a enteros; la última cuota absorbe el
  ajuste para sumar exactamente 100 (requisito del IIMP).
- Solicitudes creadas antes de `0039` no tienen snapshot: caen al respaldo de la empresa
  registrada en Empresas (y fallan con mensaje claro si no existe).

## 7. Pruebas

- `src/application/facturacion-iimp/__tests__/solicitar-factura-service.test.ts` — reserva
  exitosa y persistencia, ajuste de porcentajes a enteros, doble reserva (409), sin empresa
  (400), boleta con RUC (400), 409 del IIMP propagado sin persistir y dirección fiscal.
- `src/infrastructure/external/__tests__/reserva-iimp-client.test.ts` — payload PascalCase,
  mapeo de respuesta (documento solo en la 1ra cuota) y errores 400/409/401/500.
- **Integración opcional** (`reserva-iimp.integration.test.ts`, no corre en CI): crea una
  reserva real en Pruebas con una empresa de prueba. Requiere `IIMP_INTEGRATION=1` y una
  `LISTSTAND_API_URL` que contenga `pruebas`; usa `npx vitest run` sobre ese archivo.
  - Corrida del 05-10-2026: Pruebas con 967 stands (963 libres); reserva de `41` y `02` →
    contrato `0000000003`, cuenta corriente 3, cliente `E0000106321`, factura `FRS1-3`
    (TC 3.442) y ambos stands pasaron a `RESERVADO` en liststand.
- **Manual (Pruebas del IIMP)**:
  1. `.env` con `LISTSTAND_API_URL` de Pruebas; reiniciar `npm run dev` (el token cacheado
     dura 30 minutos).
  2. Verificar con liststand que el evento versión y los stands de la solicitud existen en
     Pruebas; si responde 400 `"No existe el stand X en el evento"`, el catálogo de Pruebas
     no tiene esos stands — coordinar con el IIMP.
  3. Solicitar factura sobre una cuota propia y verificar: 201 del IIMP, contrato/cuenta
     guardados, cuota 1 con documento y stands en `RESERVADO` en liststand.
  4. Al terminar, revertir `.env` a Producción.

## 8. Referencias

- Doc del IIMP: `API-RESERVA-STAND-INTEGRACION.md` (entregada por el IIMP).
- Integración relacionada: [integracion-liststand.md](./integracion-liststand.md)
  (token y cuenta compartidos).
- Funcional: `docs/01-funcional/04-facturacion.md` (§5.4 Mis pagos).
- Inventario de endpoints: `docs/04-api/api-inventario.md` (§3.14b Pagos).
- OpenAPI: `docs/04-api/openapi.yaml` (`/pagos/solicitar-factura`).
- Código: `src/infrastructure/external/reserva-iimp-client.ts`,
  `src/application/facturacion-iimp/solicitar-factura-service.ts`,
  `src/controllers/pagos.controller.ts`,
  `src/components/pagos/mis-pagos-manager.tsx`,
  `prisma/migrations/0038_add_reserva_iimp/`.
