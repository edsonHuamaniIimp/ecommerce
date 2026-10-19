# Integración API de reserva de stands del IIMP — "Registrar reserva"

> Flujo completo de facturación (reserva con OC/HES → notificación de la factura →
> voucher de pago → confirmación del estado): ver
> [api-facturacion-entrante.md](./api-facturacion-entrante.md).

> Estado: **implementada v2** (cliente, servicio, archivos de cuenta corriente, endpoints y UI de Mis pagos).
> A diferencia de [liststand](./integracion-liststand.md) (solo lectura), esta llamada
> **escribe** en el IIMP: reserva los stands (pasan a `RESERVADO`), registra el contrato
> con sus cuotas y crea la cuenta corriente. **Ya no emite comprobantes al reservar**: el
> IIMP factura cada cuota (incluida la 1ra) en su fecha, al contacto de Pagos.
> Cada reserva en Producción es real; mientras se validan los casos se usa Pruebas.
> Última alineación (v4, 14-10-2026): `NumeroSolicitud` obligatorio y único (PK de la
> solicitud en la web; el IIMP responde 409 si se repite), sin `Cuotas[].Documento`, y
> archivos de cuenta corriente (`OC`, `HES`, `DETRACCION`, `DIFERENCIA`, `PAGO_TOTAL`) en
> la reserva o después, vía `/stands/archivos*`.

## 1. Contexto y alcance

En `/dashboard/mis-pagos`, cuando la reserva está **pendiente de pago** y aún no se ha
archivado, el cliente dispone de un ícono en cada cuota para **Registrar reserva**. La
acción registra la reserva oficial ante el IIMP a nombre de la empresa del usuario:

1. Resuelve los datos de la solicitud (evento versión, stands, plan de cuotas, correo del
   usuario y su empresa).
2. Llama `POST /stands/reserva` del IIMP con la empresa como cliente facturado y el
   `NumeroSolicitud` determinista de la solicitud.
3. Persiste el contrato, la cuenta corriente, el código de cliente y la respuesta completa
   (incluye `NumeroSolicitud` y los archivos registrados).
4. La empresa puede registrar/consultar/quitar los documentos de la cuenta corriente
   (OC, HES, constancias de detracción y de la diferencia) desde el mismo panel.

```
ContratosStands (Mis pagos)                     IIMP (servicio-eventos)
POST /api/pagos/solicitar-factura  ─────────►  POST /auth/login (token VTA, 30 min, cache)
  SolicitarFacturaApplicationService            POST /stands/reserva
    solicitud + empresa del usuario  ────────►    ├─ stands → RESERVADO (todo o nada)
    persiste contrato/cuenta ◄───────────────    └─ contrato + cuenta corriente (sin comprobante)
                                                  El IIMP factura cada cuota en su Fecha.
  POST /api/pagos/archivos-agregar  ─────────►  POST /stands/archivos (OC/HES/detraccion/diferencia)
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
| `NumeroSolicitud` | Determinista desde `solicitud.id` (`numeroSolicitudIImp()`: `CTRS-` + 25 chars, máx 30). Único: una solicitud, una reserva |
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
| `Cuotas` | Plan del contrato: `Porcentaje` entero (redondeo; la última absorbe hasta sumar 100) y `Fecha` `AAAA-MM-DD`. En reservas nuevas las fechas salen del cronograma estándar o del cronograma personalizado configurado por el administrador para la empresa; el servidor valida el plan y no acepta fechas libres. |
| `Archivos` (opcional) | Links absolutos http(s) (el backend convierte `/uploads/*` con `APP_URL`): OC, HES, detracción y diferencia; los elementos sin link se ignoran (v3). También se agregan después con `/api/pagos/archivos-agregar` |

El snapshot se guarda al crear la solicitud (`solicitud.datos_facturacion`) con lo que el
cliente llena en el paso 1: comprobante, tipo/número de documento, razón social, dirección,
teléfono, contacto y correo. **No se exige registrar la empresa en Empresas** para facturar.

### 2.4 Reglas de facturación (doc del IIMP §2)

- **Factura (`01`) solo a RUC (`6`)**. Boleta (`03`) a persona (DNI `1`, CE `4`, pasaporte `7`)
  o empresa extranjera (`0`).
- Cuotas: 1 a 9, porcentajes enteros > 0 que **suman 100**; la `Fecha` de cada cuota es la
  fecha en que el IIMP emite su factura (v2: ya no se emite ninguna al reservar).
- Archivos de cuenta corriente: `OC` y `HES` con cuota opcional (con cuota son **por cuota**:
  cada cuota puede tener los suyos); `DETRACCION` y `DIFERENCIA` con `Cuota` obligatoria (1 a n);
  `PAGO_TOTAL` (v4) con cuota opcional (sin cuota = total de la cuenta; con cuota = total de esa
  cuota); `VALORIZACION_COTIZACION` (v5) con cuota opcional; el IIMP también acepta los alias
  `TOTAL` y `VALORIZACION`. Varias unidades por tipo. Los elementos **sin link se ignoran**
  (v3), no dan error.
- Regla de negocio de ContratosStands (no la impone el IIMP): para solicitar la factura, la
  **1ª cuota** exige al menos una OC y una HES (UI + backend); en 2ª y 3ª son opcionales. En la
  UI de la cuenta corriente, `PAGO_TOTAL` es excluyente con `DETRACCION`/`DIFERENCIA` de una
  misma cuota (lista dinámica).
- **v3**: un stand **ya reservado se reserva igual** (la empresa que registra esta reserva
  pasa a ser la de facturación); solo falla si el stand **no está disponible** (ej. inactivo).
  Todo o nada: si algo falla, no se reserva ninguno.
- Una reserva por `NumeroSolicitud`: ante un corte de red se reintenta con el mismo número;
  el IIMP responde 409 con la cuenta corriente ya creada (no se duplica).

### 2.5 Respuesta

Se persiste completa en `solicitud.iimp_reserva` y se extrae `NumeroSolicitud`,
`Contrato`, `CuentaCorriente` y `Cliente.Codigo`. El endpoint interno devuelve
`{ numeroSolicitud, contrato, cuentaCorriente, documento, payloadEnviado }` (`documento`
solo si el IIMP volviera a emitir comprobantes al reservar; hoy es `null`). `payloadEnviado`
es el JSON exacto que el servidor envió al IIMP (validación/transparencia en la respuesta).

### 2.6 Errores y mapeo a la app

| HTTP IIMP | Causa | En la app |
|---|---|---|
| 400 `SOLICITUD_INVALIDA` / `JSON_INVALIDO` | Campos obligatorios, reglas de facturación, stand inexistente | `400` con el `mensaje` del IIMP |
| 401 `NO_AUTORIZADO` | Token vencido/ inválido | `502` "La sesion con el API del IIMP expiro; reintenta" |
| 403 `PROHIBIDO` | Cuenta sin acceso VTA | `502` "La cuenta tecnica del IIMP no tiene acceso VTA" |
| 404 `NO_ENCONTRADO` | Evento inexistente | `404` con el `mensaje` del IIMP |
| 409 `CONFLICTO` | `NumeroSolicitud` repetido, stand no disponible o sin tipo de cambio del día | `409` con el `mensaje` del IIMP |
| 500 `ERROR_INTERNO` | Error interno (trae `identificador`) | `502` "Error del API de reserva del IIMP (identificador)" |

## 3. Flujo por dentro

### 3.1 Endpoints — `POST /api/pagos/solicitar-factura` y archivos (`GET /api/pagos/archivos`, `POST /api/pagos/archivos-agregar`, `POST /api/pagos/archivos-eliminar`)

`src/controllers/pagos.controller.ts` + `src/app/api/pagos/[...slug]/route.ts`. Requiere
sesión (no `pagos:manage`: es una acción del cliente); la propiedad de la cuota la valida
el servicio (`esPropietarioDeCuota`). Body de la reserva: `{ cuotaId }`.

### 3.2 Servicio — `SolicitarFacturaApplicationService`

`src/application/facturacion-iimp/solicitar-factura-service.ts`. En orden:

1. Propiedad de la cuota (403) y existencia (404).
2. Datos de la solicitud (404) y **guardia de doble reserva**: si `iimpContrato` ya existe → 409.
3. Datos fiscales: usa el **snapshot** (`datosFacturacion`); sin snapshot cae a la empresa
   vinculada (solicitudes viejas). Valida comprobante, RUC/DNI, razón social, dirección y
   correo. Si es boleta, completa nombres/apellidos con servicio-persona por DNI.
4. Evento, stands (1 a `MAX_STANDS_IIMP`) y plan de cuotas (1 a `MAX_CUOTAS_IIMP`,
   porcentajes enteros que suman `CUOTAS_PORCENTAJE_TOTAL`, fechas `REGEX_FECHA_ISO`).
5. Arma el payload (incluye `NumeroSolicitud` y, si se proporcionan, `Archivos`) y llama al
   cliente; al volver persiste la reserva y el documento de la cuota 1 solo si el IIMP lo
   enviara (v2: no viene).
6. `ArchivosCuentaCorrienteApplicationService` expone listar/agregar/eliminar sobre la cuenta
   (mismas reglas que `POST /stands/archivos`; valida propiedad de la cuota, tipo, link y
   rango de cuota).

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

- **Ícono contextual** por cuota:
  - Sin comprobante ni reserva → **Registrar reserva** (`FileText`; en v1 decía "Solicitar factura"): abre el
    diálogo que permite **adjuntar documentos por categoría** (OC, HES, detracción y diferencia) en la misma
    reserva — opcional; también pueden registrarse después. El envío llama a `POST /stands/reserva` con `Archivos`.
  - Con comprobante fiscal del admin → descarga del PDF (`FileDown`).
  - Con reserva registrada (`row.iimpContrato`) → **Documentos de la cuenta corriente**
    (`Files`): diálogo para subir/pegar links de OC, HES, detracción y diferencia, listarlos
    y quitarlos.
  - Legado: con `iimpDocumento` (reservas v1) → `FileDown` deshabilitado con tooltip.
- La cabecera de la reserva muestra **Contrato IIMP** y **Cta. cte.** cuando existen.
- Tras registrar la reserva se recarga la página: aparecen contrato y cta. cte.; ya no hay
  comprobante que mostrar (lo emite el IIMP en la fecha de cada cuota).

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

- **Idempotencia**: `NumeroSolicitud` es único; un reintento con la misma solicitud responde
  409 con la cuenta corriente ya creada (no se duplica), además de la guardia local
  (`iimp_contrato` → 409). La doc v3 recomienda reintentar con el mismo número tras un corte
  de red: si la primera llamada entró, responde 409; si no, se reserva.
- **Stands ya reservados (v3)**: el IIMP ya no los rechaza; la reserva registrada pasa a ser
  la empresa que factura. El wizard local sigue marcando los reservados como no disponibles
  (decisión de UX de esta web).
- **Anulación**: no hay endpoint; la gestiona el IIMP. El IIMP factura (y anula) cada cuota
  en su fecha.
- **Descarga de comprobantes**: pendiente; hay que pedir al IIMP el mecanismo (PDF/XML).
  Hasta entonces la UI muestra contrato/cta. cte. y los documentos de la cuenta corriente.
- **Archivos de cuenta corriente** (v2/v3): `POST /api/pagos/archivos-agregar` acepta un archivo
  por llamada (`tipo`, `cuota` obligatoria en detracción/diferencia, `link` http(s), `nombre`);
  `GET /api/pagos/archivos?cuotaId=` lista y `POST /api/pagos/archivos-eliminar` quita por
  `item`. El IIMP devuelve siempre la lista completa. Los links suben por `/api/upload`
  (`/uploads/*`) y el backend los convierte a URL absoluta. Desde la v3 los endpoints usan
  `NumeroSolicitud` (determinista) como identificador de la cuenta; el trío clásico
  `TipEvCod` + `EvenCod` + `CuentaCorriente` sigue soportado como alternativa en el cliente.
  Un archivo sin link se ignora y se responde la lista actual.
  - **Almacenamiento**: en local los archivos viven en filesystem; en producción, en S3
    (bucket privado) y la app los sirve por `/uploads/<archivo>` (URL estable, sin sesión,
    sin presigned). El backend normaliza links relativos con `APP_URL` antes de enviarlos;
    no usar URLs prefirmadas (caducan y el IIMP no podría descargarlas después).
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
- `src/application/facturacion-iimp/__tests__/archivos-cuenta-service.test.ts` — listar/agregar/quitar,
  validaciones (tipo, link, cuota obligatoria y fuera de rango) y 409 sin reserva registrada.
- `src/infrastructure/external/__tests__/reserva-iimp-client.test.ts` — payload PascalCase
  (v2: `NumeroSolicitud` y `Archivos`), respuesta sin comprobante, archivos
  (agregar/listar/eliminar) y errores 400/409/401/500/404.
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
  `src/application/facturacion-iimp/archivos-cuenta-service.ts`,
  `src/components/pagos/archivos-cuenta-corriente.tsx`,
  `src/controllers/pagos.controller.ts`,
  `src/components/pagos/mis-pagos-manager.tsx`,
  `prisma/migrations/0038_add_reserva_iimp/`.
