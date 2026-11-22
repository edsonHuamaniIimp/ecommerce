---
name: flujo-pabellones-internacionales
description: Flujo vigente de solicitudes de pabellón internacional (reserva_empresa). Cargar al crear, revisar, aprobar, facturar, generar contratos P38 o modificar la bandeja de solicitudes administrativas.
metadata:
  severity: HIGH
---

# Flujo de Pabellones Internacionales

## 1. Alcance

Esta regla aplica a solicitudes con:

```text
tipo = reserva_empresa
```

Corresponden a operadores internacionales que administran un pabellón y asignan stands a empresas de su país. No mezclar estas reglas con el flujo regular de alquiler.

La fuente de verdad es el código actual, no la documentación histórica de `docs/01-funcional/18-*` y `19-*`, que quedó desactualizada.

## 2. Dimensiones de estado

Mantener separadas dos dimensiones:

| Campo | Valores | Responsabilidad |
|---|---|---|
| `estadoSolicitud` | `pendiente`, `en_proceso`, `observado`, `aprobado`, `rechazado`, `pendiente_pago`, `pagado` | Flujo y revisión |
| `estadoPago` | `pendiente_pago`, `pagado` | Facturación y cobranza |

Reglas:

- El flujo puede estar en `aprobado` y el pago en `pendiente_pago`.
- `pagado` es terminal para `estadoPago`; una observación o subsanación SGC no lo reinicia.
- El estado visible de la bandeja no debe duplicar el mismo badge.
- Para P38, mostrar bloques separados `Revisión` y `Facturación`.
- Si `estadoSolicitud` y `estadoPago` son ambos `pendiente_pago`, mostrar solo el bloque `Facturación`.
- Para solicitudes que no son P38, no mostrar títulos de estado; mostrar el badge normal.

## 3. Creación de la solicitud

Pantalla:

```text
/dashboard/reservar-empresa
```

Al crear una reserva administrativa:

1. El administrador selecciona una o más stands y una empresa.
2. Se permite moneda USD o PEN, descuentos globales o por stand y cuotas de 1 a 9.
3. Se valida que las cuotas sumen exactamente 100% y que las fechas sean válidas.
4. Se genera el contrato P38 automáticamente.
5. La solicitud queda en `estadoSolicitud = pendiente` y `estadoPago = pendiente_pago`.
6. Se crea la Facturación pendiente para que aparezca en el módulo de facturación.
7. El cliente firma el contrato o el Asociado registra el PDF firmado.

No permitir que el cliente acceda a la pantalla de reserva administrativa.

## 4. Contrato P38

Plantilla:

```text
plantillas/contrato-p38-operador-tags.docx
```

Reglas del contrato:

- Es un contrato del Operador Internacional, no un contrato de exhibidor estándar.
- Anexo 1: detalle económico por stand, con descuento y precio final por stand.
- Anexo 2: cuotas dinámicas, símbolo de moneda y cuentas bancarias según USD/PEN.
- Anexo 3: declaración de cumplimiento del Operador.
- Anexo 3-A: eliminado de la plantilla; no reintroducirlo.
- Anexo 4: reglamento de exhibidores y anexos PDF fijos.
- No hardcodear `US$` ni cuentas en dólares cuando el contrato sea en soles.
- Usar los tags de moneda, cuenta corriente, cuenta interbancaria, cuenta de detracción y tipo de cuenta.
- Conservar mapas horizontales, centrados y sin páginas vacías.
- El PDF firmado debe ser único por solicitud; no reutilizar el mismo archivo en otra solicitud por hash.

## 5. Firma del contrato

Existen dos caminos válidos:

1. El cliente firma digitalmente desde su portal.
2. El Asociado sube el PDF firmado en nombre del cliente.

Al pulsar "Subir contrato firmado" el Asociado ve un modal con dos checks: **Firmado por el cliente** y **Firmado por Gerencia** (al menos uno; el backend rechaza si no se indica ninguno).

- Cliente + Gerencia: **no se envía al SGC**. Se aprueba la revisión del Asociado, se deja el SGC aprobado localmente (`aprobarPorContratoFirmadoCompleto`, sin llamar al SGC) y se habilita la Facturación sin duplicarla ni reabrir un pago `pagado`.
- Una sola firma: flujo regular (Asociado y luego SGC).
- Flags: `firmadoCliente` y `firmadoGerencia` en `uploadDocumento`; se auditan.

Para la carga del Asociado:

- Usar `subirFirmaAsociado`.
- Validar que sea una reserva administrativa.
- Validar que el contrato esté en ventana de firma.
- Guardar auditoría con `uploadedBy` del Asociado y origen `subido_asociado`.
- Mantener el `userId` del cliente.
- Rechazar el mismo SHA-256 ya usado en otra solicitud.
- No permitir que un archivo firmado reemplace silenciosamente el contrato de otra solicitud.

## 6. Revisión del Asociado y SGC

El área local de estas solicitudes es solo:

```text
Asociado
```

Flujo:

1. El cliente firma o el Asociado registra el contrato firmado.
2. La solicitud pasa a revisión del Asociado.
3. El Asociado puede aprobar, observar o rechazar.
4. Si el SGC está deshabilitado, la aprobación genera la Facturación y deja el pago pendiente.
5. Si el SGC está habilitado, la aprobación crea y envía el expediente al SGC.
6. El paso Legal se completa cuando el SGC aprueba o mediante el bypass exclusivo del administrador.
7. Una observación del SGC no cambia `estadoPago`; habilita la subsanación.
8. La ruta de subsanación es:

```text
/dashboard/solicitudes/[id]/subsanar-sgc
```

No crear revisiones de Logística, Comunicación o Legal locales para este flujo cuando SGC está delegado.

## 7. Documentos anexos

El Asociado puede adjuntar documentos anexos desde la revisión:

- Endpoint con flag explícito `subirAnexoAsociado`.
- Solo para `tipo = reserva_empresa`.
- Solo Asociado o administrador con permiso.
- El documento pertenece al cliente (`userId` del cliente).
- La auditoría registra al Asociado en `uploadedBy`.
- El origen es `subido_asociado`.
- No reemplazar anexos existentes al agregar uno nuevo.
- Actualizar la lista local del modal inmediatamente después de subir.
- Mostrar nombre, usuario que subió, fecha y hora.

## 8. Facturación

Reglas:

- La Facturación no se deriva de `estadoSolicitud`; se controla con `estadoPago`.
- La reserva administrativa crea una Facturación pendiente desde la creación.
- La aprobación del SGC o el bypass puede habilitar o completar la Facturación.
- Si ya existe Facturación, no volver a crearla.
- Si el pago ya es `pagado`, no retroceder a `pendiente_pago`.
- Las cuotas pagadas deben conservarse.
- El cierre de Facturación no debe reabrir el flujo de revisión.

## 9. Bandeja de solicitudes

Archivo principal:

```text
src/components/solicitudes/solicitudes-manager.tsx
```

Reglas de UI:

- P38: dos bloques con títulos `Revisión` y `Facturación`.
- Evitar dos badges con el mismo texto `Pendiente Pago`.
- No P38: solo badge normal, sin títulos ni bloque de facturación.
- Las columnas `Tipo` y `Docs` fueron retiradas de la bandeja; no reintroducirlas sin pedido.
- El filtro `Tipo de solicitud` debe enviarse desde el controlador al repositorio; un filtro solo visual no es suficiente.
- Usar `TIPOS_SOLICITUD.RESERVA_EMPRESA` y las constantes de `src/lib/shared/constants.ts`.

## 10. Reglas de implementación

- No hardcodear estados, tipos, monedas, permisos ni cuentas.
- Mantener la separación `estadoSolicitud` / `estadoPago`.
- Propagar cualquier flag nuevo por validador, controlador, servicio cliente y servicio de aplicación.
- Auditar toda carga de documentos y cambio de estado.
- No modificar la base de datos de producción directamente.
- Mantener compatibilidad con la otra sesión de trabajo: no reescribir archivos de facturación ajenos al alcance.
- Verificar con `tsc`, ESLint y tests antes de declarar terminado.
- Para contratos, validar que la plantilla mantenga UTF-8 sin BOM y que el DOCX conserve sus entradas e imágenes.

## 11. Archivos clave

```text
src/application/reservas/reserva-service.ts
src/application/solicitudes/solicitudes-service.ts
src/application/contratos/contrato-service.ts
src/application/sgc-integracion/orden-pago-automatica.ts
src/infrastructure/persistence/solicitudes-repository.ts
src/components/solicitudes/solicitud-review.tsx
src/components/solicitudes/solicitudes-manager.tsx
src/components/sgc/sgc-documento-upload.tsx
src/controllers/solicitudes.controller.ts
src/validators/solicitudes.validator.ts
plantillas/contrato-p38-operador-tags.docx
```

## 12. Checklist de regresión

- [ ] Crear reserva administrativa con 1 y con varios stands.
- [ ] Verificar cuotas, moneda y cuentas del contrato.
- [ ] Verificar que el Anexo 3-A no exista.
- [ ] Subir contrato firmado único y rechazar hash repetido.
- [ ] Revisar como Asociado: aprobar, observar y rechazar.
- [ ] Verificar SGC habilitado y deshabilitado.
- [ ] Adjuntar anexos como Asociado y comprobar refresco inmediato.
- [ ] Verificar que la Facturación no se duplique.
- [ ] Verificar bandeja P38: `Revisión` y `Facturación`.
- [ ] Verificar que una solicitud regular no muestre esos títulos.
- [ ] Verificar filtro por tipo de solicitud.
- [ ] Verificar que no se envie ningun correo para `reserva_empresa`.
- [ ] Ejecutar `tsc`, ESLint y tests.

## 13. Correos

- Las solicitudes `tipo = reserva_empresa` **no envian correos** al cliente ni a receptores internos.
- La supresion aplica a creacion, observacion del Asociado, observaciones/devoluciones/aprobaciones del SGC,
  contrato observado, facturacion, comprobantes y recordatorios.
- Usar `permiteCorreosSolicitud(tipoSolicitud)` antes de cualquier `enviarEmailPlantilla`.
- No suprimir alertas in-app ni efectos de negocio.
- Los correos de cuenta, seguridad y Debida Diligencia quedan fuera de esta regla.
