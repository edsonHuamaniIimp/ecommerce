# Reserva administrativa para empresas y operadores internacionales

**Estado:** vigente (actualizado 22/11/2026 según el código; sustituye la versión inicial)
**Pantalla:** `/dashboard/reservar-empresa`
**Tipo de solicitud:** `reserva_empresa`
**Ámbito:** operadores internacionales que administran un pabellón y asignan stands a empresas de su país
**Regla de trabajo equivalente:** `.opencode/reglas/flujo-pabellones-internacionales/SKILL.md`

## 1. Objetivo

Documentar el flujo especial de solicitudes de pabellones internacionales:

- Creación de la solicitud por un usuario interno.
- Generación automática del contrato P38 de Operador Internacional.
- Firma del contrato por el cliente o carga del PDF firmado por el Asociado.
- Revisión del Asociado y luego del SGC, con trazabilidad separada.
- Facturación independiente del flujo de revisión (`estadoPago`).
- Descuentos generales o por stand y reglas monetarias.

## 2. Dos dimensiones de estado

El flujo regular maneja un único estado. Este flujo separa **revisión** de **pago** para no perder la trazabilidad de la revisión del Asociado y del SGC.

| Campo | Valores | Qué controla |
|---|---|---|
| `estadoSolicitud` | `pendiente`, `en_proceso`, `observado`, `aprobado`, `rechazado`, `pendiente_pago`, `pagado` | Revisión del Asociado y del SGC |
| `estadoPago` | `pendiente_pago`, `pagado` | Facturación y cobranza |

Reglas:

- La solicitud nace con `estadoSolicitud = pendiente` y `estadoPago = pendiente_pago`.
- La Facturación pendiente se crea al registrar la solicitud.
- El flujo puede estar `aprobado` y el pago en `pendiente_pago`.
- `pagado` es terminal: ni una observación ni una subsanación del SGC lo reinicia.
- Una observación del SGC no cambia `estadoPago`.
- La bandeja muestra dos bloques, **Revisión** y **Facturación**. Si ambos estados son `pendiente_pago`, muestra solo **Facturación**.
- Las solicitudes que no son de pabellón internacional conservan el badge único.

## 3. Diferencias con el flujo regular

| Flujo regular | Pabellón internacional |
|---|---|
| Cliente inicia la solicitud | Usuario interno crea la solicitud |
| Un único estado | `estadoSolicitud` + `estadoPago` |
| Revisión por Asociado, Logística, Comunicación y Legal | Revisión local solo del **Asociado**; Legal delegada al SGC |
| El cliente solo firma digitalmente | El cliente firma digitalmente **o** el Asociado sube el PDF firmado |
| Debida Diligencia puede bloquear | No bloquea esta pantalla |
| Facturación tras aprobación | Facturación pendiente desde la creación |
| Envía correos | **No envía correos** (`permiteCorreosSolicitud`) |

## 4. Flujo completo

```text
1. El usuario interno crea la solicitud en /dashboard/reservar-empresa.
2. El sistema genera el contrato P38.
3. La solicitud llega a la bandeja: estadoSolicitud = pendiente, estadoPago = pendiente_pago.
4. Firma del contrato, por dos caminos:
   a) El cliente firma digitalmente desde su portal.
   b) El Asociado sube el PDF firmado (modal de firmantes, ver 4.1).
5. Revisión del Asociado: aprobar, observar o rechazar.
6. Si aprueba, se envía al SGC con el flujo regular.
7. El SGC tiene su propia revisión; si observa, se subsana y se reenvía.
8. Si el SGC aprueba, la solicitud queda aprobada y la Facturación sigue su curso.
```

### 4.1 Carga del contrato firmado por el Asociado

Al pulsar el botón **Subir contrato firmado** se abre un modal: *"Estás subiendo el contrato firmado"*, con dos checks:

- **Firmado por el cliente**
- **Firmado por Gerencia**

Hay que marcar al menos uno. Luego se elige el PDF. Resultado según los checks:

| Checks | Resultado |
|---|---|
| Cliente + Gerencia | **No se envía al SGC.** El contrato ya está completo: la solicitud queda aprobada por el Asociado y por el SGC, y la Facturación sigue habilitada. |
| Solo cliente (o solo Gerencia) | Flujo regular: pasa a revisión del Asociado y, al aprobar, se envía al SGC. |
| Ninguno | Se rechaza: debe indicarse quién firmó. |

Detalles del caso Cliente + Gerencia:

- Se crea o actualiza la revisión del Asociado en `aprobado`, con comentario automático y el correo del Asociado como autor.
- Se deja la correlación local del SGC como aprobada (Vigente, `bypassAprobado`) **sin llamar al SGC**; así la bandeja y la trazabilidad muestran el paso Legal completo.
- Se habilita la orden de pago de forma idempotente: no duplica la Facturación ni reabre un pago `pagado`.
- Si el SGC está deshabilitado en el servidor, solo se aprueba la revisión del Asociado y se habilita la orden de pago (el botón de carga del Asociado solo aparece con el SGC habilitado).

En todos los casos la carga queda auditada: `uploadedBy` = Asociado, `userId` = cliente, origen `subido_asociado`, y el SHA-256 no puede repetirse en otra solicitud. La auditoría registra `firmadoCliente` y `firmadoGerencia`.

### 4.2 Subsanación de observaciones del SGC

- Ruta: `/dashboard/solicitudes/[id]/subsanar-sgc`.
- Permite ver las observaciones, cargar el contrato corregido y el contrato firmado, y reenviar al SGC.
- No modifica `estadoPago`.

## 5. Permisos

- `reservas:empresa`: acceso a la pantalla de creación.
- `ADMIN_FULL`: acceso completo y bypass administrativo del SGC.
- `solicitudes:review:asociado`: revisión del Asociado y carga de contrato firmado y anexos.
- Los clientes no acceden a `/dashboard/reservar-empresa`.

## 6. Descuentos

La solicitud admite **un solo modo de descuento**:

1. Porcentaje sobre el total del contrato.
2. Monto fijo sobre el total del contrato.
3. Porcentaje distinto por cada stand.
4. Monto fijo distinto por cada stand.

No se permite combinar global con por stand.

Validaciones: porcentaje de 0 a 100 con máximo 2 decimales; monto fijo mayor o igual a 0; el descuento por stand no supera su precio neto; sin duplicados ni stands ajenos; el total no puede quedar en cero.

### 6.1 Cálculo

```text
Neto del stand  = precio comercial convertido a la moneda - descuento del stand
Neto total      = suma de los netos de los stands
IGV             = 18% sobre el neto total
Total           = neto total + IGV
Cuotas          = de 1 a 9; suman exactamente 100%; la última absorbe el redondeo
```

El backend recalcula siempre desde el precio comercial y no confía en los importes del navegador. El plan se guarda en `solicitud.planCuotas` (`descuentoTipo`, `descuentosPorStand`, `cuotas`, `moneda`, `tipoCambio`, totales).

## 7. UI de creación

Modal de tres pasos con altura estable y scroll interno:

1. **Configuración:** empresa, representante legal, tipo de facturación y moneda (USD o PEN).
2. **Descuento:** un solo selector; por stand, buscador por código o tipo.
3. **Cuotas y plazos:** fechas, porcentajes, montos y resumen de neto, descuento, IGV y total.

Solo se pueden solicitar stands pre-reservados (`/dashboard/pre-reservas`); la bandeja los muestra como pre-reservados y permite seleccionarlos.

## 8. Contrato de Operador Internacional

- Plantilla: `plantillas/contrato-p38-operador-tags.docx`, elegida por tipo de solicitud (`reserva_empresa` → `PLANTILLAS_CONTRATO_RESERVA_EMPRESA`).
- Cuotas dinámicas de 1 a 9; moneda y cuentas bancarias dinámicas (USD/PEN).
- **Anexo 3-A eliminado**; no se reintroduce.
- El representante usa el orden de prioridad: representante legal de la empresa, representante explícito del contrato, y solo como respaldo el contacto de facturación.
- Se contrasta con el contrato estándar en el documento [19](19-diferencias-contrato-estandar-vs-pabellones-internacionales.md).

## 9. Anexos del Asociado

El Asociado puede adjuntar documentos anexos desde la revisión (`subirAnexoAsociado`): solo `reserva_empresa`, el documento pertenece al cliente, se audita al Asociado y no se reemplazan anexos existentes.

## 10. Correos

Las solicitudes `reserva_empresa` no envían correos (creación, observaciones del Asociado o del SGC, contrato observado, facturación, comprobantes y recordatorios). Las alertas in-app se conservan. Los correos de cuenta, seguridad y Debida Diligencia quedan fuera de esta regla.

## 11. Pendientes

1. Decidir si la carga del contrato firmado por ambos debe estar disponible con el SGC deshabilitado.
2. Validar visualmente la plantilla con datos reales de un operador.
3. Definir la gestión de cambios posteriores a la firma o a la facturación.
4. Confirmar en QA el caso Cliente + Gerencia de punta a punta.
