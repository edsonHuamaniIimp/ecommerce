# Reserva administrativa para empresas y operadores internacionales

**Estado:** implementación local / pendiente de commit y despliegue
**Pantalla:** `/dashboard/reservar-empresa`
**Tipo de solicitud:** `reserva_empresa`
**Ámbito:** empresas nacionales y operadores internacionales

## 1. Objetivo

Documentar el flujo especial de reserva administrativa creado por el IIMP para empresas y operadores internacionales, incluyendo:

- Creación de la reserva por un administrador.
- Generación automática del contrato.
- Firma digital del cliente.
- Revisión del Asociado.
- Pase directo a facturación, sin SGC.
- Descuentos generales o por stand.
- Reglas monetarias y snapshot para contrato/facturación.
- Uso de la nueva plantilla de contrato de Operador Internacional.

## 2. Diferencia con el flujo regular

| Flujo regular | Reserva administrativa |
|---|---|
| Cliente inicia la solicitud | Administrador crea la solicitud |
| Contrato generado en el flujo | Contrato generado automáticamente al crear |
| Revisión de áreas | Revisión solo del Asociado |
| Pasa por SGC cuando está habilitado | **No pasa por SGC** |
| Orden de pago tras aprobaciones | El Asociado aprueba y se genera la orden de pago |
| Debida Diligencia puede bloquear | **No bloquea** la reserva administrativa |

## 3. Flujo completo

```text
1. Admin crea la reserva administrativa.
2. El sistema genera el contrato automáticamente.
3. La solicitud queda pendiente de firma del cliente.
4. El cliente firma digitalmente el contrato.
5. La solicitud pasa a revisión del Asociado.
6. El Asociado puede aprobar, observar o rechazar.
7. Si aprueba, el sistema genera automáticamente la orden de pago.
8. La solicitud pasa a facturación.
```

### Reglas del flujo

- El Asociado no puede aprobar, observar ni rechazar si el cliente aún no firmó.
- La reserva administrativa **no crea revisiones de Logística, Comunicación, Legal ni SGC**.
- La aprobación del Asociado ejecuta `marcarOrdenPago` para estas solicitudes.
- La Debida Diligencia no muestra bloqueo ni deshabilita acciones en esta pantalla.
- El contrato se regenera cuando se modifican cuotas, fechas, descuentos o importes.

## 4. Permisos

- `reservas:empresa`: acceso a la pantalla de reserva administrativa.
- `ADMIN_FULL`: acceso completo y bypass administrativo.
- `write:reservas`: se conserva para clientes en el flujo regular.
- Los clientes no acceden a `/dashboard/reservar-empresa`.

## 5. Descuentos

### 5.1 Modos permitidos

La solicitud admite **un solo modo de descuento**:

1. Porcentaje sobre el total del contrato.
2. Monto fijo sobre el total del contrato.
3. Porcentaje distinto por cada stand.
4. Monto fijo distinto por cada stand.

No se permite combinar descuento global con descuento por stand.

### 5.2 Reglas de validación

- Porcentaje: `0` a `100`, máximo 2 decimales.
- Monto fijo: mayor o igual a `0`, máximo 2 decimales.
- El descuento por stand no puede superar el precio neto de ese stand.
- No se permiten descuentos negativos, duplicados o referencias a stands ajenos.
- El descuento no puede dejar el total del contrato en cero.
- Las cuotas deben sumar exactamente `100%`.
- Las fechas deben ser válidas y estar en orden.
- La última cuota absorbe el centavo de redondeo.

### 5.3 Cálculo

```text
Precio neto por stand = precio comercial convertido a la moneda del contrato
Descuento por stand   = porcentaje o monto fijo aplicado a ese stand
Neto del stand        = precio neto - descuento del stand
Neto total            = suma de los netos de todos los stands
IGV                   = 18% sobre el neto total
Total                 = neto total + IGV
Cuotas                = porcentajes sobre el total; última absorbe redondeo
```

### 5.4 Snapshot persistido

El plan se guarda en `solicitud.planCuotas`:

```json
{
  "modalidad": "personalizado",
  "cuotas": [],
  "moneda": "USD",
  "tipoCambio": 1,
  "descuentoTipo": "por_stand",
  "descuentoValor": 0,
  "descuentoPorcentaje": 0,
  "descuentoMonto": 0,
  "netoLista": 0,
  "netoDescontado": 0,
  "igv": 0,
  "total": 0,
  "descuentosPorStand": [
    {
      "standId": "uuid",
      "standCode": "P38-01",
      "precio": 0,
      "tipo": "porcentaje",
      "valor": 3,
      "porcentaje": 3,
      "descuentoMonto": 0,
      "neto": 0
    }
  ]
}
```

El backend recalcula siempre los montos desde el precio comercial del stand. No confía en los importes enviados por el navegador.

## 6. UI de la reserva administrativa

El formulario se organiza en tres pasos:

### Paso 1 — Configuración

- Empresa.
- Representante legal.
- Tipo de facturación.
- Tipo de pago/moneda.

### Paso 2 — Descuento

- Un solo selector de tipo de descuento.
- Cuatro opciones presentadas como radio buttons:
  - Porcentaje sobre el total del contrato.
  - Monto fijo sobre el total del contrato.
  - Porcentaje por cada stand.
  - Monto fijo por cada stand.
- Si se elige por stand:
  - Buscador por código o tipo.
  - Scroll independiente.
  - Precio neto, descuento y neto por fila.

### Paso 3 — Cuotas y plazos

- Fechas de vencimiento.
- Porcentajes.
- Montos calculados.
- Resumen de neto, descuento, IGV y total.

El modal mantiene altura estable y el contenido central tiene scroll propio.

## 7. Contrato de Operador Internacional

### 7.1 Plantilla

La nueva plantilla oficial se encuentra en:

```text
plantillas/contrato-p38-operador-tags.docx
```

Archivo **untracked actualmente**; debe agregarse al commit para que exista en el despliegue.

La selección se realiza por tipo de solicitud:

```text
reserva_empresa → PLANTILLAS_CONTRATO_RESERVA_EMPRESA
flujo regular   → PLANTILLAS_CONTRATO
```

### 7.2 Parámetros enviados al generador

Además de los campos existentes del contrato, para `reserva_empresa` se envían:

```text
pais_operador
area_total
metraje_total
cantidad_modulos
pabellones_modulos
tipos_modulos
cuota_1_monto
cuota_2_monto
cuota_3_monto
fecha_cuota_1
fecha_cuota_2
fecha_cuota_3
```

El generador también recibe `tipoSolicitud` y `pais` para seleccionar la plantilla y completar cláusulas del operador.

### 7.3 Tags cubiertos por la plantilla

La plantilla usa, entre otros:

```text
razon_social
ruc
domicilio_fiscal
representante_legal
dni_representante
partida_electronica
pais_operador
modulos[]
planos[]
cuotas_contrato[]
moneda
valor_venta
igv
precio_venta
cuota_1_monto
cuota_2_monto
cuota_3_monto
fecha_cuota_1
fecha_cuota_2
fecha_cuota_3
```

La revisión de la plantilla no detectó tags huérfanos respecto al generador actual.

## 8. API y DTOs

La reserva administrativa envía:

```text
eventoId
empresaRuc
standIds
moneda
tipoComprobante
cuotas
descuentoTipo
descuentoValor
descuentosPorStand: [
  { standId, tipo: "porcentaje" | "monto", valor }
]
```

Validaciones principales:

- `reservaAdminSchema`
- `ReservaAdminRequestDTO`
- `ReservaApplicationService.crearAdministrativa`
- `ContratoApplicationService.generar`

## 9. Verificación

- `tsc`: OK.
- ESLint: OK.
- Tests de reservas: 27.
- Tests de contrato: incluye generación con plantilla `reserva_empresa`.
- Suite completa tiene un timeout conocido y no relacionado en `export-tabla.test.ts`.

## 10. Pendientes

1. Agregar y commitear `plantillas/contrato-p38-operador-tags.docx`.
2. Validar visualmente la nueva plantilla con datos reales de un operador.
3. Confirmar que la plantilla incluya correctamente el detalle por stand si el negocio lo exige.
4. Validar el flujo de firma digital y la generación de la orden de pago en QA.
5. Revisar la visualización del descuento por stand en el contrato final.
6. Definir la gestión de cambios posteriores a firma/facturación.
